"use client";

import { useAppStore, LinearIssue, SlackMessage } from "@/store/AppContext";
import { parseLinearCSV } from "@/lib/csvParser";
import { useState, useRef } from "react";

interface LinearExportIssue {
  id?: string;
  identifier?: string;
  key?: string;
  title?: string;
  name?: string;
  description?: string;
  state?: { name?: string } | string;
  status?: { name?: string } | string;
}

interface SlackApiMessage {
  type?: string;
  user?: string;
  text?: string;
  ts?: string;
  bot_id?: string;
  channel?: string;
}

function normalizeIssues(data: unknown): LinearIssue[] {
  let rawIssues: LinearExportIssue[] = [];

  if (Array.isArray(data)) {
    rawIssues = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.issues)) rawIssues = obj.issues;
    else if (Array.isArray(obj.data)) rawIssues = obj.data;
    else if (Array.isArray(obj.nodes)) rawIssues = obj.nodes;
  }

  const results: LinearIssue[] = [];

  for (let index = 0; index < rawIssues.length; index++) {
    const issue = rawIssues[index];
    const id = issue.identifier || issue.key || issue.id || `issue-${index}`;
    const title = issue.title || issue.name || "";
    if (!title) continue;

    let status: string | undefined;
    if (typeof issue.state === "string") status = issue.state;
    else if (issue.state?.name) status = issue.state.name;
    else if (typeof issue.status === "string") status = issue.status;
    else if (issue.status?.name) status = issue.status.name;

    results.push({
      id,
      title,
      description: issue.description,
      status,
    });
  }

  return results;
}

interface ParsedFields {
  who?: string;
  topic?: string;
  issueRequest?: string;
}

function parseFieldsFromText(text: string): ParsedFields {
  const fields: ParsedFields = {};
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Match lines starting with field names (case insensitive)
    // Supports: "WHO: value", "WHO - value", "**WHO**: value", "WHO value"
    const whoMatch = trimmed.match(/^(?:\*\*)?WHO(?:\*\*)?[:\s-]+(.+)/i);
    if (whoMatch && !fields.who) {
      fields.who = whoMatch[1].trim();
      continue;
    }

    const topicMatch = trimmed.match(/^(?:\*\*)?TOPIC(?:\*\*)?[:\s-]+(.+)/i);
    if (topicMatch && !fields.topic) {
      fields.topic = topicMatch[1].trim();
      continue;
    }

    const issueMatch = trimmed.match(/^(?:\*\*)?ISSUE(?:\*\*)?[:\s-]+(.+)/i);
    if (issueMatch && !fields.issueRequest) {
      fields.issueRequest = issueMatch[1].trim();
      continue;
    }

    const requestMatch = trimmed.match(/^(?:\*\*)?REQUEST(?:\*\*)?[:\s-]+(.+)/i);
    if (requestMatch && !fields.issueRequest) {
      fields.issueRequest = requestMatch[1].trim();
      continue;
    }
  }

  return fields;
}

function parseSlackMessages(input: string): SlackMessage[] {
  const results: SlackMessage[] = [];

  // Try to parse as JSON first (Slack API format)
  try {
    const data = JSON.parse(input);
    let messages: SlackApiMessage[] = [];

    if (Array.isArray(data)) {
      messages = data;
    } else if (data.messages && Array.isArray(data.messages)) {
      messages = data.messages;
    } else if (data.ok && data.messages) {
      messages = data.messages;
    }

    if (messages.length > 0) {
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg.text) continue;

        let createdAt: string | undefined;
        if (msg.ts) {
          const timestamp = parseFloat(msg.ts) * 1000;
          createdAt = new Date(timestamp).toISOString();
        }

        const fields = parseFieldsFromText(msg.text);

        results.push({
          id: `slack-${msg.ts || Date.now()}-${i}`,
          rawText: msg.text,
          author: msg.user || msg.bot_id,
          channel: msg.channel,
          timestamp: msg.ts,
          createdAt,
          ...fields,
        });
      }
      return results;
    }
  } catch {
    // Not JSON, parse as plain text
  }

  // Parse as plain text separated by blank lines
  const blocks = input.split(/\n\s*\n/).filter((block) => block.trim());

  for (let i = 0; i < blocks.length; i++) {
    const text = blocks[i].trim();
    if (!text) continue;

    const fields = parseFieldsFromText(text);

    results.push({
      id: `slack-${Date.now()}-${i}`,
      rawText: text,
      createdAt: new Date().toISOString(),
      ...fields,
    });
  }

  return results;
}

