// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ToolCall {
  tool: string;
  input: unknown;
}

export interface ChatMessage extends Message {
  toolCalls?: ToolCall[];
}

// ---------------------------------------------------------------------------
// Chat Sessions
// ---------------------------------------------------------------------------

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Anthropic API
// ---------------------------------------------------------------------------

export interface AnthropicContentBlock {
  type: "text" | "mcp_tool_use" | "mcp_tool_result";
  text?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

export interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Anthropic Streaming
// ---------------------------------------------------------------------------

export interface AnthropicStreamEvent {
  type: string;
  index?: number;
  content_block?: { type: string; name?: string; id?: string; text?: string };
  delta?: { type: string; text?: string; partial_json?: string; stop_reason?: string };
}

export interface StreamTextEvent {
  text: string;
}

export interface StreamToolEvent {
  tool: string;
  input: unknown;
}

// ---------------------------------------------------------------------------
// API route — request / response shapes
// ---------------------------------------------------------------------------

export interface ChatRequestBody {
  messages: Message[];
}

export interface ChatResponseBody {
  reply: string;
  toolCalls: ToolCall[];
}

export interface ErrorResponseBody {
  error: string;
}
