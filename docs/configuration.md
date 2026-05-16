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

## CLI Management

Use the built-in CLI for common mapping tasks:

Optional global install for shorter commands:

```bash
npm install -g github:trisetiohidayat/notion-mcp
```

Then use:

```bash
notion-mcp config path
notion-mcp config list
notion-mcp config discover
notion-mcp config add task_list '<notion-database-url-or-data-source-id>' --key No --title Task --status Status
notion-mcp config refresh task_list
notion-mcp config remove task_list --yes
```

Without global install, use `npx`:

```bash
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config path
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config list
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config discover
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config add task_list '<notion-database-url-or-data-source-id>' --key No --title Task --status Status
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config refresh task_list
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config remove task_list --yes
```

`config add` resolves the URL/ID, fetches the Notion data source schema, guesses useful metadata, and writes local config.

`config discover` lists accessible databases/data sources for the current Notion auth. It only shows content the authenticated user/integration can access.

## Local UI Management

If you prefer a browser UI for manual mapping changes, run:

```bash
notion-mcp ui
```

The UI starts a local-only HTTP server at `http://127.0.0.1:3099` by default and manages the same config file as the CLI. It supports listing configured sources, discovering accessible Notion data sources, adding mappings, refreshing one source, and removing mappings with confirmation.

Optional environment overrides:

```bash
NOTION_MCP_UI_HOST=127.0.0.1 NOTION_MCP_UI_PORT=3099 notion-mcp ui
```

Do not bind the UI to a public interface unless you are on a trusted machine and network. The UI uses your local Notion auth but does not show Notion tokens.

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

## Reporting Queries

For agent-friendly reads, use the source-level table and count tools. They use
the local alias metadata and return simple JSON values instead of raw Notion
property objects.

Count rows by exact property match:

```json
{
  "source": "tasks",
  "property_name": "Status",
  "value": "QC"
}
```

List selected columns for exact property match:

```json
{
  "source": "tasks",
  "property_name": "Status",
  "value": "QC",
  "properties": ["No", "Task", "Status"],
  "max_results": 50
}
```

Use `max_results` on table-style tools when you want a bounded sample or top-N
answer instead of loading every matching page into the agent context.

Group counts by one property:

```json
{
  "source": "tasks",
  "group_property": "Status"
}
```

## Schema Changes

MCP tools can also update a Notion data source schema. Prefer source-level tools
when an alias is configured:

- `notion_source_add_property`
- `notion_source_rename_property`
- `notion_source_remove_property`
- `notion_source_update_schema`

Add a Notion ID/Unique ID property without a prefix:

```json
{
  "source": "tasks",
  "name": "No",
  "type": "unique_id"
}
```

To use a prefix, pass config:

```json
{
  "source": "tasks",
  "name": "Task ID",
  "type": "unique_id",
  "config": { "prefix": "TASK" }
}
```

Use the raw `notion_source_update_schema` tool for advanced Notion schema patch
objects. Removing a property is destructive and requires `confirm: true`.

## Adding a New Database

1. Ensure your Notion auth has access to that database.
2. Run `notion-mcp config add <alias> <notion-url-or-data-source-id>` from a checkout, or use `npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config add <alias> <notion-url-or-data-source-id>`.
3. Review `~/.config/notion-db-mcp/config.json`.
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
