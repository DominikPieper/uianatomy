// Generates site/public/.well-known/agent-skills/index.json per
// Agent Skills Discovery RFC v0.2.0
// (https://github.com/cloudflare/agent-skills-discovery-rfc).
//
// For every site/public/.well-known/agent-skills/<name>/SKILL.md the script:
//   1. computes a sha256 of the exact bytes that will be served at the
//      published URL,
//   2. emits an entry with name/type/description/url/digest.
//
// Description is read from the SKILL.md frontmatter (`description:` line);
// falls back to the first non-empty paragraph.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const skillsDir = resolve(here, '..', 'public', '.well-known', 'agent-skills');
const SITE_ORIGIN = 'https://uianatomy.dev';

function readDescription(md) {
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const desc = fmMatch[1].match(/^description:\s*(.+)$/m);
    if (desc) return desc[1].trim();
  }
  const body = md.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
  const para = body.split(/\n\n+/).find((p) => !p.startsWith('#'));
  return para ? para.replace(/\s+/g, ' ').trim() : '';
}

const skills = readdirSync(skillsDir)
  .filter((entry) => statSync(resolve(skillsDir, entry)).isDirectory())
  .sort()
  .map((name) => {
    const skillPath = resolve(skillsDir, name, 'SKILL.md');
    const bytes = readFileSync(skillPath);
    const digest = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
    const description = readDescription(bytes.toString('utf8'));
    return {
      name,
      type: 'skill-md',
      description,
      url: `${SITE_ORIGIN}/.well-known/agent-skills/${name}/SKILL.md`,
      digest,
    };
  });

if (skills.length === 0) {
  throw new Error(`build-agent-skills-index: no SKILL.md files found under ${skillsDir}`);
}

const index = {
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills,
};

const outPath = resolve(skillsDir, 'index.json');
writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n', 'utf8');

console.log(`[build-agent-skills-index] wrote ${outPath} (${skills.length} skill${skills.length === 1 ? '' : 's'})`);
