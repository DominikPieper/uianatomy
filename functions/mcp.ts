import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createServer } from '../mcp-server/src/server.js';
import { setComponents } from '../mcp-server/src/state.js';
import { loadComponentsFromBundle } from '@uianatomy/shared/bundle';
import bundleJson from '@uianatomy/shared/content-bundle.json';

setComponents(loadComponentsFromBundle(bundleJson as Record<string, unknown>));

type PagesContext = { request: Request };

export const onRequest = async ({ request }: PagesContext): Promise<Response> => {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST, GET' },
    });
  }
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createServer();
  await server.connect(transport);
  return transport.handleRequest(request);
};
