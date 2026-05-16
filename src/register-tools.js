import { z } from 'zod';
import { getDataSourceKeyProperty, getDataSourceStatusProperty, listDataSources, loadConfig, resolveDataSourceId } from './config.js';
import { retrieveDataSource, updateDataSource, updatePage } from './notion.js';
import { buildExactFilter, buildProperties, getPropertySchema, summarizePage, summarizeSchemaProperties } from './properties.js';
import {
  notion_db_count,
  notion_db_get_by_property,
  notion_db_group_count,
  notion_db_query,
  notion_db_table,
  notion_db_update_by_property,
} from './tools.js';

const jsonObject = z.record(z.string(), z.any());
const pageSize = z.number().int().min(1).max(100).optional().describe('Optional Notion API page size, 1-100');
const maxResults = z.number().int().min(1).max(1000).optional().describe('Optional maximum rows to return, 1-1000');
const propertyType = z.enum([
  'rich_text',
  'number',
  'select',
  'multi_select',
  'status',
  'date',
  'people',
  'files',
  'checkbox',
  'url',
  'email',
  'phone_number',
  'formula',
  'relation',
  'rollup',
  'unique_id',
]);

function textResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function resolveAlias(aliasOrId) {
  return resolveDataSourceId(aliasOrId, loadConfig());
}

