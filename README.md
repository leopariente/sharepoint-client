# SharePoint Assistant

A conversational AI chat app that lets you ask questions about your SharePoint library in plain English. Built with Next.js and Claude, it connects to SharePoint through an MCP server so Claude can read, search, and reason over your actual files.

---

## Features

- **Streaming responses** — text appears token-by-token as Claude generates it
- **Markdown rendering** — code blocks with syntax highlighting, lists, headers, links
- **Chat sessions** — multiple conversations, persisted in localStorage, with a collapsible sidebar
- **SharePoint integration** — Claude can search and read files directly via MCP

---

## Tech Stack

### Frontend
| Technology | Role |
|---|---|
| **Next.js 16** (App Router) | Framework — file-based routing, server components, API routes |
| **React 19** | UI library — component model, hooks, streaming state updates |
| **TypeScript** | Static typing across the full stack |
| **Tailwind CSS v4** | Utility-first styling |
| **react-markdown** | Renders Claude's markdown responses as structured HTML |
| **react-syntax-highlighter** (Prism) | Syntax-highlighted code blocks inside markdown |

### Backend
| Technology | Role |
|---|---|
| **Next.js API Route** (`/api/chat`) | Server-side proxy — keeps API keys off the client |
| **Anthropic Messages API** | Calls `claude-sonnet-4-6` with streaming enabled |
| **Server-Sent Events (SSE)** | Streams token chunks from server → browser in real time |
| **MCP (Model Context Protocol)** | Gives Claude a live connection to the SharePoint MCP server |

### Storage
| Technology | Role |
|---|---|
| **localStorage** | Persists chat sessions in the browser — no database needed |

---

## Project Structure

```
sharepoint-next/
├── app/
│   ├── api/chat/
│   │   └── route.ts          # Server-side proxy to Anthropic API (streaming)
│   ├── components/
│   │   ├── ChatBox.tsx        # Message list, SSE stream reader, markdown renderer
│   │   └── SessionSidebar.tsx # Session list UI with create/delete
│   ├── hooks/
│   │   └── useChatSessions.ts # localStorage read/write, session state management
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Root — composes sidebar + chat, wires session hook
├── docs/
│   └── streaming-http.md      # Deep-dive on SSE and HTTP streaming
├── types/
│   └── index.ts               # Shared TypeScript interfaces
└── .env.local                 # ANTHROPIC_API_KEY, SHAREPOINT_MCP_URL (not committed)
```

---

## How It Works

### Request flow

```
Browser (ChatBox)
  │  POST /api/chat  { messages: [...] }
  ▼
Next.js API Route (/api/chat)
  │  POST https://api.anthropic.com/v1/messages
  │  { stream: true, mcp_servers: [...] }
  ▼
Anthropic API
  │  SSE stream of token deltas + tool events
  ▼
Next.js API Route  (translates Anthropic SSE → simplified SSE)
  │  event: text  { text: "chunk" }
  │  event: tool  { tool: "name", input: {...} }
  ▼
Browser (ChatBox reads stream, updates message in-place)
```

### Why a server-side proxy?

The API route exists for one key reason: `ANTHROPIC_API_KEY` must never be sent to the browser. Next.js environment variables without the `NEXT_PUBLIC_` prefix are server-only, so the key is only accessible inside `route.ts`. The browser only ever talks to `/api/chat`.

### Streaming

The API route adds `"stream": true` to the Anthropic request, then pipes the response through a `ReadableStream`. It translates Anthropic's verbose SSE format (6+ event types) into two simple ones — `text` and `tool` — which the browser reads with `fetch` + `res.body.getReader()`. See [`docs/streaming-http.md`](docs/streaming-http.md) for a full breakdown.

### Chat sessions

`useChatSessions` manages an array of `ChatSession` objects in localStorage. It's SSR-safe: it initializes to an empty array on the server and hydrates from localStorage in a `useEffect`. Passing `key={activeSessionId}` to `ChatBox` means React fully unmounts and remounts the component on session switch — the simplest way to reset all streaming state cleanly.

---

## SharePoint MCP Integration

### What is MCP?

The Model Context Protocol (MCP) is an open standard that lets AI models connect to external data sources and tools through a uniform interface. Instead of hardcoding SharePoint API calls into the app, Claude connects to a running MCP server that exposes SharePoint as a set of callable tools. Claude decides when and how to call them based on the conversation.

### How it works in this app

The API route includes an `mcp_servers` field in the Anthropic request body:

```ts
requestBody.mcp_servers = [
  {
    type: "url",
    url: process.env.SHAREPOINT_MCP_URL,
    name: "sharepoint",
  },
];
```

This tells Claude: "there is an MCP server at this URL named `sharepoint`, and you can use its tools." Claude connects to it automatically during the API call — the app never calls SharePoint directly.

The `anthropic-beta: mcp-client-2025-04-04` header is required to enable this feature, as it is currently in beta.

### What the MCP server exposes

A SharePoint MCP server typically exposes tools such as:

| Tool | What it does |
|---|---|
| `search_files` | Full-text search across the SharePoint library |
| `get_file` | Retrieve the content of a specific file by path or ID |
| `list_files` | List files in a folder or library |
| `get_file_metadata` | Retrieve metadata (author, modified date, etc.) |

The exact tools depend on which MCP server implementation you're running. Claude reads the tool definitions at inference time and chooses which ones to call based on the user's question.

### Tool call flow

When Claude needs to look something up, the following happens mid-stream:

```
1. Claude decides to call a tool (e.g. search_files with query "budget report")
2. Anthropic sends a content_block_start event with type: "mcp_tool_use"
3. The tool input JSON arrives in fragments via input_json_delta events
4. Anthropic executes the tool against the MCP server and gets results back
5. Results are fed back into Claude's context as mcp_tool_result blocks
6. Claude continues generating its text response, now informed by the results
```

From the app's perspective, steps 4–5 happen inside the Anthropic API call — the MCP server is called by Anthropic's infrastructure, not by the Next.js route. The route just sees the completed tool result arrive as another SSE event and surfaces the tool name as a badge in the UI.

### Setting up the MCP server

Set `SHAREPOINT_MCP_URL` in `.env.local` to the URL of your running MCP server:

```env
SHAREPOINT_MCP_URL=https://your-mcp-server.example.com/mcp
```

If this variable is not set, the app still works — it just calls Claude without any SharePoint tools, so Claude answers from its training data only.

---

## Setup

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- (Optional) A running SharePoint MCP server

### Install

```bash
git clone <repo-url>
cd sharepoint-next
npm install
```

### Environment variables

Create `.env.local` in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-...
SHAREPOINT_MCP_URL=https://your-mcp-server/mcp   # optional
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key — server-side only, never exposed to browser |
| `SHAREPOINT_MCP_URL` | No | URL of the SharePoint MCP server. If omitted, MCP tools are disabled |
