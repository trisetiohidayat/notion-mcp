#!/usr/bin/env node
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerNotionDbTools } from './register-tools.js';
import { runWithNotionToken } from './token-context.js';

const port = Number(process.env.PORT || process.env.MCP_PORT || 3088);
const host = process.env.HOST || process.env.MCP_HOST || '127.0.0.1';
const bearerToken = process.env.MCP_BEARER_TOKEN;
const authMode = process.env.MCP_AUTH_MODE || 'mcp_bearer';

function authorize(req, res, next) {
  if (authMode === 'dual_header') return authorizeDualHeader(req, res, next);
  if (authMode === 'notion_bearer') return authorizeNotionBearer(req, res, next);
  return authorizeMcpBearer(req, res, next);
}

function authorizeMcpBearer(req, res, next) {
  if (!bearerToken) return next();
  if (req.get('authorization') === `Bearer ${bearerToken}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

function authorizeNotionBearer(req, res, next) {
  const token = parseBearer(req.get('authorization'));
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' });
  req.notionToken = token;
  next();
}

function authorizeDualHeader(req, res, next) {
  if (!bearerToken) return res.status(500).json({ error: 'MCP_BEARER_TOKEN is required in dual_header mode' });
  if (req.get('authorization') !== `Bearer ${bearerToken}`) return res.status(401).json({ error: 'Unauthorized MCP bearer token' });
  const notionToken = req.get('x-notion-token');
  if (!notionToken) return res.status(401).json({ error: 'Missing X-Notion-Token header' });
  req.notionToken = notionToken;
  next();
}

function parseBearer(value) {
  const match = /^Bearer\s+(.+)$/i.exec(value || '');
  return match?.[1];
}

function createServer() {
  const server = new McpServer({ name: 'notion-db-precise-http', version: '0.1.0' });
  registerNotionDbTools(server);
  return server;
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => res.json({ ok: true, name: 'notion-db-precise-http' }));

app.post('/mcp', authorize, async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await runWithNotionToken(req.notionToken, () => transport.handleRequest(req, res, req.body));
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error(error.stack || error.message || error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

app.get('/mcp', authorize, (_req, res) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
});

app.delete('/mcp', authorize, (_req, res) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
});

app.listen(port, host, () => {
  const auth = authMode === 'mcp_bearer' && !bearerToken ? 'disabled' : authMode;
  console.error(`notion-db-precise HTTP MCP listening on http://${host}:${port}/mcp auth=${auth}`);
});
