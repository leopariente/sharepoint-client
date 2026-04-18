import type { StreamTextEvent, StreamToolEvent } from "@/types";

export async function processSSEStream(
  body: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
  onTool: (tool: string, input: unknown) => void,
  onStreamError: (error: string) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pendingEventType = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        pendingEventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (pendingEventType === "text") {
          const { text } = JSON.parse(raw) as StreamTextEvent;
          onText(text);
        } else if (pendingEventType === "tool") {
          const { tool, input } = JSON.parse(raw) as StreamToolEvent;
          onTool(tool, input);
        } else if (pendingEventType === "error") {
          const { error } = JSON.parse(raw) as { error: string };
          onStreamError(error);
        }
        pendingEventType = "";
      }
    }
  }
}
