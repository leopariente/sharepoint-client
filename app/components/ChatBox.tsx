"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ChatMessage, StreamTextEvent, StreamToolEvent } from "@/types";

interface ChatBoxProps {
  initialMessages?: ChatMessage[];
  onMessagesChange?: (msgs: ChatMessage[]) => void;
}

const ChatBox = ({ initialMessages = [], onMessagesChange }: ChatBoxProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-progress stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const sendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const userText = input.trim();
      if (!userText || isStreaming) return;

      const userMsg: ChatMessage = { role: "user", content: userText };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput("");
      setIsStreaming(true);

      // Placeholder assistant message updated in-place during streaming
      const placeholderIndex = history.length;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", toolCalls: [] },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      let accumulatedText = "";
      const accumulatedToolCalls: { tool: string; input: unknown }[] = [];

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({ error: "Unknown error" }));
          setMessages((prev) =>
            prev.map((m, i) =>
              i === placeholderIndex
                ? { ...m, content: `Error: ${data.error ?? "Something went wrong."}` }
                : m,
            ),
          );
          return;
        }

        const reader = res.body.getReader();
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
                accumulatedText += text;
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === placeholderIndex ? { ...m, content: accumulatedText } : m,
                  ),
                );
              } else if (pendingEventType === "tool") {
                const { tool, input } = JSON.parse(raw) as StreamToolEvent;
                accumulatedToolCalls.push({ tool, input });
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === placeholderIndex
                      ? { ...m, toolCalls: [...accumulatedToolCalls] }
                      : m,
                  ),
                );
              } else if (pendingEventType === "error") {
                const { error } = JSON.parse(raw) as { error: string };
                accumulatedText += `\n\n_Stream error: ${error}_`;
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === placeholderIndex ? { ...m, content: accumulatedText } : m,
                  ),
                );
              }

              pendingEventType = "";
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m, i) =>
            i === placeholderIndex
              ? { ...m, content: `Network error: ${String(err)}` }
              : m,
          ),
        );
      } finally {
        setIsStreaming(false);
        // Notify parent with final messages for localStorage persistence
        setMessages((prev) => {
          onMessagesChange?.(prev);
          return prev;
        });
      }
    },
    [input, isStreaming, messages, onMessagesChange],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-400 text-sm">Ask anything about the CS library...</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800 border border-gray-200"
              }`}
            >
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {msg.toolCalls.map((tc, j) => (
                    <span
                      key={j}
                      className="inline-block rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-600"
                    >
                      Used: {tc.tool}
                    </span>
                  ))}
                </div>
              )}

              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose-sm">
                  {msg.content === "" && isStreaming && i === messages.length - 1 ? (
                    <span className="inline-block w-2 h-4 bg-gray-500 animate-pulse rounded-sm" />
                  ) : (
                    <ReactMarkdown
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className ?? "");
                          const isBlock = !!match;
                          if (isBlock) {
                            return (
                              <SyntaxHighlighter
                                style={oneLight}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-lg !my-2 !text-xs"
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            );
                          }
                          return (
                            <code
                              className="bg-gray-200 text-gray-800 rounded px-1 py-0.5 text-xs font-mono"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="mb-2 list-disc pl-5 space-y-1">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="mb-2 list-decimal pl-5 space-y-1">{children}</ol>
                        ),
                        li: ({ children }) => <li>{children}</li>,
                        h1: ({ children }) => (
                          <h1 className="text-base font-bold mb-2 mt-3">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-sm font-bold mb-1.5 mt-3">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-sm font-semibold mb-1 mt-2">{children}</h3>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline hover:text-blue-500"
                          >
                            {children}
                          </a>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-gray-300 pl-3 italic text-gray-600 my-2">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                  {isStreaming && i === messages.length - 1 && msg.content !== "" && (
                    <span className="inline-block w-2 h-3.5 bg-gray-500 animate-pulse rounded-sm ml-0.5 align-middle" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={sendMessage} className="border-t border-gray-200 px-6 py-4 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your SharePoint files..."
          disabled={isStreaming}
          autoComplete="off"
          className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isStreaming ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
