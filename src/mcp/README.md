# Chess MCP Server

This chess-api project includes a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that allows AI agents to play chess games.

## Architecture

```
┌─────────────┐     GET /mcp      ┌──────────────────┐
│  AI Agent   │ ──────────────►  │ McpController    │
│ (Claude,    │                  │ SSE endpoint     │
│ Cursor, etc)│ ◄────────────── │ Session manager  │
└─────────────┘  JSON-RPC        └──────────────────┘
                    POST /mcp/message                     │
                                                       emits tool calls
                                                            ▼
                                                  ┌──────────────────┐
                                                  │ GameMcpProvider  │
                                                  │ • Tool definitions│
                                                  │ • JWT verification│
                                                  └────────┬─────────┘
                                                           │ delegates to
                                                           ▼
                                                  ┌──────────────────┐
                                                  │ GameMcpService   │
                                                  │ • Business logic │
                                                  │ • DB operations  │
                                                  └──────────────────┘
```

## Available Tools

| Tool | Description | Required Args |
|------|-------------|---------------|
| `create_game` | Create a new game or auto-match with waiting player | `duration` (JWT optional) |
| `list_games` | List recent games (paginated) | `skip`, `limit` |
| `get_game` | Get game details by ID | `gameId` |
| `get_board` | Get board state (FEN + visual array) | `gameId` |
| `make_move` | Make a move in algebraic notation | `gameId`, `move`, `playerId` (or JWT token) |
| `get_available_durations` | List available time controls | none |
| `claim_timeout` | Claim timeout win | `gameId`, `playerId` (or JWT token) |
| `get_player_info` | Get player stats | `userId` |

## Authentication Flow

### Option 1: JWT Token (Recommended)

Pass `token` or `accessToken` in every tool call argument. The service verifies the JWT and resolves the player identity from its `sub` claim. Alternatively, include `Authorization: Bearer <token>` on the initial `POST /mcp` connect request — the token is stored on the session and auto-injected into all tool calls.

```bash
# Step 1: Create guest user (one-time)
curl -s -X POST http://localhost:3000/auth/guests \
  -H "Content-Type: application/json"
# Response: { "id": "...", "token": "eyJhbGc..." }

# Step 2: Connect MCP with auth (auth sent on POST connect, not GET)
curl -sf -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":20241105}}'
# Response contains {"sessionId":"..."} in the SSE data
```

### Option 2: Pass Player ID Directly

Each tool call can include `playerId` directly:

```json
{
  "name": "create_game",
  "arguments": {
    "playerId": "507f1f77bcf86cd799439011",
    "duration": "5min"
  }
}
```

## Connection Flow (SSE)

The MCP protocol uses Server-Sent Events (SSE) for long-lived connections:

1. **Initialize:** POST `POST /mcp` with JSON-RPC `initialize` message (optionally with `Authorization: Bearer` header)
2. **Receive session:** Response includes `sessionId` via SSE
3. **Call tools:** Reuse the same HTTP transport for subsequent messages — no separate `/message` endpoint
4. **Auto-inject:** If a token was provided on connect, it's automatically passed to tool handlers

## Example Usage with Curl

```bash
# Get your bearer token
TOKEN=$(curl -sf -X POST http://localhost:3000/auth/guests \
  -H "Content-Type: application/json" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

# Initialize MCP server (returns sessionId)
INIT=$(curl -sf -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":20241105}}')

# Extract sessionId from response
SESSION=$(echo "$INIT" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

# Call tools via JSON-RPC on the same URL (transport reuses the session)
curl -sf -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "create_game",
      "arguments": { "duration": "5min" }
    }
  }'
```

## Resources

| Resource URI | Description |
|--------------|-------------|
| `chess://games/{id}` | Full game state |
| `chess://board/{id}` | Board visualization |

Resources are readable via MCP's `resources/read` method. Subscriptions are not yet implemented.

## Rate Limiting

MCP endpoints (`/mcp/*`) are exempt from rate limiting to allow agents to make rapid moves without hitting throttle limits.

## Real-Time Updates

When a game updates, the same broadcast mechanism used by the REST API's SSE endpoint (`/games/:id/sse`) also triggers notifications to any MCP subscribers connected via resource subscriptions.

## Running Tests

```bash
npm run test
# All 230 tests pass including existing game service tests
```
