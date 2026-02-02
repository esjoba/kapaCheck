"use client";

import { useAppStore, LinearIssue } from "@/store/AppContext";
import { findSimilarIssues } from "@/lib/similarity";
import { useState, useMemo } from "react";
import Link from "next/link";

type FilterMode = "all" | "unreviewed";

export default function ReviewPage() {
  const {
    slackMessages,
    linearIssues,
    mappings,
    updateSlackMessage,
    addMapping,
    addLinearIssue
  } = useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterMode, setFilterMode] = useState<FilterMode>("unreviewed");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMessages = useMemo(() => {
    if (filterMode === "unreviewed") {
      return slackMessages.filter((msg) => !msg.reviewed);
    }
    return slackMessages;
  }, [slackMessages, filterMode]);

  const currentMessage = filteredMessages[currentIndex];

  // Get linked issue for current message
  const linkedMapping = useMemo(() => {
    if (!currentMessage) return null;
    return mappings.find((m) => m.slackMessageId === currentMessage.id);
  }, [currentMessage, mappings]);

  const linkedIssue = useMemo(() => {
    if (!linkedMapping) return null;
    return linearIssues.find((i) => i.id === linkedMapping.linearIssueId);
  }, [linkedMapping, linearIssues]);

  // Calculate top suggestions for current message
  const suggestions = useMemo(() => {
    if (!currentMessage || linearIssues.length === 0) return [];

    const textToCompare = currentMessage.issueRequest || currentMessage.rawText;
    const results = findSimilarIssues(textToCompare, linearIssues, 0.01);

    return results.slice(0, 3);
  }, [currentMessage, linearIssues]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || linearIssues.length === 0) return [];

    const query = searchQuery.toLowerCase();
    return linearIssues
      .filter(
        (issue) =>
          issue.id.toLowerCase().includes(query) ||
          issue.title.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [searchQuery, linearIssues]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(filteredMessages.length - 1, prev + 1));
  };

  const handleToggleReviewed = () => {
    if (!currentMessage) return;
    const newReviewed = !currentMessage.reviewed;
    updateSlackMessage(currentMessage.id, { reviewed: newReviewed });

    if (newReviewed && filterMode === "unreviewed") {
      const newFilteredLength = filteredMessages.length - 1;
      if (currentIndex >= newFilteredLength && newFilteredLength > 0) {
        setCurrentIndex(newFilteredLength - 1);
      }
    }
  };

  const handleLinkToIssue = (issue: LinearIssue) => {
    if (!currentMessage) return;

    // Save mapping
    addMapping(currentMessage.id, issue.id);

    // Mark as reviewed
    updateSlackMessage(currentMessage.id, { reviewed: true });

    // Clear search
    setSearchQuery("");

    // Advance to next message (in unreviewed mode, next unreviewed slides in)
    if (filterMode === "unreviewed") {
      const newFilteredLength = filteredMessages.length - 1;
      if (currentIndex >= newFilteredLength && newFilteredLength > 0) {
        setCurrentIndex(newFilteredLength - 1);
      }
      // If at same index, next unreviewed automatically shows
    } else {
      // In "all" mode, advance to next
      if (currentIndex < filteredMessages.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  const handleCreateNewIdea = () => {
    if (!currentMessage) return;

    // Generate a local ID
    const localId = `LOCAL-${Date.now().toString(36).toUpperCase()}`;

    // Get title from first ~80 chars of issueRequest or rawText
    const sourceText = currentMessage.issueRequest || currentMessage.rawText;
    const title = sourceText.length > 80
      ? sourceText.substring(0, 77) + "..."
      : sourceText;

    // Create the new local issue
    const newIssue = {
      id: localId,
      title,
      description: currentMessage.rawText,
      status: "New Idea",
    };

    addLinearIssue(newIssue);
    addMapping(currentMessage.id, localId);
    updateSlackMessage(currentMessage.id, { reviewed: true });

    // Advance to next message
    if (filterMode === "unreviewed") {
      const newFilteredLength = filteredMessages.length - 1;
      if (currentIndex >= newFilteredLength && newFilteredLength > 0) {
        setCurrentIndex(newFilteredLength - 1);
      }
    } else {
      if (currentIndex < filteredMessages.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  const handleFilterChange = (mode: FilterMode) => {
    setFilterMode(mode);
    setCurrentIndex(0);
  };

  const reviewedCount = slackMessages.filter((msg) => msg.reviewed).length;
  const unreviewedCount = slackMessages.length - reviewedCount;
  const linkedCount = mappings.length;

  if (slackMessages.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Review new feedback</h1>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center">
          <p className="text-[var(--muted)] mb-4">No Slack messages to review.</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review new feedback</h1>
          <p className="text-[var(--muted)] mt-1">
            {reviewedCount} reviewed, {linkedCount} linked, {unreviewedCount} remaining
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex bg-[var(--card)] border border-[var(--border)] rounded-lg p-1">
          <button
            onClick={() => handleFilterChange("all")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filterMode === "all"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            All ({slackMessages.length})
          </button>
          <button
            onClick={() => handleFilterChange("unreviewed")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filterMode === "unreviewed"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Unreviewed ({unreviewedCount})
          </button>
        </div>
      </div>

      {filteredMessages.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center">
          <p className="text-[var(--muted)] mb-2">All messages have been reviewed!</p>
          <button
            onClick={() => handleFilterChange("all")}
            className="text-[var(--primary)] hover:underline text-sm"
          >
            Show all messages
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Card - Takes 2 columns on large screens */}
            <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]">
                <span className="text-sm text-[var(--muted)]">
                  {currentIndex + 1} of {filteredMessages.length}
                </span>
                <div className="flex gap-2">
                  {linkedIssue && (
                    <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
                      Linked to {linkedIssue.id}
                    </span>
                  )}
                  {currentMessage?.reviewed && (
                    <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded">
                      Reviewed
                    </span>
                  )}
                </div>
              </div>

              {/* Card Content */}
              <div className="p-6 space-y-4">
                {currentMessage?.who && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                      Who
                    </label>
                    <p className="text-lg mt-1">{currentMessage.who}</p>
                  </div>
                )}

                {currentMessage?.topic && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                      Topic
                    </label>
                    <p className="text-lg mt-1">{currentMessage.topic}</p>
                  </div>
                )}

                {currentMessage?.issueRequest ? (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                      Issue / Request
                    </label>
                    <p className="text-lg mt-1">{currentMessage.issueRequest}</p>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                      Message
                    </label>
                    <p className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">
                      {currentMessage?.rawText}
                    </p>
                  </div>
                )}

                {(currentMessage?.who || currentMessage?.topic || currentMessage?.issueRequest) && (
                  <details className="mt-4">
                    <summary className="text-xs text-[var(--muted)] cursor-pointer hover:text-[var(--foreground)]">
                      Show raw text
                    </summary>
                    <pre className="mt-2 text-xs text-[var(--muted)] whitespace-pre-wrap bg-[var(--background)] p-3 rounded border border-[var(--border)]">
                      {currentMessage?.rawText}
                    </pre>
                  </details>
                )}
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--background)]">
                <button
                  onClick={handleToggleReviewed}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                    currentMessage?.reviewed
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)]"
                  }`}
                >
                  <span className="text-base">{currentMessage?.reviewed ? "✓" : "○"}</span>
                  {currentMessage?.reviewed ? "Reviewed" : "Mark as reviewed"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="px-4 py-1.5 text-sm rounded-md bg-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === filteredMessages.length - 1}
                    className="px-4 py-1.5 text-sm rounded-md bg-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>

            {/* Suggestions Panel */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden h-fit">
              <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]">
                <h3 className="font-medium text-sm">Top Suggestions</h3>
              </div>

              <div className="p-4 space-y-4">
                {linearIssues.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] text-center py-4">
                    No Linear issues loaded.{" "}
                    <Link href="/ingest" className="text-[var(--primary)] hover:underline">
                      Import issues
                    </Link>
                  </p>
                ) : (
                  <>
                    {/* Suggestions */}
                    {suggestions.length === 0 ? (
                      <p className="text-sm text-[var(--muted)] text-center py-2">
                        No matching issues found
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {suggestions.map(({ issue, score }) => (
                          <div
                            key={issue.id}
                            className="border border-[var(--border)] rounded-lg p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-xs text-[var(--primary)]">
                                    {issue.id}
                                  </span>
                                  <span className="text-xs bg-[var(--primary)]/20 text-[var(--primary)] px-1.5 py-0.5 rounded">
                                    {score.toFixed(2)}
                                  </span>
                                </div>
                                <p className="text-sm text-[var(--foreground)] line-clamp-2">
                                  {issue.title}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleLinkToIssue(issue)}
                              className="w-full px-3 py-1.5 text-xs bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-md transition-colors"
                            >
                              Link to this issue
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Search */}
                    <div className="pt-3 border-t border-[var(--border)]">
                      <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                        Search all Linear issues
                      </label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by ID or title..."
                        className="w-full mt-2 px-3 py-2 text-sm rounded-md bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
                      />

                      {searchQuery.trim() && (
                        <div className="mt-2 space-y-2">
                          {searchResults.length === 0 ? (
                            <p className="text-xs text-[var(--muted)] py-2">
                              No issues match &quot;{searchQuery}&quot;
                            </p>
                          ) : (
                            searchResults.map((issue) => (
                              <button
                                key={issue.id}
                                onClick={() => handleLinkToIssue(issue)}
                                className="w-full text-left border border-[var(--border)] rounded-lg p-2 hover:bg-[var(--border)]/50 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-[var(--primary)]">
                                    {issue.id}
                                  </span>
                                </div>
                                <p className="text-xs text-[var(--foreground)] mt-1 line-clamp-1">
                                  {issue.title}
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Create new idea fallback */}
                    <div className="pt-3 border-t border-[var(--border)]">
                      <p className="text-xs text-[var(--muted)] mb-2">
                        No good match? Create a placeholder:
                      </p>
                      <button
                        onClick={handleCreateNewIdea}
                        className="w-full px-3 py-2 text-sm bg-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)] rounded-md transition-colors"
                      >
                        Create new idea (placeholder)
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick jump indicator */}
          <div className="flex justify-center gap-1">
            {filteredMessages.slice(0, 20).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentIndex
                    ? "bg-[var(--primary)]"
                    : "bg-[var(--border)] hover:bg-[var(--muted)]"
                }`}
                title={`Go to ${idx + 1}`}
              />
            ))}
            {filteredMessages.length > 20 && (
              <span className="text-xs text-[var(--muted)] ml-1">
                +{filteredMessages.length - 20}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
