import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { registerNotionDbTools } from '../src/register-tools.js';
import { simplifyPropertyValue, summarizeSchemaProperties, tableRow } from '../src/properties.js';
import { notionApiPaginate, notionApiRequest, queryDataSource, sendFileUpload } from '../src/notion.js';

const registeredTools = [];
registerNotionDbTools({
  registerTool(name, config, handler) {
    registeredTools.push({ name, config, handler });
  },
});

const requiredTools = [
  'notion_api_request',
  'notion_api_paginate',
  'notion_file_upload_send',
  'notion_source_list',
  'notion_source_schema',
  'notion_source_update_schema',
  'notion_source_add_property',
  'notion_source_rename_property',
  'notion_source_remove_property',
  'notion_source_get_by_key',
  'notion_source_query',
  'notion_source_table',
  'notion_source_count',
  'notion_source_group_count',
  'notion_source_query_by_property',
  'notion_source_count_by_property',
  'notion_source_update_by_key',
  'notion_source_update_status_by_key',
  'notion_db_schema',
  'notion_db_update_schema',
  'notion_db_add_property',
  'notion_db_rename_property',
  'notion_db_remove_property',
  'notion_db_query',
  'notion_db_table',
  'notion_db_count',
  'notion_db_group_count',
  'notion_db_query_by_property',
  'notion_db_count_by_property',
  'notion_db_get_by_property',
  'notion_db_update_page',
  'notion_db_update_by_property',
];

const registeredNames = registeredTools.map((tool) => tool.name);
assert.deepEqual(
  requiredTools.filter((name) => !registeredNames.includes(name)),
  [],
  'All expected MCP tools must be registered',
);
const rawQueryTool = registeredTools.find((tool) => tool.name === 'notion_db_query');
assert.equal(rawQueryTool.config.inputSchema.filters.isOptional(), true, 'notion_db_query filters should be optional');

const page = {
  id: 'page-1',
  url: 'https://example.test/page-1',
  properties: {
    No: { type: 'number', number: 38 },
    Task: { type: 'title', title: [{ plain_text: 'Improve MCP' }] },
    Summary: { type: 'rich_text', rich_text: [{ plain_text: 'Return useful rows' }] },
    Status: { type: 'status', status: { name: 'QC' } },
    Priority: { type: 'select', select: { name: 'High' } },
    Tags: { type: 'multi_select', multi_select: [{ name: 'api' }, { name: 'mcp' }] },
    Done: { type: 'checkbox', checkbox: false },
    Due: { type: 'date', date: { start: '2026-05-16', end: null, time_zone: null } },
    UID: { type: 'unique_id', unique_id: { prefix: 'TASK', number: 42 } },
    Owner: { type: 'people', people: [{ name: 'Tri' }, { id: 'user-2' }] },
    Link: { type: 'url', url: 'https://example.test' },
    Formula: { type: 'formula', formula: { type: 'string', string: 'ready' } },
  },
};

assert.equal(simplifyPropertyValue(page.properties.Task), 'Improve MCP');
assert.equal(simplifyPropertyValue(page.properties.Summary), 'Return useful rows');
assert.equal(simplifyPropertyValue(page.properties.Status), 'QC');
assert.equal(simplifyPropertyValue(page.properties.Priority), 'High');
assert.deepEqual(simplifyPropertyValue(page.properties.Tags), ['api', 'mcp']);
assert.equal(simplifyPropertyValue(page.properties.Done), false);
assert.equal(simplifyPropertyValue(page.properties.Due), '2026-05-16');
assert.equal(simplifyPropertyValue(page.properties.UID), 'TASK-42');
assert.deepEqual(simplifyPropertyValue(page.properties.Owner), ['Tri', 'user-2']);
assert.equal(simplifyPropertyValue(page.properties.Link), 'https://example.test');
assert.equal(simplifyPropertyValue(page.properties.Formula), 'ready');

assert.deepEqual(tableRow(page, ['No', 'Task', 'Status']), {
  page_id: 'page-1',
  title: 'Improve MCP',
  url: 'https://example.test/page-1',
  properties: {
    No: 38,
    Task: 'Improve MCP',
    Status: 'QC',
  },
});

assert.deepEqual(summarizeSchemaProperties({
  properties: {
    Status: {
      type: 'status',
      status: { options: [{ name: 'QC', color: 'blue' }] },
    },
    Priority: {
      type: 'select',
      select: { options: [{ name: 'High', color: 'red' }] },
    },
  },
}), [
  { name: 'Status', type: 'status', options: [{ name: 'QC', color: 'blue' }] },
  { name: 'Priority', type: 'select', options: [{ name: 'High', color: 'red' }] },
]);

