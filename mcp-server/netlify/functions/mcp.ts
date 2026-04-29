import type { Context } from '@netlify/functions';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from '../../src/server.js';

// Stateless MCP-over-HTTP handler. Each request spins up a fresh server instance
// and a stateless Streamable HTTP transport (sessionIdGenerator: undefined).
// See ADR-003 for the architectural rationale.
export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST, GET' } });
  }

  const bodyText = request.method === 'POST' ? await request.text() : '';
  const parsedBody = bodyText ? JSON.parse(bodyText) : undefined;

  const headersObj: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headersObj[key.toLowerCase()] = value;
  });

  const reqStream = Readable.from(bodyText ? [bodyText] : []);
  const req = Object.assign(reqStream, {
    method: request.method,
    url: '/mcp',
    headers: headersObj,
  }) as unknown as IncomingMessage;

  let statusCode = 200;
  const responseHeaders: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | string[]) {
      responseHeaders[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
    },
    getHeader(name: string) {
      return responseHeaders[name.toLowerCase()];
    },
    writeHead(code: number, maybeHeaders?: Record<string, string>) {
      statusCode = code;
      if (maybeHeaders) {
        for (const [k, v] of Object.entries(maybeHeaders)) {
          responseHeaders[k.toLowerCase()] = String(v);
        }
      }
      return this;
    },
    write(chunk: string | Buffer) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      return true;
    },
    end(chunk?: string | Buffer) {
      if (chunk) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      resolveDone();
      return this;
    },
    on() {
      return this;
    },
  } as unknown as ServerResponse;

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, parsedBody);
  await done;

  return new Response(Buffer.concat(chunks).toString('utf-8'), {
    status: statusCode,
    headers: responseHeaders,
  });
};

export const config = { path: '/mcp' };
