import assert from 'node:assert/strict';
import { registerNotionDbTools } from '../src/register-tools.js';
import { simplifyPropertyValue, tableRow } from '../src/properties.js';

const registeredTools = [];
registerNotionDbTools({
  registerTool(name, config) {
    registeredTools.push({ name, description: config.description });
  },
});

const requiredTools = [
  'notion_source_list',
  'notion_source_schema',
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

console.log(`Verified ${registeredTools.length} MCP tools and scalar property conversion.`);