const originalFetch = globalThis.fetch;
const originalToken = process.env.NOTION_API_TOKEN;
process.env.NOTION_API_TOKEN = 'secret_test';
const requestedPageSizes = [];
let requestCount = 0;
globalThis.fetch = async (_url, options) => {
  requestCount += 1;
  const body = JSON.parse(options.body);
  requestedPageSizes.push(body.page_size);
  return {
    ok: true,
    async text() {
      return JSON.stringify({
        results: Array.from({ length: body.page_size }, (_, index) => ({ id: `page-${requestCount}-${index}` })),
        has_more: requestCount < 3,
        next_cursor: `cursor-${requestCount}`,
      });
    },
  };
};

const limitedRows = await queryDataSource('ds1', { maxResults: 5, pageSize: 3 });
assert.equal(limitedRows.length, 5);
assert.deepEqual(requestedPageSizes, [3, 2]);

let rawRequest;
globalThis.fetch = async (url, options) => {
  rawRequest = { url, method: options.method, body: options.body };
  return {
    ok: true,
    async text() {
      return JSON.stringify({ ok: true });
    },
  };
};
await notionApiRequest({ method: 'PATCH', path: '/v1/pages/page-1', body: { archived: true } });
assert.equal(rawRequest.url, 'https://api.notion.com/v1/pages/page-1');
assert.equal(rawRequest.method, 'PATCH');
assert.equal(rawRequest.body, JSON.stringify({ archived: true }));
assert.throws(() => notionApiRequest({ path: 'https://api.notion.com/v1/users/me' }), /relative Notion API path/);

const paginatePageSizes = [];
let paginateCount = 0;
globalThis.fetch = async (_url, options) => {
  paginateCount += 1;
  const body = JSON.parse(options.body);
  paginatePageSizes.push(body.page_size);
  return {
    ok: true,
    async text() {
      return JSON.stringify({
        object: 'list',
        results: Array.from({ length: body.page_size }, (_, index) => ({ id: `item-${paginateCount}-${index}` })),
        has_more: paginateCount < 4,
        next_cursor: `cursor-${paginateCount}`,
      });
    },
  };
};
const paginated = await notionApiPaginate({ path: '/search', body: { query: 'Task' }, pageSize: 4, maxResults: 6 });
assert.equal(paginated.count, 6);
assert.deepEqual(paginatePageSizes, [4, 2]);

const tmpFile = path.join(os.tmpdir(), `notion-mcp-upload-${process.pid}.txt`);
await fs.writeFile(tmpFile, 'upload test');
let fileUploadRequest;
globalThis.fetch = async (url, options) => {
  fileUploadRequest = { url, method: options.method, body: options.body };
  return {
    ok: true,
    async text() {
      return JSON.stringify({ id: 'upload-1', status: 'uploaded' });
    },
  };
};
await sendFileUpload('upload-1', tmpFile);
assert.equal(fileUploadRequest.url, 'https://api.notion.com/v1/file_uploads/upload-1/send');
assert.equal(fileUploadRequest.method, 'POST');
assert.equal(fileUploadRequest.body instanceof FormData, true);
await fs.unlink(tmpFile);

globalThis.fetch = originalFetch;
if (originalToken === undefined) {
  delete process.env.NOTION_API_TOKEN;
} else {
  process.env.NOTION_API_TOKEN = originalToken;
}

const schemaUpdateFetch = globalThis.fetch;
const originalTokenForSchema = process.env.NOTION_API_TOKEN;
process.env.NOTION_API_TOKEN = 'secret_test';
let schemaPatchBody;
globalThis.fetch = async (_url, options) => {
  schemaPatchBody = JSON.parse(options.body);
  return {
    ok: true,
    async text() {
      return JSON.stringify({
        id: 'ds1',
        properties: {
          No: { type: 'unique_id', unique_id: { prefix: null } },
        },
      });
    },
  };
};

const addUniqueIdTool = registeredTools.find((tool) => tool.name === 'notion_db_add_property');
await addUniqueIdTool.handler({ data_source_id: 'ds1', name: 'No', type: 'unique_id' });
assert.deepEqual(schemaPatchBody, { properties: { No: { unique_id: { prefix: null } } } });

globalThis.fetch = schemaUpdateFetch;
if (originalTokenForSchema === undefined) {
  delete process.env.NOTION_API_TOKEN;
} else {
  process.env.NOTION_API_TOKEN = originalTokenForSchema;
}

console.log(`Verified ${registeredTools.length} MCP tools, scalar conversion, query limits, schema updates, and raw API coverage.`);
