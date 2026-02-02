"use client";

import { useAppStore } from "@/store/AppContext";
import { LinearIssueLink } from "@/components/LinearIssueLink";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface LinearIssue {
  id: string;
  title: string;
  description?: string;
}

interface SimilarityPair {
  issueA: LinearIssue;
  issueB: LinearIssue;
  similarity: number;
}

interface ConsolidationResponse {
  generatedAt: string;
  threshold: number;
  totalIssues: number;
  totalPairsReturned: number;
  approximationMode: boolean;
  pairs: SimilarityPair[];
}

export default function ConsolidationPage() {
  const { linearIssues } = useAppStore();
  const [threshold, setThreshold] = useState(0.5);
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<ConsolidationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());

  // Fetch consolidation opportunities from API
  const fetchOpportunities = async () => {
    if (linearIssues.length === 0) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/consolidation-opportunities?threshold=${threshold}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issues: linearIssues }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch consolidation opportunities");
      }

      const result: ConsolidationResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when threshold or issues change
  useEffect(() => {
    fetchOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, linearIssues]);

  // Filter pairs by search query
  const filteredPairs = useMemo(() => {
    if (!data?.pairs) return [];
    if (!searchQuery.trim()) return data.pairs;

    const query = searchQuery.toLowerCase();
    return data.pairs.filter(
      (pair) =>
        pair.issueA.title.toLowerCase().includes(query) ||
        pair.issueB.title.toLowerCase().includes(query) ||
        pair.issueA.id.toLowerCase().includes(query) ||
        pair.issueB.id.toLowerCase().includes(query)
    );
  }, [data?.pairs, searchQuery]);

  // Toggle expanded state for a pair
  const toggleExpanded = (pairKey: string) => {
    setExpandedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(pairKey)) {
        next.delete(pairKey);
      } else {
        next.add(pairKey);
      }
      return next;
    });
  };

  // Truncate description to ~300 chars
  const truncateDescription = (text: string | undefined, maxLength = 300) => {
    if (!text) return "No description";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  };

  if (linearIssues.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Consolidation opportunities</h1>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center">
          <p className="text-[var(--muted)] mb-4">
            No Linear issues loaded. Import issues first to find consolidation opportunities.
          </p>
          <Link
            href="/ingest"
            className="text-[var(--primary)] hover:underline"
          >
            Go to Ingest data
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Consolidation opportunities</h1>
        <p className="text-[var(--muted)] mt-1">
          Find similar Linear issues that might be duplicates or related.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Threshold Slider */}
          <div className="flex-1">
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
              Similarity threshold: {threshold.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.3"
              max="0.9"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full mt-2 accent-[var(--primary)]"
            />
            <div className="flex justify-between text-xs text-[var(--muted)] mt-1">
              <span>0.30</span>
              <span>0.90</span>
            </div>
          </div>

          {/* Search Filter */}
          <div className="flex-1">
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
              Filter by keyword
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search titles or IDs..."
              className="w-full mt-2 px-3 py-2 text-sm rounded-md bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="flex gap-4 text-sm">
          <span className="text-[var(--muted)]">
            {data.totalIssues} issues analyzed
          </span>
          <span className="text-[var(--muted)]">|</span>
          <span className="text-[var(--muted)]">
            {filteredPairs.length} pairs found
            {searchQuery && ` (${data.totalPairsReturned} total)`}
          </span>
          {data.approximationMode && (
            <>
              <span className="text-[var(--muted)]">|</span>
              <span className="text-yellow-400 text-xs">
                Approximation mode (large dataset)
              </span>
            </>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center">
          <p className="text-[var(--muted)]">Analyzing issues...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-600/20 border border-red-600/50 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Results Table */}
      {!loading && !error && data && (
        <>
          {filteredPairs.length === 0 ? (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center">
              <p className="text-[var(--muted)]">
                {searchQuery
                  ? `No pairs match "${searchQuery}"`
                  : `No similar issues found with threshold > ${threshold.toFixed(2)}`}
              </p>
              {!searchQuery && threshold > 0.5 && (
                <p className="text-sm text-[var(--muted)] mt-2">
                  Try lowering the threshold to find more matches.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                      <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)] w-20">
                        Score
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)]">
                        Issue A
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)]">
                        Issue B
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-[var(--muted)] w-24">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPairs.map((pair, index) => {
                      const pairKey = `${pair.issueA.id}-${pair.issueB.id}`;
                      const isExpanded = expandedPairs.has(pairKey);

                      return (
                        <tr
                          key={pairKey}
                          className="border-b border-[var(--border)] last:border-b-0"
                        >
                          <td className="px-4 py-3 align-top">
                            <span
                              className={`text-sm font-mono px-2 py-0.5 rounded ${
                                pair.similarity >= 0.7
                                  ? "bg-red-600/20 text-red-400"
                                  : pair.similarity >= 0.5
                                  ? "bg-yellow-600/20 text-yellow-400"
                                  : "bg-[var(--border)] text-[var(--muted)]"
                              }`}
                            >
                              {pair.similarity.toFixed(2)}
                            </span>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="flex items-start gap-2">
                              <LinearIssueLink issueId={pair.issueA.id} title={pair.issueA.title} className="whitespace-nowrap" />
                              <span
                                className="text-sm line-clamp-2"
                                title={pair.issueA.title}
                              >
                                {pair.issueA.title}
                              </span>
                            </div>
                            {isExpanded && (
                              <div className="mt-2 p-2 bg-[var(--background)] rounded text-xs text-[var(--muted)] whitespace-pre-wrap">
                                {truncateDescription(pair.issueA.description)}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="flex items-start gap-2">
                              <LinearIssueLink issueId={pair.issueB.id} title={pair.issueB.title} className="whitespace-nowrap" />
                              <span
                                className="text-sm line-clamp-2"
                                title={pair.issueB.title}
                              >
                                {pair.issueB.title}
                              </span>
                            </div>
                            {isExpanded && (
                              <div className="mt-2 p-2 bg-[var(--background)] rounded text-xs text-[var(--muted)] whitespace-pre-wrap">
                                {truncateDescription(pair.issueB.description)}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 align-top text-right">
                            <button
                              onClick={() => toggleExpanded(pairKey)}
                              className="text-xs px-2 py-1 rounded bg-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                            >
                              {isExpanded ? "Hide" : "Preview"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
