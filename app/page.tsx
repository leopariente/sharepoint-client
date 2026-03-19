"use client";

import { useState } from "react";
import ChatBox from "./components/ChatBox";
import SessionSidebar from "./components/SessionSidebar";
import { useChatSessions } from "./hooks/useChatSessions";

const Home = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    sessions,
    activeSessionId,
    activeSession,
    hydrated,
    createSession,
    selectSession,
    updateSession,
    deleteSession,
  } = useChatSessions();

  if (!hydrated) {
    return (
      <main className="flex h-screen items-center justify-center bg-white">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-white overflow-hidden">
      {/* Hamburger button — mobile only */}
      <button
        className="fixed top-4 left-4 z-40 md:hidden flex flex-col gap-1 p-2 rounded-lg bg-white border border-gray-200 shadow-sm"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="Toggle sidebar"
      >
        <span className="block w-4 h-0.5 bg-gray-600" />
        <span className="block w-4 h-0.5 bg-gray-600" />
        <span className="block w-4 h-0.5 bg-gray-600" />
      </button>

      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={(id) => {
          selectSession(id);
          setSidebarOpen(false);
        }}
        onCreate={() => {
          createSession();
          setSidebarOpen(false);
        }}
        onDelete={deleteSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
      />

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-gray-200 px-6 py-4 pl-14 md:pl-6">
          <h1 className="text-base font-semibold text-gray-900">SharePoint Assistant</h1>
          <p className="text-sm text-gray-400">Ask anything about the CS library</p>
        </header>

        {activeSessionId && (
          <ChatBox
            key={activeSessionId}
            initialMessages={activeSession?.messages ?? []}
            onMessagesChange={(msgs) => updateSession(activeSessionId, msgs)}
          />
        )}
      </div>
    </main>
  );
};

export default Home;
