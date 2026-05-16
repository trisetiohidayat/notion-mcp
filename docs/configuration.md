# Local Configuration

Configuration is client-side. In the recommended stdio setup, the MCP server runs on the same machine as Codex or Claude Code and reads local config directly.

## Config Location

The server reads the first config file found in this order:

1. `NOTION_DB_CONFIG`, if set
2. `config.json` in the current working directory
3. `~/.config/notion-db-mcp/config.json`

Recommended personal location:

```bash
mkdir -p ~/.config/notion-db-mcp
$EDITOR ~/.config/notion-db-mcp/config.json
```

## Simple Aliases

Use `aliases` when you only need a short name for a Notion `data_source_id`:

```json
{
  "aliases": {
    "tasks": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

Then use `tasks` wherever a tool asks for `data_source_id`.

## Rich Data Source Metadata

Use `data_sources` when you have many Notion databases/tables and want default key/title/status properties:

```json
{
  "data_sources": {
    "tasks": {
      "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "name": "Tasks",
      "description": "Implementation task database",
      "key_property": "No",
      "title_property": "Task",
      "status_property": "Status"
    },
    "customers": {
      "id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
      "name": "Customers",
      "description": "Customer master database",
      "key_property": "Customer Code",
      "title_property": "Name"
    }
  }
}
```

With this metadata, source tools can be called with fewer arguments:

```json
{
  "source": "tasks",
  "key_value": 38
}
```

## Adding a New Database

1. Get the Notion `data_source_id`.
2. Ensure your Notion auth has access to that database.
3. Add a new entry in `~/.config/notion-db-mcp/config.json`.
4. Restart the MCP client if the running server does not pick up the new file immediately.
5. Verify with `notion_db_schema` or `notion_source_schema`.

## Getting Content Access

If using an internal integration token:

1. Open <https://www.notion.so/my-integrations>.
2. Open the connection/integration.
3. Add pages/databases in the `Content access` tab.
4. Or open the Notion database/page and use `Add connections`/`Connections`.

New connections may have no content access by default.

## Resolving Notion IDs

Notion database URLs usually contain a database ID. Newer Notion API endpoints operate on data source IDs. You can resolve a database ID with the official Notion CLI:

```bash
ntn datasources resolve <database_id> --json
```

Use the returned `data_sources[0].id` in this project's config.
