"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatSession, ChatMessage } from "@/types";

const STORAGE_KEY = "sharepoint-chat-sessions";
const MAX_SESSIONS = 50;

const loadFromStorage = (): ChatSession[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
};

const saveToStorage = (sessions: ChatSession[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // QuotaExceededError — silently ignore
  }
};

const newSession = (firstMessage?: string): ChatSession => ({
  id: crypto.randomUUID(),
  name: firstMessage
    ? firstMessage.slice(0, 40) + (firstMessage.length > 40 ? "…" : "")
    : "New chat",
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useChatSessions = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored.length > 0) {
      setSessions(stored);
      setActiveSessionId(stored[0].id);
    } else {
      const initial = newSession();
      setSessions([initial]);
      setActiveSessionId(initial.id);
      saveToStorage([initial]);
    }
    setHydrated(true);
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const createSession = useCallback(() => {
    const session = newSession();
    setSessions((prev) => {
      const next = [session, ...prev].slice(0, MAX_SESSIONS);
      saveToStorage(next);
      return next;
    });
    setActiveSessionId(session.id);
    return session;
  }, []);

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const updateSession = useCallback((id: string, messages: ChatMessage[]) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== id) return s;
        // Auto-name from first user message if still default
        const firstName = messages.find((m) => m.role === "user")?.content ?? "";
        const name =
          s.name === "New chat" && firstName
            ? firstName.slice(0, 40) + (firstName.length > 40 ? "…" : "")
            : s.name;
        return { ...s, messages, name, updatedAt: Date.now() };
      });
      saveToStorage(next);
      return next;
    });
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveToStorage(next);

        // If deleting active session, pick next available or create new
        if (id === activeSessionId) {
          if (next.length > 0) {
            setActiveSessionId(next[0].id);
          } else {
            const fresh = newSession();
            next.push(fresh);
            saveToStorage(next);
            setActiveSessionId(fresh.id);
          }
        }

        return next;
      });
    },
    [activeSessionId],
  );

  return {
    sessions,
    activeSessionId,
    activeSession,
    hydrated,
    createSession,
    selectSession,
    updateSession,
    deleteSession,
  };
};
