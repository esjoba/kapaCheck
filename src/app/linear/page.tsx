"use client";

import { useAppStore, LinearIssue } from "@/store/AppContext";
import { textSimilarity } from "@/lib/similarity";
import { useState, useMemo } from "react";
import Link from "next/link";

interface MappedMessage {
  slackId: string;
  slackPreview: string;
  slackRawText: string;
  linearIssue: LinearIssue | null;
  confidenceScore: number | null;
  isReviewed: boolean;
}

export default function LinearPage() {
  const {
    slackMessages,
    linearIssues,
    mappings,
    addMapping,
    removeMapping,
  } = useAppStore();

  const [changeLinkModalOpen, setChangeLinkModalOpen] = useState(false);
  const [selectedSlackId, setSelectedSlackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Build mapped messages data
  const mappedMessages = useMemo((): MappedMessage[] => {
    return slackMessages.map((msg) => {
      const mapping = mappings.find((m) => m.slackMessageId === msg.id);
      const linkedIssue = mapping
        ? linearIssues.find((i) => i.id === mapping.linearIssueId) || null
        : null;

      // Calculate confidence score if linked
      let confidenceScore: number | null = null;
      if (linkedIssue) {
        const textToCompare = msg.issueRequest || msg.rawText;
        confidenceScore = textSimilarity(
          textToCompare,
          `${linkedIssue.title} ${linkedIssue.description || ""}`
        );
      }

      // Create preview (first ~60 chars of issue/request or raw text)
      const sourceText = msg.issueRequest || msg.rawText;
      const preview =
        sourceText.length > 60
          ? sourceText.substring(0, 57) + "..."
          : sourceText;

      return {
        slackId: msg.id,
        slackPreview: preview,
        slackRawText: msg.rawText,
        linearIssue: linkedIssue,
        confidenceScore,
        isReviewed: msg.reviewed || false,
      };
    });
  }, [slackMessages, linearIssues, mappings]);

  // Split into linked and unlinked
  const linkedMessages = mappedMessages.filter((m) => m.linearIssue !== null);
  const unlinkedMessages = mappedMessages.filter((m) => m.linearIssue === null);

  // Summary stats
  const totalMessages = slackMessages.length;
  const linkedCount = linkedMessages.length;
  const unlinkedCount = unlinkedMessages.length;

  // Search results for modal
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || linearIssues.length === 0) return [];

    const query = searchQuery.toLowerCase();
    return linearIssues
      .filter(
        (issue) =>
          issue.id.toLowerCase().includes(query) ||
          issue.title.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [searchQuery, linearIssues]);

  const handleOpenChangeLink = (slackId: string) => {
    setSelectedSlackId(slackId);
    setSearchQuery("");
    setChangeLinkModalOpen(true);
  };

  const handleCloseModal = () => {
    setChangeLinkModalOpen(false);
    setSelectedSlackId(null);
    setSearchQuery("");
  };

  const handleSelectIssue = (issue: LinearIssue) => {
    if (selectedSlackId) {
      addMapping(selectedSlackId, issue.id);
    }
    handleCloseModal();
  };

  const handleUnlink = (slackId: string) => {
    removeMapping(slackId);
  };

  if (slackMessages.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Update Linear</h1>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center">
          <p className="text-[var(--muted)] mb-4">No messages to display.</p>
          <Link
            href="/ingest"
            className="text-[var(--primary)] hover:underline"
          >
            Go to Ingest data to add messages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Update Linear</h1>
        <p className="text-[var(--muted)] mt-1">
          Review and manage links between Slack feedback and Linear issues.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-2xl font-bold">{totalMessages}</div>
          <div className="text-sm text-[var(--muted)]">Total messages</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{linkedCount}</div>
          <div className="text-sm text-[var(--muted)]">Linked</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{unlinkedCount}</div>
          <div className="text-sm text-[var(--muted)]">Unlinked</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)]">
                  Slack Message
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)]">
                  Linked Linear Issue
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)]">
                  Score
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)]">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-[var(--muted)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {mappedMessages.map((item) => (
                <tr
                  key={item.slackId}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background)]/50"
                >
                  {/* Slack Message Preview */}
                  <td className="px-4 py-3">
                    <p
                      className="text-sm max-w-xs truncate"
                      title={item.slackRawText}
                    >
                      {item.slackPreview}
                    </p>
                  </td>

                  {/* Linked Linear Issue */}
                  <td className="px-4 py-3">
                    {item.linearIssue ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[var(--primary)]">
                          {item.linearIssue.id}
                        </span>
                        <span
                          className="text-sm truncate max-w-[200px]"
                          title={item.linearIssue.title}
                        >
                          {item.linearIssue.title}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">—</span>
                    )}
                  </td>

                  {/* Confidence Score */}
                  <td className="px-4 py-3">
                    {item.confidenceScore !== null ? (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          item.confidenceScore >= 0.3
                            ? "bg-green-600/20 text-green-400"
                            : item.confidenceScore >= 0.1
                            ? "bg-yellow-600/20 text-yellow-400"
                            : "bg-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        {item.confidenceScore.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {item.linearIssue ? (
                      <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded">
                        Linked
                      </span>
                    ) : item.isReviewed ? (
                      <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
                        Reviewed
                      </span>
                    ) : (
                      <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded">
                        Needs review
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenChangeLink(item.slackId)}
                        className="text-xs px-2 py-1 rounded bg-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                      >
                        {item.linearIssue ? "Change" : "Link"}
                      </button>
                      {item.linearIssue && (
                        <button
                          onClick={() => handleUnlink(item.slackId)}
                          className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Link Modal */}
      {changeLinkModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="font-medium">Link to Linear Issue</h3>
              <button
                onClick={handleCloseModal}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID or title..."
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
                autoFocus
              />

              <div className="max-h-64 overflow-y-auto space-y-2">
                {searchQuery.trim() === "" ? (
                  <p className="text-sm text-[var(--muted)] text-center py-4">
                    Type to search Linear issues...
                  </p>
                ) : searchResults.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] text-center py-4">
                    No issues match &quot;{searchQuery}&quot;
                  </p>
                ) : (
                  searchResults.map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => handleSelectIssue(issue)}
                      className="w-full text-left border border-[var(--border)] rounded-lg p-3 hover:bg-[var(--border)]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-[var(--primary)]">
                          {issue.id}
                        </span>
                        {issue.status && (
                          <span className="text-xs bg-[var(--border)] px-1.5 py-0.5 rounded text-[var(--muted)]">
                            {issue.status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--foreground)] line-clamp-2">
                        {issue.title}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end px-4 py-3 border-t border-[var(--border)] bg-[var(--background)]">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm rounded-md bg-[var(--border)] hover:bg-[var(--muted)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
