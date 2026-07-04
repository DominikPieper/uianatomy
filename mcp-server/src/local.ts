#!/usr/bin/env node
// Local stdio entry point for @uianatomy/mcp-server.
//
// The production transport is Streamable HTTP via the Cloudflare Worker
// (worker/index.ts), which loads the canon from pre-built JSON bundles. This
// entry is for LOCAL use: `pnpm dev` (tsx watch) or any stdio MCP client
// pointed at this file. It loads canon straight from the YAML on disk via
// the FS loaders (dir resolution lives in data.ts).
//
// stdio rule: NEVER write to stdout — that channel is the MCP wire. All
// diagnostics go to stderr.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import {
  setAboutPath,
  setContentDir,
  setImplementationsDir,
  setPatternsDir,
} from './data.js';

async function main(): Promise<void> {
  // Wire every canon source from disk (setContentDir also pre-loads
  // sub-anatomies so component `$ref`s resolve).
  setContentDir();
  setImplementationsDir();
  setPatternsDir();
  setAboutPath();

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[uianatomy-mcp] stdio server ready');
}

main().catch((error) => {
  console.error('[uianatomy-mcp] fatal:', error);
  process.exit(1);
});
