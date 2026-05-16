import { resolveDataSourceId } from './config.js';
import { queryDataSource, retrieveDataSource, updatePage, NotionError } from './notion.js';
import { buildExactFilter, buildProperties, getPropertySchema, pageTitle, simplifyPropertyValue, tableRow, summarizePage } from './properties.js';

export async function notion_db_query(data_source_id, filters, sorts, options = {}) {
  return queryDataSource(data_source_id, {
    filter: filters,
    sorts,
    pageSize: options.page_size,
    maxResults: options.max_results,
  });
}

export async function notion_db_table(data_source_id, filters, sorts, properties, options = {}) {
  const pages = await notion_db_query(data_source_id, filters, sorts, options);
  return {
    count: pages.length,
    limited: Boolean(options.max_results),
    max_results: options.max_results,
    rows: pages.map((page) => tableRow(page, properties)),
  };
}

export async function notion_db_count(data_source_id, filters) {
  const pages = await notion_db_query(data_source_id, filters);
  return { count: pages.length };
}

export async function notion_db_group_count(data_source_id, group_property, filters) {
  const pages = await notion_db_query(data_source_id, filters);
  const counts = new Map();
  for (const page of pages) {
    const value = simplifyPropertyValue(page.properties?.[group_property]);
    for (const key of groupKeys(value)) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const groups = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || String(left.value).localeCompare(String(right.value)));
  return { count: pages.length, property: group_property, groups };
}

export async function notion_db_get_by_property(data_source_id, property_name, value) {
  const schema = await retrieveDataSource(data_source_id);
  const propertySchema = getPropertySchema(schema, property_name);
  const filter = buildExactFilter(property_name, value, propertySchema);
  return assertSingleMatch(await queryDataSource(data_source_id, { filter }), property_name, value);
}

export async function notion_db_update_page(page_id, properties) {
  return updatePage(page_id, properties);
}

export async function notion_db_update_by_property(data_source_id, match_property, match_value, properties) {
  const schema = await retrieveDataSource(data_source_id);
  const page = await notion_db_get_by_property(data_source_id, match_property, match_value);
  const notionProperties = buildProperties(properties, schema);
  return updatePage(page.id, notionProperties);
}

export async function task_get(alias_or_data_source_id, no_property, no_value, config) {
  const dataSourceId = resolveDataSourceId(alias_or_data_source_id, config);
  return notion_db_get_by_property(dataSourceId, no_property, no_value);
}

export async function task_update_status(alias_or_data_source_id, no_property, no_value, status_property, status_value, config) {
  const dataSourceId = resolveDataSourceId(alias_or_data_source_id, config);
  return notion_db_update_by_property(dataSourceId, no_property, no_value, { [status_property]: status_value });
}

export async function task_update_properties(alias_or_data_source_id, no_property, no_value, properties, config) {
  const dataSourceId = resolveDataSourceId(alias_or_data_source_id, config);
  return notion_db_update_by_property(dataSourceId, no_property, no_value, properties);
}

export function assertSingleMatch(matches, propertyName, value) {
  if (matches.length === 0) {
    throw new NotionError(`Not found: no row where ${propertyName} equals ${value}.`, 2);
  }
  if (matches.length > 1) {
    const duplicateList = matches.map((page) => `- ${page.id} ${pageTitle(page)}`).join('\n');
    throw new NotionError(`Duplicate match: ${matches.length} rows where ${propertyName} equals ${value}. No update performed.\n${duplicateList}`, 3);
  }
  return matches[0];
}

export function summarizeResult(page) {
  return summarizePage(page);
}

function groupKeys(value) {
  if (Array.isArray(value)) return value.length ? value.map(groupKey) : ['(empty)'];
  return [groupKey(value)];
}

function groupKey(value) {
  if (value === undefined || value === null || value === '') return '(empty)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
