import type { Context } from '@netlify/functions';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createServer } from '../../src/server.js';

// Stateless MCP-over-HTTP handler. Web-standard transport reads the Web Fetch
// Request directly and returns a Response — no Node IncomingMessage shim needed.
// See ADR-003 for the architectural rationale.
export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST, GET' } });
  }

  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createServer();
  await server.connect(transport);
  return transport.handleRequest(request);
};

export const config = { path: '/mcp' };
