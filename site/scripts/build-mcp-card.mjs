// Generates site/public/.well-known/mcp/server-card.json
// SEP-1649: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127
//
// Extracts name + version from the McpServer constructor call in
// mcp-server/src/server.ts so the card matches the runtime advertisement.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const serverSrc = readFileSync(resolve(repoRoot, 'mcp-server', 'src', 'server.ts'), 'utf8');
const match = serverSrc.match(/new McpServer\(\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*version:\s*['"]([^'"]+)['"]/);
if (!match) {
  throw new Error('build-mcp-card: could not locate McpServer({ name, version }) in server.ts');
}
const [, name, version] = match;

const card = {
  serverInfo: { name, version },
  endpoint: 'https://uianatomy.dev/mcp',
  transport: 'streamable-http',
  capabilities: { tools: {} },
};

const outPath = resolve(here, '..', 'public', '.well-known', 'mcp', 'server-card.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(card, null, 2) + '\n', 'utf8');

console.log(`[build-mcp-card] wrote ${outPath}`);
