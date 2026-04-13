# Temporal MCP Server

MCP server that connects to Temporal Cloud, giving AI assistants the ability to start workflows, monitor executions, send signals, query state, and manage lifecycle.

## Tools Exposed

| Tool | Description |
|------|-------------|
| `temporal_start_workflow` | Start a new workflow execution |
| `temporal_describe_workflow` | Get status, history, pending activities |
| `temporal_list_workflows` | List/filter executions via visibility queries |
| `temporal_signal_workflow` | Send async signals to running workflows |
| `temporal_query_workflow` | Synchronously query workflow state |
| `temporal_terminate_workflow` | Hard-stop a workflow (no cleanup) |
| `temporal_cancel_workflow` | Request graceful cancellation |
| `temporal_get_workflow_result` | Wait for and retrieve final result |

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your Temporal Cloud credentials
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TEMPORAL_ADDRESS` | Yes | Temporal Cloud gRPC endpoint |
| `TEMPORAL_NAMESPACE` | Yes | Your Temporal Cloud namespace |
| `TEMPORAL_API_KEY` | Yes | Temporal Cloud API key |

## Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Connect to Town

Add this server as a custom MCP server in Town:
1. Go to **Settings > MCP Servers**
2. Add a new server with command: `node dist/index.js`
3. Set the environment variables above
4. The 8 Temporal tools will appear in your workflows

## Connect to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "temporal": {
      "command": "node",
      "args": ["/path/to/temporal-mcp/dist/index.js"],
      "env": {
        "TEMPORAL_ADDRESS": "ap-northeast-1.aws.api.temporal.io:7233",
        "TEMPORAL_NAMESPACE": "quickstart-derekjami-878d5147.kydxq",
        "TEMPORAL_API_KEY": "your-key"
      }
    }
  }
}
```
