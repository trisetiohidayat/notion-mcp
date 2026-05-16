# Notion DB MCP Helper

Precise Notion data source tools for querying and updating Notion database rows by exact property filters. The lookup path is property-based and never relies on semantic search for row selection.

This project provides:

- A CLI helper for local scripts.
- A stdio MCP server for local MCP clients.
- A Streamable HTTP MCP server for remote MCP clients.
- Generic source metadata so one installation can manage many Notion databases/tables.

## Why

Common Notion workflows like “update row 38” can become unreliable if an agent first uses semantic search to find a page. This helper does the safer flow:

1. Query a specific Notion `data_source_id` with an exact property filter.
2. Require exactly one matching page.
3. Block not-found or duplicate matches.
4. Update the exact `page_id` returned by the query.

## Quick Links

- MCP server installation: [`docs/server.md`](docs/server.md)
- MCP client installation: [`docs/client.md`](docs/client.md)
- Configuration guide: [`docs/configuration.md`](docs/configuration.md)

## Tools

### Source Metadata Tools

Use these when you configure named Notion sources in `config.json`.

- `notion_source_list`
- `notion_source_schema`
- `notion_source_get_by_key`
- `notion_source_update_by_key`
- `notion_source_update_status_by_key`

### Generic Data Source Tools

Use these for raw `data_source_id` or simple aliases.

- `notion_db_schema`
- `notion_db_query`
- `notion_db_get_by_property`
- `notion_db_update_page`
- `notion_db_update_by_property`

## CLI Examples

```bash
npm install
cp config.example.json config.json
export NOTION_API_TOKEN='<your-notion-token>'

./bin/db.js schema example_tasks
./bin/db.js get example_tasks No 38
./bin/db.js update example_tasks No 38 Status Done
./bin/db.js update-props example_tasks No 38 Summary="Done: verified"
```

## Auth Model

The helper can read Notion bearer tokens from:

1. `NOTION_TOKEN`
2. `NOTION_API_TOKEN`
3. `NOTION_API_KEY`
4. `NOTION_ACCESS_TOKEN`
5. Official `ntn` file-based auth, when available

For remote MCP deployments, see [`docs/server.md`](docs/server.md) and [`docs/client.md`](docs/client.md). The recommended remote model is dual-header auth:

- `Authorization: Bearer <mcp-access-token>` protects the MCP bridge.
- `X-Notion-Token: <notion-token>` supplies the caller's Notion token per request.

## Safety Behavior

- No matching row: returns a clear not-found error.
- Multiple matching rows: returns a duplicate-match error and blocks updates.
- Unknown property: returns a schema error.
- Invalid `select`/`status` option: validates against schema when options are available.

## Development

```bash
npm install
npm run check
```

## License

MIT