export function registerNotionDbTools(server) {
  server.registerTool('notion_source_list', {
    description: 'List configured Notion data source aliases with metadata such as id, name, description, key_property, title_property, and status_property.',
    inputSchema: {},
  }, async () => textResult({ sources: listDataSources(loadConfig()) }));

  server.registerTool('notion_source_schema', {
    description: 'Fetch schema for a configured source alias or raw data_source_id.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
    },
  }, async ({ source }) => {
    const schema = await retrieveDataSource(resolveAlias(source));
    const properties = summarizeSchemaProperties(schema);
    return textResult({ source, data_source_id: schema.id, properties });
  });

  server.registerTool('notion_source_update_schema', {
    description: 'Patch a configured source schema by passing a raw Notion data source properties object. Can add, rename, update, or remove properties.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      properties: jsonObject.describe('Raw Notion data source properties patch object. Set a property to null to remove it.'),
    },
  }, async ({ source, properties }) => {
    const schema = await updateDataSource(resolveAlias(source), { properties });
    return textResult({ updated: true, source, data_source_id: schema.id, properties: summarizeSchemaProperties(schema) });
  });

  server.registerTool('notion_source_add_property', {
    description: 'Add a property to a configured source schema. For Notion unique_id / ID, use type=unique_id and omit prefix or set prefix=null for number-only IDs.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      name: z.string().describe('New property name'),
      type: propertyType.describe('Notion property type to create'),
      config: jsonObject.optional().describe('Optional Notion property type config, for example { "prefix": null } for unique_id or { "options": [...] } for select/status.'),
    },
  }, async ({ source, name, type, config }) => {
    const schema = await updateDataSource(resolveAlias(source), {
      properties: { [name]: buildSchemaProperty(type, config) },
    });
    return textResult({ added: true, source, data_source_id: schema.id, property: name, properties: summarizeSchemaProperties(schema) });
  });

  server.registerTool('notion_source_rename_property', {
    description: 'Rename a property in a configured source schema. The property key can be the current property name or property ID.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      property_name: z.string().describe('Current property name or property ID'),
      new_name: z.string().describe('New property name'),
    },
  }, async ({ source, property_name, new_name }) => {
    const schema = await updateDataSource(resolveAlias(source), {
      properties: { [property_name]: { name: new_name } },
    });
    return textResult({ renamed: true, source, data_source_id: schema.id, property: property_name, new_name, properties: summarizeSchemaProperties(schema) });
  });

  server.registerTool('notion_source_remove_property', {
    description: 'Remove a property from a configured source schema by setting it to null. Requires confirm=true. Notion does not allow removing the title property.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      property_name: z.string().describe('Property name or property ID to remove'),
      confirm: z.boolean().describe('Must be true to remove a schema property'),
    },
  }, async ({ source, property_name, confirm }) => {
    if (confirm !== true) throw new Error('Refusing to remove schema property without confirm=true.');
    const schema = await updateDataSource(resolveAlias(source), {
      properties: { [property_name]: null },
    });
    return textResult({ removed: true, source, data_source_id: schema.id, property: property_name, properties: summarizeSchemaProperties(schema) });
  });

  server.registerTool('notion_source_get_by_key', {
    description: 'Get exactly one row from a configured source using its configured key_property, or an override key_property.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      key_value: z.union([z.string(), z.number(), z.boolean()]).describe('Exact key value to match'),
      key_property: z.string().optional().describe('Override key property; defaults to source key_property'),
    },
  }, async ({ source, key_value, key_property }) => {
    const property = key_property || getDataSourceKeyProperty(source, loadConfig());
    if (!property) throw new Error(`No key_property configured for source: ${source}`);
    const page = await notion_db_get_by_property(resolveAlias(source), property, key_value);
    return textResult({ ...summarizePage(page), properties: page.properties });
  });

  server.registerTool('notion_source_update_by_key', {
    description: 'Update exactly one row from a configured source using its configured key_property, or an override key_property. Blocks not found and duplicate matches.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      key_value: z.union([z.string(), z.number(), z.boolean()]).describe('Exact key value to match'),
      properties: jsonObject.describe('Plain property values to update'),
      key_property: z.string().optional().describe('Override key property; defaults to source key_property'),
    },
  }, async ({ source, key_value, properties, key_property }) => {
    const property = key_property || getDataSourceKeyProperty(source, loadConfig());
    if (!property) throw new Error(`No key_property configured for source: ${source}`);
    const page = await notion_db_update_by_property(resolveAlias(source), property, key_value, properties);
    return textResult({ updated: true, ...summarizePage(page) });
  });

  server.registerTool('notion_source_update_status_by_key', {
    description: 'Update one status/select property on exactly one row from a configured source using key_property and status_property metadata.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      key_value: z.union([z.string(), z.number(), z.boolean()]).describe('Exact key value to match'),
      status_value: z.string().describe('Status/select option name'),
      key_property: z.string().optional().describe('Override key property; defaults to source key_property'),
      status_property: z.string().optional().describe('Override status property; defaults to source status_property'),
    },
  }, async ({ source, key_value, status_value, key_property, status_property }) => {
    const keyProperty = key_property || getDataSourceKeyProperty(source, loadConfig());
    const statusProperty = status_property || getDataSourceStatusProperty(source, loadConfig());
    if (!keyProperty) throw new Error(`No key_property configured for source: ${source}`);
    if (!statusProperty) throw new Error(`No status_property configured for source: ${source}`);
    const page = await notion_db_update_by_property(resolveAlias(source), keyProperty, key_value, { [statusProperty]: status_value });
    return textResult({ updated: true, ...summarizePage(page) });
  });

  server.registerTool('notion_source_query', {
    description: 'Query a configured source and return table-style rows with selected Notion properties converted to simple JSON values.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      filters: jsonObject.optional().describe('Optional Notion API filter object'),
      sorts: z.array(jsonObject).optional().describe('Optional Notion API sorts array'),
      properties: z.array(z.string()).optional().describe('Optional property names to include. When omitted, includes all properties.'),
      page_size: pageSize,
      max_results: maxResults,
    },
  }, async ({ source, filters, sorts, properties, page_size, max_results }) => {
    const result = await notion_db_table(resolveAlias(source), filters, sorts, properties, { page_size, max_results });
    return textResult({ source, ...result });
  });

  server.registerTool('notion_source_table', {
    description: 'Return rows from a configured source as a compact table with page metadata and selected scalar property values.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      filters: jsonObject.optional().describe('Optional Notion API filter object'),
      sorts: z.array(jsonObject).optional().describe('Optional Notion API sorts array'),
      properties: z.array(z.string()).optional().describe('Optional property names to include. When omitted, includes all properties.'),
      page_size: pageSize,
      max_results: maxResults,
    },
  }, async ({ source, filters, sorts, properties, page_size, max_results }) => {
    const result = await notion_db_table(resolveAlias(source), filters, sorts, properties, { page_size, max_results });
    return textResult({ source, ...result });
  });

  server.registerTool('notion_source_count', {
    description: 'Count rows in a configured source that match an optional Notion API filter.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      filters: jsonObject.optional().describe('Optional Notion API filter object'),
    },
  }, async ({ source, filters }) => {
    const result = await notion_db_count(resolveAlias(source), filters);
    return textResult({ source, ...result });
  });

  server.registerTool('notion_source_group_count', {
    description: 'Group matching rows in a configured source by one property and return counts per value.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      group_property: z.string().describe('Property name to group by, for example Status'),
      filters: jsonObject.optional().describe('Optional Notion API filter object applied before grouping'),
    },
  }, async ({ source, group_property, filters }) => {
    const result = await notion_db_group_count(resolveAlias(source), group_property, filters);
    return textResult({ source, ...result });
  });

  server.registerTool('notion_source_query_by_property', {
    description: 'Query a configured source by one exact property match and return table-style rows with selected simple property values.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      property_name: z.string().describe('Property name to match exactly'),
      value: z.union([z.string(), z.number(), z.boolean()]).describe('Exact property value to match'),
      sorts: z.array(jsonObject).optional().describe('Optional Notion API sorts array'),
      properties: z.array(z.string()).optional().describe('Optional property names to include. When omitted, includes all properties.'),
      page_size: pageSize,
      max_results: maxResults,
    },
  }, async ({ source, property_name, value, sorts, properties, page_size, max_results }) => {
    const dataSourceId = resolveAlias(source);
    const schema = await retrieveDataSource(dataSourceId);
    const filter = buildExactFilter(property_name, value, getPropertySchema(schema, property_name));
    const result = await notion_db_table(dataSourceId, filter, sorts, properties, { page_size, max_results });
    return textResult({ source, filter_property: property_name, filter_value: value, ...result });
  });

  server.registerTool('notion_source_count_by_property', {
    description: 'Count rows in a configured source by one exact property match, using schema-aware filter construction.',
    inputSchema: {
      source: z.string().describe('Configured source alias or raw data_source_id'),
      property_name: z.string().describe('Property name to match exactly'),
      value: z.union([z.string(), z.number(), z.boolean()]).describe('Exact property value to match'),
    },
  }, async ({ source, property_name, value }) => {
    const dataSourceId = resolveAlias(source);
    const schema = await retrieveDataSource(dataSourceId);
    const filter = buildExactFilter(property_name, value, getPropertySchema(schema, property_name));
    const result = await notion_db_count(dataSourceId, filter);
    return textResult({ source, filter_property: property_name, filter_value: value, ...result });
  });

  server.registerTool('notion_db_schema', {
    description: 'Fetch Notion data source schema and list property names/types. Accepts alias or raw data_source_id.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
    },
  }, async ({ data_source_id }) => {
    const schema = await retrieveDataSource(resolveAlias(data_source_id));
    const properties = summarizeSchemaProperties(schema);
    return textResult({ data_source_id: schema.id, properties });
  });

  server.registerTool('notion_db_update_schema', {
    description: 'Patch a Notion data source schema by passing a raw Notion data source properties object. Can add, rename, update, or remove properties.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      properties: jsonObject.describe('Raw Notion data source properties patch object. Set a property to null to remove it.'),
    },
  }, async ({ data_source_id, properties }) => {
    const resolvedId = resolveAlias(data_source_id);
    const schema = await updateDataSource(resolvedId, { properties });
    return textResult({ updated: true, data_source_id: schema.id, properties: summarizeSchemaProperties(schema) });
  });

  server.registerTool('notion_db_add_property', {
    description: 'Add a property to a Notion data source schema. For Notion unique_id / ID, use type=unique_id and omit prefix or set prefix=null for number-only IDs.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      name: z.string().describe('New property name'),
      type: propertyType.describe('Notion property type to create'),
      config: jsonObject.optional().describe('Optional Notion property type config, for example { "prefix": null } for unique_id or { "options": [...] } for select/status.'),
    },
  }, async ({ data_source_id, name, type, config }) => {
    const resolvedId = resolveAlias(data_source_id);
    const schema = await updateDataSource(resolvedId, {
      properties: { [name]: buildSchemaProperty(type, config) },
    });
    return textResult({ added: true, data_source_id: schema.id, property: name, properties: summarizeSchemaProperties(schema) });
  });

  server.registerTool('notion_db_rename_property', {
    description: 'Rename a property in a Notion data source schema. The property key can be the current property name or property ID.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      property_name: z.string().describe('Current property name or property ID'),
      new_name: z.string().describe('New property name'),
    },
  }, async ({ data_source_id, property_name, new_name }) => {
    const resolvedId = resolveAlias(data_source_id);
    const schema = await updateDataSource(resolvedId, {
      properties: { [property_name]: { name: new_name } },
    });
    return textResult({ renamed: true, data_source_id: schema.id, property: property_name, new_name, properties: summarizeSchemaProperties(schema) });
  });

  server.registerTool('notion_db_remove_property', {
    description: 'Remove a property from a Notion data source schema by setting it to null. Requires confirm=true. Notion does not allow removing the title property.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      property_name: z.string().describe('Property name or property ID to remove'),
      confirm: z.boolean().describe('Must be true to remove a schema property'),
    },
  }, async ({ data_source_id, property_name, confirm }) => {
    if (confirm !== true) throw new Error('Refusing to remove schema property without confirm=true.');
    const resolvedId = resolveAlias(data_source_id);
    const schema = await updateDataSource(resolvedId, {
      properties: { [property_name]: null },
    });
    return textResult({ removed: true, data_source_id: schema.id, property: property_name, properties: summarizeSchemaProperties(schema) });
  });

  server.registerTool('notion_db_query', {
    description: 'Query a Notion data source using an optional explicit Notion API filter object. This is property-filter based, not semantic search.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      filters: jsonObject.optional().describe('Optional Notion API filter object'),
      sorts: z.array(jsonObject).optional().describe('Optional Notion API sorts array'),
      page_size: pageSize,
      max_results: maxResults,
    },
  }, async ({ data_source_id, filters, sorts, page_size, max_results }) => {
    const pages = await notion_db_query(resolveAlias(data_source_id), filters, sorts, { page_size, max_results });
    return textResult({ count: pages.length, limited: Boolean(max_results), max_results, pages: pages.map(summarizePage) });
  });

  server.registerTool('notion_db_table', {
    description: 'Query a Notion data source and return compact rows with selected Notion properties converted to simple JSON values.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      filters: jsonObject.optional().describe('Optional Notion API filter object'),
      sorts: z.array(jsonObject).optional().describe('Optional Notion API sorts array'),
      properties: z.array(z.string()).optional().describe('Optional property names to include. When omitted, includes all properties.'),
      page_size: pageSize,
      max_results: maxResults,
    },
  }, async ({ data_source_id, filters, sorts, properties, page_size, max_results }) => {
    const result = await notion_db_table(resolveAlias(data_source_id), filters, sorts, properties, { page_size, max_results });
    return textResult({ data_source_id: resolveAlias(data_source_id), ...result });
  });

  server.registerTool('notion_db_count', {
    description: 'Count rows in a Notion data source that match an optional Notion API filter.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      filters: jsonObject.optional().describe('Optional Notion API filter object'),
    },
  }, async ({ data_source_id, filters }) => {
    const result = await notion_db_count(resolveAlias(data_source_id), filters);
    return textResult({ data_source_id: resolveAlias(data_source_id), ...result });
  });

  server.registerTool('notion_db_group_count', {
    description: 'Group matching rows in a Notion data source by one property and return counts per value.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      group_property: z.string().describe('Property name to group by, for example Status'),
      filters: jsonObject.optional().describe('Optional Notion API filter object applied before grouping'),
    },
  }, async ({ data_source_id, group_property, filters }) => {
    const result = await notion_db_group_count(resolveAlias(data_source_id), group_property, filters);
    return textResult({ data_source_id: resolveAlias(data_source_id), ...result });
  });

  server.registerTool('notion_db_query_by_property', {
    description: 'Query a Notion data source by one exact property match and return table-style rows with selected simple property values.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      property_name: z.string().describe('Property name to match exactly'),
      value: z.union([z.string(), z.number(), z.boolean()]).describe('Exact property value to match'),
      sorts: z.array(jsonObject).optional().describe('Optional Notion API sorts array'),
      properties: z.array(z.string()).optional().describe('Optional property names to include. When omitted, includes all properties.'),
      page_size: pageSize,
      max_results: maxResults,
    },
  }, async ({ data_source_id, property_name, value, sorts, properties, page_size, max_results }) => {
    const resolvedId = resolveAlias(data_source_id);
    const schema = await retrieveDataSource(resolvedId);
    const filter = buildExactFilter(property_name, value, getPropertySchema(schema, property_name));
    const result = await notion_db_table(resolvedId, filter, sorts, properties, { page_size, max_results });
    return textResult({ data_source_id: resolvedId, filter_property: property_name, filter_value: value, ...result });
  });

  server.registerTool('notion_db_count_by_property', {
    description: 'Count rows in a Notion data source by one exact property match, using schema-aware filter construction.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      property_name: z.string().describe('Property name to match exactly'),
      value: z.union([z.string(), z.number(), z.boolean()]).describe('Exact property value to match'),
    },
  }, async ({ data_source_id, property_name, value }) => {
    const resolvedId = resolveAlias(data_source_id);
    const schema = await retrieveDataSource(resolvedId);
    const filter = buildExactFilter(property_name, value, getPropertySchema(schema, property_name));
    const result = await notion_db_count(resolvedId, filter);
    return textResult({ data_source_id: resolvedId, filter_property: property_name, filter_value: value, ...result });
  });

  server.registerTool('notion_db_get_by_property', {
    description: 'Get exactly one row/page from a Notion data source by exact property match. Errors on not found or duplicate match.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      property_name: z.string().describe('Property name to match exactly'),
      value: z.union([z.string(), z.number(), z.boolean()]).describe('Exact property value to match'),
    },
  }, async ({ data_source_id, property_name, value }) => {
    const page = await notion_db_get_by_property(resolveAlias(data_source_id), property_name, value);
    return textResult({ ...summarizePage(page), properties: page.properties });
  });

  server.registerTool('notion_db_update_page', {
    description: 'Update a Notion page by page_id. Properties are plain values converted using data source schema when data_source_id is provided, or raw Notion properties otherwise.',
    inputSchema: {
      page_id: z.string().describe('Notion page ID to update'),
      properties: jsonObject.describe('Plain property values when data_source_id is provided, otherwise raw Notion page properties'),
      data_source_id: z.string().optional().describe('Optional data source ID or alias used to convert plain property values'),
    },
  }, async ({ page_id, properties, data_source_id }) => {
    let notionProperties = properties;
    if (data_source_id) {
      const schema = await retrieveDataSource(resolveAlias(data_source_id));
      notionProperties = buildProperties(properties, schema);
    }
    const page = await updatePage(page_id, notionProperties);
    return textResult({ updated: true, ...summarizePage(page) });
  });

  server.registerTool('notion_db_update_by_property', {
    description: 'Find exactly one row by exact property match, then update that page_id. Blocks not found and duplicate matches.',
    inputSchema: {
      data_source_id: z.string().describe('Data source ID or local alias from config.json'),
      match_property: z.string().describe('Property name to match exactly'),
      match_value: z.union([z.string(), z.number(), z.boolean()]).describe('Exact property value to match'),
      properties: jsonObject.describe('Plain property values to update, converted using data source schema'),
    },
  }, async ({ data_source_id, match_property, match_value, properties }) => {
    const page = await notion_db_update_by_property(resolveAlias(data_source_id), match_property, match_value, properties);
    return textResult({ updated: true, ...summarizePage(page) });
  });

}

function buildSchemaProperty(type, config = {}) {
  if (type === 'unique_id' && !Object.hasOwn(config, 'prefix')) return { unique_id: { prefix: null } };
  return { [type]: config || {} };
}
