import { resolveDataSourceId } from './config.js';
import { queryDataSource, retrieveDataSource, updatePage, NotionError } from './notion.js';
import { buildExactFilter, buildProperties, getPropertySchema, pageTitle, summarizePage } from './properties.js';

export async function notion_db_query(data_source_id, filters, sorts) {
  return queryDataSource(data_source_id, { filter: filters, sorts });
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
