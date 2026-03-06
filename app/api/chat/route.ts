// Phase 3 concept: .env.local holds secrets — Next.js loads it automatically.
// Values WITHOUT the NEXT_PUBLIC_ prefix are ONLY available server-side (never sent to browser).
// This route runs on the server, so it can safely use ANTHROPIC_API_KEY.
//
// Phase 6 concept: mcp_servers tells Claude which MCP servers to connect to.
// The "anthropic-beta: mcp-client-2025-04-04" header unlocks this feature.
// Tool calls appear in data.content as blocks — we parse and forward them to the UI.

import type {
  Message,
  AnthropicContentBlock,
  ToolCall,
  ChatResponseBody,
} from "@/types";

export const dynamic = "force-dynamic";

export const POST = async (req: Request) => {
  const body = await req.json();

  // Phase 7: accept full conversation history instead of a single message
  const messages: Message[] = body.messages ?? [
    { role: "user", content: body.message ?? "Say hello." },
  ];

  const mcpUrl = process.env.SHAREPOINT_MCP_URL;

  // Build the request body — include mcp_servers only if the URL is configured
  const requestBody: Record<string, unknown> = {
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages,
  };

  if (mcpUrl) {
    requestBody.mcp_servers = [
      {
        type: "url",
        url: mcpUrl,
        name: "sharepoint",
      },
    ];
  }

  const headers: Record<string, string> = {
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };

  // Required beta header for MCP tool use
  if (mcpUrl) {
    headers["anthropic-beta"] = "mcp-client-2025-04-04";
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    return Response.json({ error }, { status: response.status });
  }

  const data = await response.json();

  // Phase 6: parse the content blocks array
  // Possible block types: "text", "mcp_tool_use", "mcp_tool_result"
  const textBlocks: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const block of (data.content ?? []) as AnthropicContentBlock[]) {
    if (block.type === "text" && block.text) {
      textBlocks.push(block.text);
    } else if (block.type === "mcp_tool_use") {
      toolCalls.push({ tool: block.name ?? "unknown", input: block.input });
    }
    // mcp_tool_result blocks contain raw tool output — Claude already digested them
  }

  return Response.json({
    reply: textBlocks.join("\n"),
    toolCalls,
  } satisfies ChatResponseBody);
};
