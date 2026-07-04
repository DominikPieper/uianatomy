// Generates site/public/.well-known/mcp/server-card.json
// SEP-1649: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127
//
// Extracts `name` from the McpServer constructor call in mcp-server/src/
// server.ts so the card matches the runtime advertisement. `version` comes
// from shared/dist/meta-bundle.json's build-time content hash (P6-212) — the
// same value the Worker passes to createServer({ version }) at runtime
// (worker/index.ts), so the static discovery card and the live
// initialize.serverInfo.version agree. Falls back to '0.0.0' if the meta
// bundle hasn't been built yet (matches createServer()'s own default).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const serverSrc = readFileSync(resolve(repoRoot, 'mcp-server', 'src', 'server.ts'), 'utf8');
const nameMatch = serverSrc.match(/new McpServer\(\{\s*name:\s*['"]([^'"]+)['"]/);
if (!nameMatch) {
  throw new Error('build-mcp-card: could not locate McpServer({ name }) in server.ts');
}
const [, name] = nameMatch;

let version = '0.0.0';
try {
  const meta = JSON.parse(
    readFileSync(resolve(repoRoot, 'shared', 'dist', 'meta-bundle.json'), 'utf8'),
  );
  if (typeof meta.contentHash === 'string') version = meta.contentHash;
} catch {
  // shared hasn't been built yet — keep the '0.0.0' default.
}

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
