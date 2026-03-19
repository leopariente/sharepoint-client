"use client";

import type { ChatSession } from "@/types";

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const SessionSidebar = ({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
  isOpen,
  onToggle,
}: SessionSidebarProps) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-gray-50 border-r border-gray-200
          transform transition-transform duration-200
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:flex md:z-auto
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <span className="text-sm font-semibold text-gray-700">Chats</span>
          <button
            onClick={onCreate}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            + New
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors ${
                session.id === activeSessionId
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => onSelect(session.id)}
            >
              <span className="flex-1 truncate text-sm">{session.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(session.id);
                }}
                className="hidden group-hover:flex items-center justify-center w-5 h-5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
                aria-label="Delete session"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};

export default SessionSidebar;
