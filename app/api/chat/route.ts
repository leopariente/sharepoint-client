// Phase 3 concept: .env.local holds secrets — Next.js loads it automatically.
// Values WITHOUT the NEXT_PUBLIC_ prefix are ONLY available server-side (never sent to browser).
// This route runs on the server, so it can safely use ANTHROPIC_API_KEY.
//
// Phase 6 concept: mcp_servers tells Claude which MCP servers to connect to.
// The "anthropic-beta: mcp-client-2025-04-04" header unlocks this feature.
// Tool calls appear in data.content as blocks — we parse and forward them to the UI.
//
// Streaming: We proxy Anthropic's SSE stream, emitting two custom event types:
//   event: text  → { text: string }          (on every text_delta)
//   event: tool  → { tool: string, input: unknown }  (on content_block_stop for tool blocks)
//   event: error → { error: string }

import type { Message, AnthropicStreamEvent } from "@/types";

export const dynamic = "force-dynamic";

export const POST = async (req: Request) => {
  const body = await req.json();

  const messages: Message[] = body.messages ?? [
    { role: "user", content: body.message ?? "Say hello." },
  ];

  const mcpUrl = process.env.SHAREPOINT_MCP_URL;

  const requestBody: Record<string, unknown> = {
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    stream: true,
    messages,
  };

  if (mcpUrl) {
    requestBody.mcp_servers = [
      { type: "url", url: mcpUrl, name: "sharepoint" },
    ];
  }

  const headers: Record<string, string> = {
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };

  if (mcpUrl) {
    headers["anthropic-beta"] = "mcp-client-2025-04-04";
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!anthropicRes.ok) {
    const error = await anthropicRes.text();
    return Response.json({ error }, { status: anthropicRes.status });
  }

  // Map from content block index → { tool name, accumulated partial JSON }
  const blockMeta = new Map<number, { tool: string; partialJson: string }>();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const emit = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const reader = anthropicRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let pendingEventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              pendingEventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const rawData = line.slice(6).trim();
              if (rawData === "[DONE]") continue;

              let evt: AnthropicStreamEvent;
              try {
                evt = JSON.parse(rawData) as AnthropicStreamEvent;
              } catch {
                continue;
              }

              const evtType = evt.type ?? pendingEventType;

              if (evtType === "error") {
                emit("error", { error: rawData });
                continue;
              }

              // Track tool blocks so we can emit them when complete
              if (evtType === "content_block_start" && evt.index !== undefined) {
                const cb = evt.content_block;
                if (cb?.type === "mcp_tool_use" && cb.name) {
                  blockMeta.set(evt.index, { tool: cb.name, partialJson: "" });
                }
              }

              if (evtType === "content_block_delta" && evt.index !== undefined) {
                const delta = evt.delta;
                if (!delta) continue;

                if (delta.type === "text_delta" && delta.text) {
                  emit("text", { text: delta.text });
                } else if (delta.type === "input_json_delta" && delta.partial_json) {
                  const meta = blockMeta.get(evt.index);
                  if (meta) {
                    meta.partialJson += delta.partial_json;
                  }
                }
              }

              if (evtType === "content_block_stop" && evt.index !== undefined) {
                const meta = blockMeta.get(evt.index);
                if (meta) {
                  let input: unknown = {};
                  try {
                    input = JSON.parse(meta.partialJson);
                  } catch {
                    // leave as empty object
                  }
                  emit("tool", { tool: meta.tool, input });
                  blockMeta.delete(evt.index);
                }
              }

              pendingEventType = "";
            }
          }
        }
      } catch (err) {
        emit("error", { error: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
