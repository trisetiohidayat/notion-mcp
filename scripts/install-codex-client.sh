#!/usr/bin/env bash
set -euo pipefail

SERVER_NAME="${NOTION_MCP_SERVER_NAME:-notion_db}"
SERVER_URL="${NOTION_MCP_SERVER_URL:-}"
MCP_TOKEN_ENV="${NOTION_MCP_TOKEN_ENV:-NOTION_DB_MCP_TOKEN}"
NOTION_TOKEN_ENV="${NOTION_MCP_NOTION_TOKEN_ENV:-NOTION_API_TOKEN}"
CONFIG_FILE="${CODEX_CONFIG_FILE:-$HOME/.codex/config.toml}"

usage() {
  cat <<USAGE
Install Codex MCP client config for Notion DB MCP.

Usage:
  NOTION_MCP_SERVER_URL=https://mcp.example.com/mcp ./scripts/install-codex-client.sh

Optional env vars:
  NOTION_MCP_SERVER_NAME       MCP server name in Codex config. Default: notion_db
  NOTION_MCP_TOKEN_ENV         Env var holding MCP bearer token. Default: NOTION_DB_MCP_TOKEN
  NOTION_MCP_NOTION_TOKEN_ENV  Env var holding Notion token. Default: NOTION_API_TOKEN
  CODEX_CONFIG_FILE            Codex config path. Default: ~/.codex/config.toml

This script does not ask for or store token values. It only configures env var names.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$SERVER_URL" ]]; then
  echo "ERROR: NOTION_MCP_SERVER_URL is required." >&2
  usage >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: codex CLI not found in PATH." >&2
  exit 1
fi

mkdir -p "$(dirname "$CONFIG_FILE")"
touch "$CONFIG_FILE"

if codex mcp get "$SERVER_NAME" >/dev/null 2>&1; then
  codex mcp remove "$SERVER_NAME" >/dev/null
fi

codex mcp add "$SERVER_NAME" --url "$SERVER_URL" --bearer-token-env-var "$MCP_TOKEN_ENV" >/dev/null

python3 - "$CONFIG_FILE" "$SERVER_NAME" "$NOTION_TOKEN_ENV" <<'PY'
import re
import sys
from pathlib import Path

config_path = Path(sys.argv[1]).expanduser()
server_name = sys.argv[2]
notion_token_env = sys.argv[3]
text = config_path.read_text()
header = f'[mcp_servers.{server_name}.env_http_headers]'
line = f'X-Notion-Token = "{notion_token_env}"'

if header in text:
    pattern = re.compile(rf'(\[mcp_servers\.{re.escape(server_name)}\.env_http_headers\]\n)(.*?)(?=\n\[|\Z)', re.S)
    def replace(match):
        body = match.group(2)
        if re.search(r'^X-Notion-Token\s*=', body, re.M):
            body = re.sub(r'^X-Notion-Token\s*=.*$', line, body, flags=re.M)
        else:
            body = body.rstrip() + '\n' + line + '\n'
        return match.group(1) + body
    text = pattern.sub(replace, text)
else:
    text = text.rstrip() + f'\n\n{header}\n{line}\n'

config_path.write_text(text)
PY

cat <<DONE
Installed Codex MCP client config.

Server name:          $SERVER_NAME
Server URL:           $SERVER_URL
MCP token env var:    $MCP_TOKEN_ENV
Notion token env var: $NOTION_TOKEN_ENV
Codex config:         $CONFIG_FILE

Before starting Codex, set these env vars in your shell:

  export $MCP_TOKEN_ENV='<mcp-access-token>'
  export $NOTION_TOKEN_ENV='<notion-token>'

Then restart Codex.
DONE
