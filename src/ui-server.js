import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addConfigSource,
  discoverConfigSources,
  getConfigInfo,
  refreshConfigSource,
  removeConfigSource,
} from './config-manager.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3099;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.join(__dirname, 'ui');

export function createUiApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'notion-mcp-ui' });
  });

  app.get('/api/config', (_req, res) => {
    res.json(getConfigInfo());
  });

  app.get('/api/discover', async (req, res, next) => {
    try {
      res.json(await discoverConfigSources({ query: req.query.query }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/sources', async (req, res, next) => {
    try {
      const { alias, input, key, title, status, name, overwrite } = req.body || {};
      res.status(201).json(await addConfigSource({
        alias,
        input,
        options: { key, title, status, name, overwrite: Boolean(overwrite) },
      }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/sources/:alias/refresh', async (req, res, next) => {
    try {
      res.json(await refreshConfigSource(req.params.alias));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/sources/:alias', (req, res, next) => {
    try {
      const confirmed = req.query.confirm === 'true' || req.body?.confirm === true;
      res.json(removeConfigSource(req.params.alias, { yes: confirmed }));
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(UI_DIR, {
    extensions: ['html'],
    index: 'index.html',
    maxAge: '1h',
  }));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((error, _req, res, _next) => {
    const status = Number.isInteger(error.status) ? error.status : 400;
    res.status(status).json({ error: sanitizeErrorMessage(error) });
  });

  return app;
}

export async function startUiServer() {
  const host = process.env.NOTION_MCP_UI_HOST || DEFAULT_HOST;
  const port = Number.parseInt(process.env.NOTION_MCP_UI_PORT || String(DEFAULT_PORT), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid NOTION_MCP_UI_PORT: ${process.env.NOTION_MCP_UI_PORT}`);
  }

  const app = createUiApp();
  await new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on('error', reject);
  });

  console.log(`Notion MCP local UI: http://${host}:${port}`);
  if (!isLoopbackHost(host)) {
    console.warn('Warning: UI host is not loopback. Only use this on a trusted network.');
  }
}

function sanitizeErrorMessage(error) {
  const message = String(error?.message || error || 'Request failed');
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(secret_|ntn_|notion_)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]');
}

function isLoopbackHost(host) {
  return ['127.0.0.1', 'localhost', '::1'].includes(host);
}
