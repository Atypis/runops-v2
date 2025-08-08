# Director MCP Server (runops-demo)

This MCP server exposes the consolidated Director tools under `runops-demo/lib/director` to Cursor/Claude via the Model Context Protocol.

## Install

```bash
# From repo root
cd /Users/a1984/runops-v2
# Install MCP SDK in runops-demo (needed to run the server)
(cd runops-demo && npm install @modelcontextprotocol/sdk dotenv)
```

## Run (manual test)

```bash
node /Users/a1984/runops-v2/runops-demo/mcp/server.js
```

## Cursor configuration

Open Cursor → Settings → MCP → Add New Global MCP Server and use:

```json
{
  "mcpServers": {
    "director": {
      "command": "node",
      "args": ["/Users/a1984/runops-v2/runops-demo/mcp/server.js"],
      "env": {
        "NODE_ENV": "development",
        "DEFAULT_USER_ID": "default-user",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}",
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}"
      }
    }
  }
}
```

Tips:
- You can also set env in your shell or `.env` files; the server loads `runops-demo/.env` and repo-root `.env` automatically.
- First call should be `mcp_set_workflow_context` with your workflow ID.

## Useful tools
- `mcp_set_workflow_context` – set workflow/user
- `mcp_get_current_context` – dump nodes/vars/browser state
- `mcp_list_workflows` – list recent workflows
- All Director tools like `add_or_replace_nodes`, `execute_nodes`, `browser_action`, etc.

```json
{
  "name": "mcp_set_workflow_context",
  "arguments": {"workflow_id": "my-workflow", "create_if_missing": true}
}
```

## Screenshot path
Screenshots from `mcp_browser_screenshot` are saved under `runops-demo/temp/screenshots/`.


