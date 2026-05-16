# MCP Server Installation

This guide installs the Notion DB MCP server on the machine that will host the MCP server.

No workspace-specific IDs, tokens, or absolute private paths are required in the repository. Keep runtime config in ignored local files or environment variables.

## Requirements

- Node.js 18+
- npm
- A Notion token source:
  - `NOTION_API_TOKEN`, `NOTION_TOKEN`, or official `ntn` file-based auth
- Optional for HTTPS publishing:
  - Nginx or another reverse proxy
  - TLS certificate manager such as Certbot

## Install

```bash
git clone <your-repo-url> notion-db-mcp
cd notion-db-mcp
npm install
cp config.example.json config.json
```

Edit `config.json` for your Notion data sources. See [`configuration.md`](configuration.md).

## Run as Local stdio MCP Server

Use this when the MCP client runs on the same machine:

```bash
./bin/notion-db-mcp.js
```

Register with Codex:

```bash
codex mcp add notion_db_precise -- /path/to/notion-db-mcp/bin/notion-db-mcp.js
```

If you use relative config files, set the MCP server working directory in your client config:

```toml
[mcp_servers.notion_db_precise]
command = "/path/to/notion-db-mcp/bin/notion-db-mcp.js"
cwd = "/path/to/notion-db-mcp"
```

## Run as Streamable HTTP MCP Server

Use this when remote MCP clients connect over HTTP(S).

### Mode A: Server Holds Notion Auth

The server uses `NOTION_API_TOKEN`, `NOTION_TOKEN`, or official `ntn` auth available on the server.

```bash
export MCP_BEARER_TOKEN='<long-random-mcp-token>'
export NOTION_API_TOKEN='<notion-token-available-on-server>'
HOST=127.0.0.1 MCP_PORT=3088 ./bin/notion-db-mcp-http.js
```

Clients send only:

```text
Authorization: Bearer <long-random-mcp-token>
```

### Mode B: Client Sends Notion Token Per Request

Use this when the Notion token should stay with the client and the server is only a bridge.

```bash
export MCP_BEARER_TOKEN='<long-random-mcp-token>'
MCP_AUTH_MODE=dual_header HOST=127.0.0.1 MCP_PORT=3088 ./bin/notion-db-mcp-http.js
```

Clients send both:

```text
Authorization: Bearer <long-random-mcp-token>
X-Notion-Token: <client-notion-token>
```

This mode requires HTTPS or a private tunnel because the Notion token is sent over the network.

## systemd Example

Create a local env file outside git, for example:

```bash
cat > .mcp-env <<'EOF_ENV'
MCP_BEARER_TOKEN=<long-random-mcp-token>
MCP_AUTH_MODE=dual_header
HOST=127.0.0.1
MCP_PORT=3088
EOF_ENV
chmod 600 .mcp-env
```

Example unit:

```ini
[Unit]
Description=Notion DB Precise HTTP MCP Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/notion-db-mcp
EnvironmentFile=/path/to/notion-db-mcp/.mcp-env
ExecStart=/path/to/notion-db-mcp/bin/notion-db-mcp-http.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now notion-db-mcp-http.service
```

## Nginx HTTPS Example

Replace `mcp.example.com` with your domain:

```nginx
server {
    listen 80;
    server_name mcp.example.com;

    location / {
        proxy_pass http://127.0.0.1:3088;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-Notion-Token $http_x_notion_token;

        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Issue a certificate:

```bash
sudo certbot --nginx -d mcp.example.com
```

## Server Health Check

```bash
curl https://mcp.example.com/health
```

Expected response:

```json
{"ok":true,"name":"notion-db-precise-http"}
```