function MessagePreview({ message }: { message: SlackMessage }) {
  const [expanded, setExpanded] = useState(false);
  const hasFields = message.who || message.topic || message.issueRequest;

  return (
    <div
      className="text-sm border border-[var(--border)] rounded-lg overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 text-left hover:bg-[var(--border)]/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {hasFields ? (
              <div className="flex flex-wrap gap-2">
                {message.who && (
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
                    <span className="font-medium">WHO:</span> {message.who}
                  </span>
                )}
                {message.topic && (
                  <span className="inline-flex items-center gap-1 text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded">
                    <span className="font-medium">TOPIC:</span> {message.topic}
                  </span>
                )}
                {message.issueRequest && (
                  <span className="inline-flex items-center gap-1 text-xs bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded">
                    <span className="font-medium">ISSUE:</span> {message.issueRequest}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[var(--muted)] truncate">
                {message.rawText.slice(0, 80)}{message.rawText.length > 80 ? "..." : ""}
              </p>
            )}
          </div>
          <span className="text-[var(--muted)] text-xs flex-shrink-0">
            {expanded ? "▼" : "▶"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-[var(--border)] bg-[var(--background)]">
          <p className="text-xs text-[var(--muted)] mt-2 mb-1">Raw text:</p>
          <pre className="text-xs text-[var(--foreground)] whitespace-pre-wrap bg-[var(--card)] p-2 rounded border border-[var(--border)]">
            {message.rawText}
          </pre>
          {message.createdAt && (
            <p className="text-xs text-[var(--muted)] mt-2">
              Created: {new Date(message.createdAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function IngestPage() {
  const {
    resetAllData,
    linearIssues,
    slackMessages,
    mappings,
    setLinearIssues,
    setSlackMessages
  } = useAppStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [slackInput, setSlackInput] = useState("");
  const [slackError, setSlackError] = useState<string | null>(null);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    resetAllData();
    setShowConfirm(false);
  };

  const processFile = async (file: File) => {
    setUploadError(null);

    const isJSON = file.name.endsWith(".json");
    const isCSV = file.name.endsWith(".csv");

    if (!isJSON && !isCSV) {
      setUploadError("Please upload a JSON or CSV file");
      return;
    }

    try {
      const text = await file.text();
      let issues: LinearIssue[] = [];

      if (isCSV) {
        issues = parseLinearCSV(text);
      } else {
        const data = JSON.parse(text);
        issues = normalizeIssues(data);
      }

      if (issues.length === 0) {
        setUploadError("No valid issues found in the file");
        return;
      }

      setLinearIssues(issues);
    } catch {
      setUploadError(`Failed to parse ${isCSV ? "CSV" : "JSON"} file`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSlackIngest = () => {
    setSlackError(null);

    if (!slackInput.trim()) {
      setSlackError("Please paste some messages");
      return;
    }

    const messages = parseSlackMessages(slackInput);

    if (messages.length === 0) {
      setSlackError("No valid messages found");
      return;
    }

    setSlackMessages(messages);
    setSlackInput("");
    setShowAllMessages(false);
  };

  const unclassifiedCount = slackMessages.filter(
    (msg) => !msg.who && !msg.topic && !msg.issueRequest
  ).length;
  const classifiedCount = slackMessages.length - unclassifiedCount;

  const totalItems = linearIssues.length + slackMessages.length + mappings.length;
  const displayedMessages = showAllMessages ? slackMessages : slackMessages.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Ingest data</h1>
        <p className="text-[var(--muted)] mt-2">
          Import and process data from various sources.
        </p>
      </div>

      {/* Linear Export Upload */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Linear Export</h2>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-[var(--primary)] bg-[var(--primary)]/10"
              : "border-[var(--border)] hover:border-[var(--muted)]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <p className="text-[var(--muted)]">
            Drop a file here or click to upload
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">
            Accepts Linear export in JSON or CSV format
          </p>
        </div>

        {uploadError && (
          <p className="text-red-500 text-sm">{uploadError}</p>
        )}

        {linearIssues.length > 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Linear Issues Loaded</h3>
              <span className="text-sm bg-[var(--primary)] px-2 py-0.5 rounded">
                {linearIssues.length} issues
              </span>
            </div>
            <div className="space-y-1">
              {linearIssues.slice(0, 3).map((issue) => (
                <div key={issue.id} className="text-sm text-[var(--muted)] truncate">
                  <span className="text-[var(--foreground)] font-mono text-xs mr-2">
                    {issue.id}
                  </span>
                  {issue.title}
                </div>
              ))}
              {linearIssues.length > 3 && (
                <p className="text-xs text-[var(--muted)]">
                  ...and {linearIssues.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Slack Messages */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Paste Slack Messages</h2>
        <p className="text-sm text-[var(--muted)]">
          Paste messages separated by blank lines, or paste Slack API JSON output.
          Lines starting with <code className="bg-[var(--border)] px-1 rounded">WHO:</code>, <code className="bg-[var(--border)] px-1 rounded">TOPIC:</code>, <code className="bg-[var(--border)] px-1 rounded">ISSUE:</code>, or <code className="bg-[var(--border)] px-1 rounded">REQUEST:</code> will be parsed as fields.
        </p>
        <textarea
          value={slackInput}
          onChange={(e) => setSlackInput(e.target.value)}
          placeholder={`Paste messages here...\n\nExample:\nWHO: Customer A\nTOPIC: Dashboard\nISSUE: Charts not loading properly\n\nWHO: Customer B\nTOPIC: API\nREQUEST: Add rate limiting endpoint`}
          className="w-full h-48 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted)] resize-y focus:outline-none focus:border-[var(--primary)] font-mono text-sm"
        />
        <button
          onClick={handleSlackIngest}
          className="px-4 py-2 text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-md transition-colors"
        >
          Ingest Messages
        </button>

        {slackError && (
          <p className="text-red-500 text-sm">{slackError}</p>
        )}

        {slackMessages.length > 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Slack Messages</h3>
              <div className="flex gap-2">
                <span className="text-sm bg-[var(--primary)] px-2 py-0.5 rounded">
                  {slackMessages.length} total
                </span>
                <span className="text-sm bg-green-600 px-2 py-0.5 rounded">
                  {classifiedCount} classified
                </span>
                <span className="text-sm bg-yellow-600 px-2 py-0.5 rounded">
                  {unclassifiedCount} unclassified
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {displayedMessages.map((msg) => (
                <MessagePreview key={msg.id} message={msg} />
              ))}
            </div>

            {slackMessages.length > 5 && (
              <button
                onClick={() => setShowAllMessages(!showAllMessages)}
                className="text-sm text-[var(--primary)] hover:underline"
              >
                {showAllMessages
                  ? "Show less"
                  : `Show all ${slackMessages.length} messages`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Data Management */}
      <div className="pt-8 border-t border-[var(--border)]">
        <h2 className="text-lg font-semibold mb-2">Data Management</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          {totalItems > 0
            ? `Currently storing ${linearIssues.length} Linear issues, ${slackMessages.length} Slack messages, and ${mappings.length} mappings.`
            : "No data stored yet."}
        </p>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Reset all data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--muted)]">Are you sure?</span>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
              Yes, reset
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 text-sm bg-[var(--border)] hover:bg-[var(--muted)] rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
