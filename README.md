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
