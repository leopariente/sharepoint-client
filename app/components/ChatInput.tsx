"use client";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isStreaming: boolean;
}

const ChatInput = ({ value, onChange, onSubmit, isStreaming }: ChatInputProps) => {
  return (
    <form onSubmit={onSubmit} className="border-t border-gray-200 px-6 py-4 flex gap-3">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about your SharePoint files..."
        disabled={isStreaming}
        autoComplete="off"
        className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isStreaming || !value.trim()}
        className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isStreaming ? "..." : "Send"}
      </button>
    </form>
  );
};

export default ChatInput;
