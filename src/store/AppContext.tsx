"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface LinearIssue {
  id: string;
  title: string;
  description?: string;
  status?: string;
}

export interface SlackMessage {
  id: string;
  rawText: string;
  channel?: string;
  timestamp?: string;
  author?: string;
  createdAt?: string;
  // Parsed fields
  who?: string;
  topic?: string;
  issueRequest?: string;
  // Review status
  reviewed?: boolean;
}

export interface MappingDecision {
  slackMessageId: string;
  linearIssueId: string;
  createdAt: string;
}

interface AppState {
  linearIssues: LinearIssue[];
  slackMessages: SlackMessage[];
  mappings: MappingDecision[];
}

interface AppContextValue extends AppState {
  setLinearIssues: (issues: LinearIssue[]) => void;
  addLinearIssue: (issue: LinearIssue) => void;
  setSlackMessages: (messages: SlackMessage[]) => void;
  updateSlackMessage: (id: string, updates: Partial<SlackMessage>) => void;
  addMapping: (slackMessageId: string, linearIssueId: string) => void;
  removeMapping: (slackMessageId: string) => void;
  resetAllData: () => void;
}

const STORAGE_KEY = "kapas-6th-sense-data";

const defaultState: AppState = {
  linearIssues: [],
  slackMessages: [],
  mappings: [],
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setState(JSON.parse(stored));
      } catch {
        // Invalid JSON, use default
      }
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage on state change
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isHydrated]);

  const setLinearIssues = (issues: LinearIssue[]) => {
    setState((prev) => ({ ...prev, linearIssues: issues }));
  };

  const addLinearIssue = (issue: LinearIssue) => {
    setState((prev) => ({
      ...prev,
      linearIssues: [...prev.linearIssues, issue],
    }));
  };

  const setSlackMessages = (messages: SlackMessage[]) => {
    setState((prev) => ({ ...prev, slackMessages: messages }));
  };

  const updateSlackMessage = (id: string, updates: Partial<SlackMessage>) => {
    setState((prev) => ({
      ...prev,
      slackMessages: prev.slackMessages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    }));
  };

  const addMapping = (slackMessageId: string, linearIssueId: string) => {
    setState((prev) => ({
      ...prev,
      mappings: [
        ...prev.mappings.filter((m) => m.slackMessageId !== slackMessageId),
        { slackMessageId, linearIssueId, createdAt: new Date().toISOString() },
      ],
    }));
  };

  const removeMapping = (slackMessageId: string) => {
    setState((prev) => ({
      ...prev,
      mappings: prev.mappings.filter((m) => m.slackMessageId !== slackMessageId),
    }));
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(defaultState);
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        setLinearIssues,
        addLinearIssue,
        setSlackMessages,
        updateSlackMessage,
        addMapping,
        removeMapping,
        resetAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppStore must be used within AppProvider");
  }
  return context;
}
