# AI Agent Guide: Install MCP Client

Use this guide when a user asks an AI coding agent to install the Notion DB MCP client.

Use local stdio via `npx`. Keep Notion auth and source mappings on the client machine.

## Codex Install

```bash
codex mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

For reproducible installs, pin the GitHub package:

```bash
codex mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp#<commit-sha> \
  notion-mcp serve
```

## Claude Code Install

```bash
claude mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

## Local Auth

Tell the user to authenticate Notion on the same machine and OS user that runs the MCP client.

Preferred:

```bash
ntn login
```

Fallback:

```bash
export NOTION_API_TOKEN='<notion-token>'
```

The server checks `NOTION_TOKEN`, `NOTION_API_TOKEN`, `NOTION_API_KEY`, `NOTION_ACCESS_TOKEN`, then `ntn` file-based auth.

## Local Source Mapping

Tell the user to keep database aliases on the client machine:

For short CLI commands, suggest optional global install:

```bash
npm install -g github:trisetiohidayat/notion-mcp
```

Then mapping commands can use `notion-mcp config ...` directly.

Prefer the CLI for mapping changes:

```bash
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config list
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config discover
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config add task_list '<notion-database-url-or-data-source-id>' --key No --status Status
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config refresh task_list
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp config remove task_list --yes
```

Only run `config add`, `config refresh`, or `config remove` when the user explicitly asks to change local mapping.

If the user asks for a visual or manual mapping workflow, suggest the local UI:

```bash
npx --yes --package github:trisetiohidayat/notion-mcp notion-mcp ui
```

Explain that it starts on `http://127.0.0.1:3099` by default, manages only local config, and is not the MCP transport.

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

The server reads config from `NOTION_DB_CONFIG`, `config.json` in the current working directory, or `~/.config/notion-db-mcp/config.json`.

## Notion Token Source

If the user does not have `NOTION_API_TOKEN`, tell them to create a Notion internal integration:

1. Open <https://www.notion.so/my-integrations>.
2. Create a new internal connection/integration.
3. Copy the integration secret and set it as `NOTION_API_TOKEN`.
4. In the connection settings, add the required pages/databases from the `Content access` tab. New connections may have no content access by default.
5. Alternatively, open the target Notion database/page and use `Add connections`/`Connections` to connect that content to the integration.

Do not assume the token can access every database. Notion only allows the integration to access pages/databases explicitly shared with it.

## Verify

Codex:

```bash
codex mcp list
codex mcp get notion_db
```

Claude Code:

```bash
claude mcp list
claude mcp get notion_db
```

Expected tools:

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
