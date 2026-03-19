# HTTP Streaming & Server-Sent Events

## Normal HTTP vs Streaming HTTP

In a normal HTTP request/response cycle, the server waits until it has the full response ready, then sends it all at once:

```
Client → POST /api/chat ──────────────────────────────→ Server
Client ←────────────────── 200 OK { "reply": "..." } ← Server
         (nothing until complete)
```

With streaming, the server opens the connection and sends data incrementally as it becomes available:

```
Client → POST /api/chat ───────────────────────────────→ Server
Client ← 200 OK (headers only, connection stays open) ← Server
Client ← chunk: "Hello"                               ← Server
Client ← chunk: " there"                              ← Server
Client ← chunk: ", how can I help?"                   ← Server
Client ← (connection closes)                          ← Server
```

The key difference: `Content-Type: text/event-stream` tells the browser not to buffer — deliver bytes as they arrive.

---

## Server-Sent Events (SSE) Format

SSE is a specific text format layered on top of chunked HTTP. Each event looks like this:

```
event: <event-type>\n
data: <json-payload>\n
\n                      ← blank line signals end of event
```

Real example from this app:

```
event: text
data: {"text":"Hello, I can help"}

event: text
data: {"text":" with that."}

event: tool
data: {"tool":"search_files","input":{"query":"budget"}}

```

Rules:
- `event:` line sets the type (defaults to `"message"` if omitted)
- `data:` line holds the payload — always one line (no newlines in the JSON)
- Blank line flushes/dispatches the event to the reader
- Multiple `data:` lines are concatenated (rarely used)

---

## The Three-Layer Stack in This App

```
Anthropic API  ──SSE──→  Next.js route  ──SSE──→  Browser (ChatBox)
  (verbose)               (translates)             (simple)
```

### Layer 1 — Anthropic → API Route

Anthropic's SSE is verbose. A single streamed response produces many event types:

| Anthropic event type       | Meaning                                      |
|----------------------------|----------------------------------------------|
| `message_start`            | Response metadata (model, usage estimate)    |
| `content_block_start`      | A new content block opened (text or tool)    |
| `content_block_delta`      | A chunk of text or partial tool input JSON   |
| `content_block_stop`       | Block is complete                            |
| `message_delta`            | Final token count, stop reason               |
| `message_stop`             | Stream is done                               |

### Layer 2 — API Route Translation

The route strips all that down to two event types the browser actually cares about:

| Custom event | Payload                              | When emitted              |
|--------------|--------------------------------------|---------------------------|
| `text`       | `{ text: string }`                   | Every `text_delta`        |
| `tool`       | `{ tool: string, input: unknown }`   | At `content_block_stop`   |
| `error`      | `{ error: string }`                  | If Anthropic sends error  |

### Layer 3 — Browser (`ChatBox.tsx`)

The browser reads the stream using `res.body.getReader()` — a Web Streams API reader that yields raw `Uint8Array` chunks. These are decoded to text, split on `\n`, and parsed line-by-line to extract event type + data.

---

## Reading SSE Manually (what ChatBox does)

The browser doesn't use the native `EventSource` API here (that only supports GET requests). Instead the stream is read manually:

```ts
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let pendingEventType = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // value is Uint8Array — decode to string, streaming mode preserves multi-byte chars
  buffer += decoder.decode(value, { stream: true });

  // Split on newlines but keep incomplete last line in buffer
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      pendingEventType = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      const payload = JSON.parse(line.slice(6));
      // handle based on pendingEventType...
      pendingEventType = "";
    }
  }
}
```

Key detail: `buffer = lines.pop()` — a network chunk boundary can land in the middle of a line. The incomplete line stays buffered until the next chunk completes it.

---

## Why Not Use `EventSource`?

The native browser `EventSource` API handles SSE automatically but has two limitations:

1. **GET only** — can't send a POST body (no way to pass the conversation history)
2. **Auto-reconnects** — it retries on disconnect, which you don't want for a one-shot AI response

So this app uses `fetch` with manual stream reading, which gives full control over the request method, headers, body, and lifecycle.

---

## Cleaning Up: Aborting the Stream

Streams must be explicitly cancelled or they leak. Two mechanisms handle this:

**`AbortController`** — passed as `signal` to `fetch`. Calling `.abort()` cancels the request at the network level, which causes `reader.read()` to throw an `AbortError`.

**React `useEffect` cleanup** — runs when the component unmounts:

```ts
const abortRef = useRef<AbortController | null>(null);

useEffect(() => {
  return () => {
    abortRef.current?.abort();  // fires on unmount
  };
}, []);
```

Since `ChatBox` receives `key={activeSessionId}`, switching sessions unmounts the old instance — which triggers cleanup and cancels any in-flight stream automatically.

The `AbortError` is caught and silently ignored (it's intentional, not a real error):

```ts
} catch (err) {
  if ((err as Error).name === "AbortError") return;
  // handle real errors...
}
```

---

## Backpressure

One subtlety: `reader.read()` respects TCP backpressure. If the browser's internal queue fills up (e.g. the JS thread is busy), it stops pulling from the socket — which signals the server to slow down. In practice this doesn't matter for text-sized AI responses, but it's why `ReadableStream` is the right primitive here rather than buffering everything in memory.
