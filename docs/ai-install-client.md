# AI Agent Guide: Install MCP Client

Use this guide when a user asks an AI coding agent to install the Notion DB MCP client.

The user does **not** need to clone or run the MCP server locally when using a published remote MCP endpoint.

## Required Inputs

Ask or infer these values:

- `MCP_SERVER_URL`: remote MCP URL, for example `https://mcp.example.com/mcp`
- `NOTION_DB_MCP_TOKEN`: MCP bridge bearer token
- `NOTION_API_TOKEN`: Notion API token available on the client machine, when the server uses client-token/dual-header mode

Do not ask the user to paste secrets into repo files. Prefer shell environment variables or client-native secret handling.

## Notion Token Source

If the user does not have `NOTION_API_TOKEN`, tell them to create a Notion internal integration:

1. Open <https://www.notion.so/my-integrations>.
2. Create a new internal integration.
3. Copy the integration secret and set it as `NOTION_API_TOKEN`.
4. Share or connect the target Notion database/page with that integration.

Do not assume the token can access every database. Notion only allows the integration to access pages/databases explicitly shared with it.

## About `ntn` Login

The official Notion CLI (`ntn`) can authenticate the local machine with `ntn login`, but a remote MCP bridge still needs the MCP client to send a Notion token in `X-Notion-Token`.

Do not assume `ntn login` is enough for remote MCP client setup. For remote Codex or Claude Code clients, prefer `NOTION_API_TOKEN` from a Notion internal integration.

Use `ntn` auth only when the MCP server runs locally on the same machine and the server implementation can read `ntn` credentials.

## Codex: Local All-In-One via `npx`

Use this when the user wants the MCP client to start the MCP server locally instead of connecting to a remote HTTPS server:

```bash
codex mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

Before starting Codex, provide local Notion auth:

```bash
export NOTION_API_TOKEN='<notion-token>'
codex
```

If `ntn login` has already been completed on the same machine and the local server can read `ntn` credentials, `NOTION_API_TOKEN` may not be required.

For private GitHub repositories, the machine must already have GitHub access for `npm`/`git`.

## Claude Code: Local All-In-One via `npx`

Use this when the user wants Claude Code to start the MCP server locally:

```bash
claude mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

Before starting Claude Code, provide local Notion auth:

```bash
export NOTION_API_TOKEN='<notion-token>'
claude
```

## Codex: No-Clone Install

Set tokens in the shell that starts Codex:

```bash
export NOTION_DB_MCP_TOKEN='<mcp-access-token>'
export NOTION_API_TOKEN='<notion-token>'
```

Add the remote MCP server:

```bash
codex mcp add notion_db \
  --url https://mcp.example.com/mcp \
  --bearer-token-env-var NOTION_DB_MCP_TOKEN
```

If the server expects Notion auth from the client, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.notion_db.env_http_headers]
X-Notion-Token = "NOTION_API_TOKEN"
```

Restart Codex.

## Claude Code: No-Clone Install

If the server already holds Notion auth:

```bash
claude mcp add --transport http \
  --header "Authorization: Bearer <mcp-access-token>" \
  notion_db https://mcp.example.com/mcp
```

If the client should send its own Notion token:

```bash
claude mcp add --transport http \
  --header "Authorization: Bearer <mcp-access-token>" \
  --header "X-Notion-Token: <notion-token>" \
  notion_db https://mcp.example.com/mcp
```

Prefer `claude mcp add-json` with environment variable expansion if literal tokens should not appear in shell history:

```bash
export MCP_SERVER_URL='https://mcp.example.com/mcp'
export NOTION_DB_MCP_TOKEN='<mcp-access-token>'
export NOTION_API_TOKEN='<notion-token>'

claude mcp add-json notion_db '{"type":"http","url":"${MCP_SERVER_URL}","headers":{"Authorization":"Bearer ${NOTION_DB_MCP_TOKEN}","X-Notion-Token":"${NOTION_API_TOKEN}"}}'
```

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

Inside Claude Code, also check:

```text
/mcp
```

Expected MCP tools after client restart:

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

## Optional Codex Installer Script

If a checkout of this repository already exists, this script can write the Codex config automatically:

```bash
NOTION_MCP_SERVER_URL="https://mcp.example.com/mcp" \
  ./scripts/install-codex-client.sh
```

The script does not store token values.

## Troubleshooting

- If tools do not appear, restart the MCP client after setting env vars.
- If calls return `401 Unauthorized MCP bearer token`, check `NOTION_DB_MCP_TOKEN`.
- If calls return a Notion API auth error, check `NOTION_API_TOKEN` or `X-Notion-Token`.
- If a source alias is unknown, the server-side `config.json` needs that source configured.
