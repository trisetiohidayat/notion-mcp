# MCP Client Installation

This project is intended to run as a personal/local stdio MCP server. The MCP client starts the server on the same machine, so Notion auth and database mappings stay local.

## Codex

Install the MCP server without cloning the repo:

```bash
codex mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

Pin a commit when you want reproducible installs:

```bash
codex mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp#<commit-sha> \
  notion-mcp serve
```

Verify:

```bash
codex mcp list
codex mcp get notion_db
```

## Claude Code

Install the MCP server without cloning the repo:

```bash
claude mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

Verify:

```bash
claude mcp list
claude mcp get notion_db
```

Inside Claude Code, also check:

```text
/mcp
```

## Local Notion Auth

Authenticate Notion on the same machine and OS user that runs Codex or Claude Code.

Preferred local option:

```bash
ntn login
```

Fallback explicit token:

```bash
export NOTION_API_TOKEN='<notion-token>'
```

The server checks auth in this order:

1. `NOTION_TOKEN`
2. `NOTION_API_TOKEN`
3. `NOTION_API_KEY`
4. `NOTION_ACCESS_TOKEN`
5. `ntn` file-based auth

If `ntn login` succeeds but the MCP tool returns `Missing Notion token`, set `NOTION_API_TOKEN` as a fallback and restart the MCP client.

## Getting a Notion Token

Use a Notion internal integration token when you choose explicit token auth.

1. Open <https://www.notion.so/my-integrations>.
2. Create a new internal connection/integration.
3. Copy the integration secret and use it as `NOTION_API_TOKEN`.
4. Open the connection settings and grant content access from the `Content access` tab. New connections may have no content access by default.
5. Or open the target Notion database/page and use `Add connections`/`Connections` to connect that page/database to the integration.

The token only works for pages/databases that are shared with the integration.

## Local Source Mapping

Alias/source mapping belongs on the client machine because the server runs locally.

Create:

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

The server reads config from:

1. `NOTION_DB_CONFIG`, if set
2. `config.json` in the current working directory
3. `~/.config/notion-db-mcp/config.json`

Use `NOTION_DB_CONFIG` when you want an explicit path:

```bash
export NOTION_DB_CONFIG="$HOME/.config/notion-db-mcp/config.json"
```

## Expected Tools

After restart, the MCP client should see these tools:

- `notion_source_list`
- `notion_source_schema`
- `notion_source_get_by_key`
- `notion_source_update_by_key`
- `notion_source_update_status_by_key`
- `notion_db_schema`
- `notion_db_query`
- `notion_db_get_by_property`
- `notion_db_update_page`
- `notion_db_update_by_property`

## Troubleshooting

- If tools do not appear, restart the MCP client.
- If calls return `Missing Notion token`, run `ntn login` or set `NOTION_API_TOKEN`.
- If a source alias is unknown, check `~/.config/notion-db-mcp/config.json` or `NOTION_DB_CONFIG`.
- If Notion returns permission/object-not-found, connect the page/database to the integration in Notion.
