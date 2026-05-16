# Notion DB MCP Helper

Personal stdio MCP server and CLI helper for precise Notion data source queries/updates. It resolves rows by exact property filters and never relies on semantic search for mutation targets.

This project is optimized for local development and personal use:

- Codex or Claude Code starts the MCP server locally through stdio.
- The server reads local Notion auth from env vars or official `ntn` file-based auth.
- Database/source aliases live on the client machine.
- `npx` can run the server from GitHub without cloning the repo.

## Why

Common Notion workflows like “update row 38” can become unreliable if an agent first uses semantic search to find a page. This helper does the safer flow:

1. Query a specific Notion `data_source_id` with an exact property filter.
2. Require exactly one matching page.
3. Block not-found or duplicate matches.
4. Update the exact `page_id` returned by the query.

## Quick Start: Codex

```bash
codex mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

Authenticate Notion locally before starting Codex:

```bash
ntn login
```

or:

```bash
export NOTION_API_TOKEN='<notion-token>'
codex
```

## Quick Start: Claude Code

```bash
claude mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

Authenticate Notion locally before starting Claude Code:

```bash
ntn login
```

or:

```bash
export NOTION_API_TOKEN='<notion-token>'
claude
```

## Quick Links

- MCP client installation: [`docs/client.md`](docs/client.md)
- AI agent client installer guide: [`docs/ai-install-client.md`](docs/ai-install-client.md)
- Local configuration guide: [`docs/configuration.md`](docs/configuration.md)
- Local development/server guide: [`docs/server.md`](docs/server.md)

## Tools

### Source Metadata Tools

Use these when you configure named Notion sources in local `config.json`.

- `notion_source_list`
- `notion_source_schema`
- `notion_source_update_schema`
- `notion_source_add_property`
- `notion_source_rename_property`
- `notion_source_remove_property`
- `notion_source_get_by_key`
- `notion_source_query`
- `notion_source_table`
- `notion_source_count`
- `notion_source_group_count`
- `notion_source_query_by_property`
- `notion_source_count_by_property`
- `notion_source_update_by_key`
- `notion_source_update_status_by_key`

### Generic Data Source Tools

Use these for raw `data_source_id` or simple aliases.

- `notion_db_schema`
- `notion_db_update_schema`
- `notion_db_add_property`
- `notion_db_rename_property`
- `notion_db_remove_property`
- `notion_db_query`
- `notion_db_table`
- `notion_db_count`
- `notion_db_group_count`
- `notion_db_query_by_property`
- `notion_db_count_by_property`
- `notion_db_get_by_property`
- `notion_db_update_page`
- `notion_db_update_by_property`

For agent-friendly reads, prefer the table/count tools over raw `notion_db_query`.
They convert Notion property objects into simple JSON values, so questions like
“list all No values where Status is QC” or “count rows by Status” do not require
local scripts.
Schema tools include select/status/multi-select option names so agents can
choose valid update and filter values without guessing.

Example:

```json
{
  "source": "task_list",
  "property_name": "Status",
  "value": "QC",
  "properties": ["No", "Task", "Status"],
  "max_results": 50
}
```

Schema updates are supported through MCP. To add a Notion ID/Unique ID property
without a prefix:

```json
{
  "source": "task_list",
  "name": "No",
  "type": "unique_id"
}
```

Use `notion_source_update_schema` or `notion_db_update_schema` when you need to
pass a raw Notion schema patch for advanced property types.

## Local Config

Create a client-side config file when you want aliases such as `task_list`:

```bash
mkdir -p ~/.config/notion-db-mcp
cat > ~/.config/notion-db-mcp/config.json <<'JSON'
{
  "data_sources": {
    "task_list": {
      "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "name": "Task List",
      "key_property": "No",
      "title_property": "Task",
      "status_property": "Status"
    }
  }
}
JSON
```

Because the MCP server runs locally in stdio mode, this file stays on the client machine.

For shorter config commands, install the CLI globally from GitHub:

```bash
npm install -g github:trisetiohidayat/notion-mcp
```

Then use:

```bash
notion-mcp config list
notion-mcp config discover
notion-mcp config add task_list '<notion-database-url-or-data-source-id>' --key No --status Status
```

## Local UI

For visual mapping management, start the local config UI:

```bash
notion-mcp ui
```

By default it listens only on `http://127.0.0.1:3099`. Override the bind address only when you know why:

```bash
NOTION_MCP_UI_HOST=127.0.0.1 NOTION_MCP_UI_PORT=3099 notion-mcp ui
```

The UI manages the same client-side config file as `notion-mcp config ...`. It can list mappings, discover accessible Notion data sources, add mappings, refresh source metadata, and remove mappings with confirmation. It does not display Notion tokens.

You can also manage this file with the built-in CLI:

```bash
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config list
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config discover
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config add task_list '<notion-database-url-or-data-source-id>' --key No --status Status
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config refresh task_list
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config remove task_list --yes
```

## Auth Model

The helper reads Notion bearer tokens in this order:

1. `NOTION_TOKEN`
2. `NOTION_API_TOKEN`
3. `NOTION_API_KEY`
4. `NOTION_ACCESS_TOKEN`
5. Official `ntn` file-based auth, when available

If `ntn login` succeeds but the MCP tool returns `Missing Notion token`, set `NOTION_API_TOKEN` as a fallback.

## CLI Examples

```bash
npm install
cp config.example.json config.json
export NOTION_API_TOKEN='<your-notion-token>'

./bin/db.js schema example_tasks
./bin/db.js get example_tasks No 38
./bin/db.js update example_tasks No 38 Status Done
./bin/db.js update-props example_tasks No 38 Summary="Done: verified"
./bin/notion-mcp.js config list
```

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
