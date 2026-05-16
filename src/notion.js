const API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = process.env.NOTION_VERSION || '2026-03-11';
const NOTION_CONFIG_DIR = `${process.env.HOME || process.cwd()}/.config/notion`;

import fs from 'node:fs/promises';
import path from 'node:path';
import { getRequestNotionToken } from './token-context.js';

export class NotionError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

async function notionRequest(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload.message || response.statusText;
    throw new NotionError(`Notion API error ${response.status}: ${message}`);
  }
  return payload;
}

export async function getAccessToken() {
  const requestToken = getRequestNotionToken();
  if (requestToken) return requestToken;

  const directToken = process.env.NOTION_TOKEN || process.env.NOTION_API_TOKEN || process.env.NOTION_API_KEY || process.env.NOTION_ACCESS_TOKEN;
  if (directToken) return directToken;

  const ntnToken = await getNtnFileToken();
  if (ntnToken) return ntnToken;

  throw new NotionError('Missing Notion token. Run `NOTION_KEYRING=0 ntn login`, set NOTION_API_TOKEN, or set NOTION_TOKEN.');
}

async function getNtnFileToken() {
  const auth = await readJsonIfExists(`${NOTION_CONFIG_DIR}/auth.json`);
  if (!auth) return undefined;

  const workspaceId = process.env.NOTION_WORKSPACE_ID || await getDefaultWorkspaceId();
  if (workspaceId && typeof auth[workspaceId] === 'string') return auth[workspaceId];

  const tokens = Object.values(auth).filter((value) => typeof value === 'string');
  return tokens.length === 1 ? tokens[0] : undefined;
}

async function getDefaultWorkspaceId() {
  const config = await readJsonIfExists(`${NOTION_CONFIG_DIR}/config.json`);
  const env = process.env.NOTION_ENV || 'prod';
  return config?.defaultWorkspaceIds?.[env];
}

async function readJsonIfExists(file) {
  try {
    const fs = await import('node:fs/promises');
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

export function retrieveDataSource(dataSourceId) {
  return notionRequest(`/data_sources/${encodeURIComponent(dataSourceId)}`);
}

export function notionApiRequest({ method = 'GET', path, body } = {}) {
  return notionRequest(normalizeNotionApiPath(path), { method, body });
}

export async function notionApiPaginate({ method = 'POST', path: apiPath, body, pageSize = 100, maxResults } = {}) {
  const results = [];
  let startCursor;
  let lastPage;
  do {
    const remaining = maxResults ? Math.max(maxResults - results.length, 0) : pageSize;
    if (maxResults && remaining === 0) break;
    const page_size = Math.min(pageSize, remaining || pageSize, 100);
    const pageBody = { ...(body || {}), page_size };
    if (startCursor) pageBody.start_cursor = startCursor;
    lastPage = await notionApiRequest({ method, path: apiPath, body: method === 'GET' ? undefined : pageBody });
    results.push(...(lastPage.results || []));
    startCursor = lastPage.has_more ? lastPage.next_cursor : undefined;
  } while (startCursor && (!maxResults || results.length < maxResults));

  return {
    object: lastPage?.object || 'list',
    count: maxResults ? Math.min(results.length, maxResults) : results.length,
    has_more: Boolean(startCursor),
    next_cursor: startCursor,
    results: maxResults ? results.slice(0, maxResults) : results,
  };
}

export async function sendFileUpload(fileUploadId, filePath) {
  const token = await getAccessToken();
  const file = await fs.readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([file]), path.basename(filePath));

  const response = await fetch(`${API_BASE}/file_uploads/${encodeURIComponent(fileUploadId)}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
    },
    body: form,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload.message || response.statusText;
    throw new NotionError(`Notion API error ${response.status}: ${message}`);
  }
  return payload;
}

export function updateDataSource(dataSourceId, body) {
  return notionRequest(`/data_sources/${encodeURIComponent(dataSourceId)}`, {
    method: 'PATCH',
    body,
  });
}

export function retrieveDatabase(databaseId) {
  return notionRequest(`/databases/${encodeURIComponent(databaseId)}`);
}

export async function searchDataSources({ query, pageSize = 50 } = {}) {
  const results = [];
  let startCursor;
  do {
    const body = {
      page_size: pageSize,
      filter: { property: 'object', value: 'data_source' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
    };
    if (query) body.query = query;
    if (startCursor) body.start_cursor = startCursor;
    const page = await notionRequest('/search', { method: 'POST', body });
    results.push(...(page.results || []));
    startCursor = page.has_more ? page.next_cursor : undefined;
  } while (startCursor);
  return results;
}

export async function queryDataSource(dataSourceId, { filter, sorts, pageSize = 100, maxResults } = {}) {
  const results = [];
  let startCursor;
  do {
    const remaining = maxResults ? Math.max(maxResults - results.length, 0) : pageSize;
    if (maxResults && remaining === 0) break;
    const body = { page_size: Math.min(pageSize, remaining || pageSize, 100) };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (startCursor) body.start_cursor = startCursor;
    const page = await notionRequest(`/data_sources/${encodeURIComponent(dataSourceId)}/query`, {
      method: 'POST',
      body,
    });
    results.push(...(page.results || []));
    startCursor = page.has_more ? page.next_cursor : undefined;
  } while (startCursor && (!maxResults || results.length < maxResults));
  if (maxResults) return results.slice(0, maxResults);
  return results;
}

export function updatePage(pageId, properties) {
  return notionRequest(`/pages/${encodeURIComponent(pageId)}`, {
    method: 'PATCH',
    body: { properties },
  });
}

function normalizeNotionApiPath(input) {
  if (!input) throw new NotionError('Missing Notion API path.');
  const text = String(input);
  if (/^https?:\/\//i.test(text)) throw new NotionError('Use a relative Notion API path, not a full URL.');
  const withSlash = text.startsWith('/') ? text : `/${text}`;
  return withSlash.startsWith('/v1/') ? withSlash.slice(3) : withSlash;
}
