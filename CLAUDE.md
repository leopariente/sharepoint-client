# SharePoint Next — Claude Context

## Project Purpose
AI-powered chat interface for querying SharePoint document libraries. Users converse with Claude, which can call SharePoint MCP tools to search and retrieve files. Sessions are persisted locally in the browser.

## Tech Stack
- **Framework**: Next.js (App Router), React 19, TypeScript 5
- **Styling**: Tailwind CSS v4
- **AI**: Anthropic Messages API (`claude-sonnet-4-6`) via server-side fetch — no SDK package
- **MCP**: Anthropic's `mcp-client-2025-04-04` beta, configured via `mcp_servers` in the API request
- **Markdown**: `react-markdown` + `react-syntax-highlighter` (Prism / oneLight theme)
- **Storage**: Browser `localStorage` only — no database

## File Map

```
app/
  page.tsx                  # Root client component — layout, sidebar, session orchestration
  layout.tsx                # HTML shell, Geist fonts, global metadata
  globals.css               # Tailwind global styles

  components/
    ChatBox.tsx             # Message list + streaming logic; remounted per session via key=
    ChatInput.tsx           # Controlled textarea + send button; disabled while streaming
    SessionSidebar.tsx      # Session list; fixed desktop, overlay mobile

  hooks/
    useChatSessions.ts      # All session CRUD + localStorage persistence; exposes hydrated flag

  api/
    chat/route.ts           # Server-only POST — proxies to Anthropic, re-emits custom SSE

  lib/
    processSSEStream.ts     # Client-side SSE parser — dispatches onText / onTool / onStreamError

types/
  index.ts                  # All shared TypeScript interfaces (ChatMessage, ChatSession, API shapes)
```

## Architecture & Data Flow

```
User types → ChatInput (onChange) → ChatBox state
User sends → ChatBox.sendMessage()
  → append user msg to state
  → POST /api/chat  { messages: history }
      → route.ts forwards to Anthropic with MCP config
      → Anthropic streams SSE back
      → route.ts translates to custom SSE (event: text / tool / error)
  → processSSEStream() reads custom events
      → onText: patches placeholder assistant message content in-place
      → onTool: appends to placeholder's toolCalls array
  → on finish: onMessagesChange() → useChatSessions → localStorage
```

## Streaming Pattern
`route.ts` emits three custom SSE event types:
- `event: text` + `data: { text: string }` — streamed text delta
- `event: tool` + `data: { tool: string, input: unknown }` — complete tool call (emitted on `content_block_stop`)
- `event: error` + `data: { error: string }`

`ChatBox` creates an empty placeholder assistant message at `placeholderIndex`, then patches it in-place via `setMessages` during streaming. This avoids string concatenation in a ref.

## MCP Integration
- Enabled when `SHAREPOINT_MCP_URL` env var is set
- Adds `mcp_servers: [{ type: "url", url, name: "sharepoint" }]` to the Anthropic request body
- Requires `anthropic-beta: mcp-client-2025-04-04` header (added automatically)
- Tool calls surface in the stream as `mcp_tool_use` content blocks
- App shows tool names as badges in the message UI; inputs/outputs are stored in `toolCalls` on `ChatMessage` but not currently rendered in detail

## State & Persistence
- `useChatSessions` is the single source of truth for all sessions
- Persisted to `localStorage` key `sharepoint-chat-sessions`
- Max 50 sessions (oldest dropped on overflow)
- `hydrated` flag prevents SSR mismatch — root page renders a loading state until `useEffect` hydrates
- `ChatBox` is remounted (via `key={activeSessionId}`) on session switch to cleanly reset streaming state

## Environment Variables
| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API authentication |
| `SHAREPOINT_MCP_URL` | No | MCP server URL; omit to run as plain Claude chat |

Set these in `.env.local` (never committed).

## Conventions
- All client components begin with `"use client"` — components in `app/components/` and `app/hooks/` are client-side
- `app/api/` and `app/lib/` are server-only (no `"use client"`)
- All shared TypeScript types live in `types/index.ts` — do not scatter interfaces across component files
- Tailwind utility classes only — no CSS modules or styled-components
- No Anthropic SDK package — raw `fetch` to `https://api.anthropic.com/v1/messages`

## Dev Commands
```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run lint     # ESLint check
```
