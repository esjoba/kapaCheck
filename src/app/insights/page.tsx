"use client";

import { useAppStore } from "@/store/AppContext";
import { LinearIssueLink } from "@/components/LinearIssueLink";
import { getLinearIssueUrl, isLocalIssue } from "@/lib/linearUrl";
import { useMemo, useState } from "react";

interface IssueStats {
  issueId: string;
  title: string;
  totalVotes: number;
  weekVotes: number;
  companies: string[];
}

function isThisWeek(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  // Get start of this week (Monday)
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek;
}

function isBeforeThisWeek(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  return date < startOfWeek;
}

function CompanyPills({ companies, max = 5 }: { companies: string[]; max?: number }) {
  const unique = [...new Set(companies.filter(Boolean))];
  const shown = unique.slice(0, max);
  const remaining = unique.length - shown.length;

  if (unique.length === 0) {
    return <span className="text-[var(--muted)] text-xs">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((company) => (
        <span
          key={company}
          className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--foreground)]"
        >
          {company}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)]/30 text-[var(--muted)]">
          +{remaining} more
        </span>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const { slackMessages, linearIssues, mappings } = useAppStore();
  const [copied, setCopied] = useState(false);

  // Compute all stats
  const stats = useMemo(() => {
    // Build issue stats map
    const issueStatsMap = new Map<string, IssueStats>();

    // Initialize all linked issues
    mappings.forEach((mapping) => {
      const issue = linearIssues.find((i) => i.id === mapping.linearIssueId);
      if (!issue) return;

      if (!issueStatsMap.has(mapping.linearIssueId)) {
        issueStatsMap.set(mapping.linearIssueId, {
          issueId: mapping.linearIssueId,
          title: issue.title,
          totalVotes: 0,
          weekVotes: 0,
          companies: [],
        });
      }

      const stats = issueStatsMap.get(mapping.linearIssueId)!;
      stats.totalVotes += 1;

      if (isThisWeek(mapping.createdAt)) {
        stats.weekVotes += 1;
      }

      // Find the slack message to get WHO
      const slackMsg = slackMessages.find((m) => m.id === mapping.slackMessageId);
      if (slackMsg?.who) {
        stats.companies.push(slackMsg.who);
      }
    });

    const allIssueStats = Array.from(issueStatsMap.values());

    // This week's summary
    const weekMappings = mappings.filter((m) => isThisWeek(m.createdAt));

    // Total requests received this week (unique slack messages linked this week)
    const requestsThisWeek = weekMappings.length;

    // Linked to existing issues this week (non-LOCAL issues)
    const linkedToExisting = weekMappings.filter((m) => !isLocalIssue(m.linearIssueId)).length;

    // New ideas this week (LOCAL- issues created this week)
    const newIdeasThisWeek = weekMappings.filter((m) => isLocalIssue(m.linearIssueId)).length;

    // Unlinked messages (messages without any mapping)
    const linkedMessageIds = new Set(mappings.map((m) => m.slackMessageId));
    const unlinkedTotal = slackMessages.filter((m) => !linkedMessageIds.has(m.id)).length;

    // Top gainers (by week votes)
    const topGainers = [...allIssueStats]
      .filter((s) => s.weekVotes > 0)
      .sort((a, b) => b.weekVotes - a.weekVotes)
      .slice(0, 5);

    // Top overall (by total votes)
    const topOverall = [...allIssueStats]
      .sort((a, b) => b.totalVotes - a.totalVotes)
      .slice(0, 10);

    // Leader change detection
    const currentLeader = topOverall[0] || null;

    // Compute what the leader was before this week
    const beforeWeekStats = new Map<string, { votes: number; title: string }>();
    mappings.forEach((mapping) => {
      if (isBeforeThisWeek(mapping.createdAt)) {
        const issue = linearIssues.find((i) => i.id === mapping.linearIssueId);
        if (!issue) return;
        const current = beforeWeekStats.get(mapping.linearIssueId) || {
          votes: 0,
          title: issue.title,
        };
        current.votes += 1;
        beforeWeekStats.set(mapping.linearIssueId, current);
      }
    });

    let previousLeaderId: string | null = null;
    let previousLeaderVotes = 0;
    beforeWeekStats.forEach((stats, id) => {
      if (stats.votes > previousLeaderVotes) {
        previousLeaderVotes = stats.votes;
        previousLeaderId = id;
      }
    });

    const leaderChanged = currentLeader && previousLeaderId !== currentLeader.issueId;

    return {
      requestsThisWeek,
      linkedToExisting,
      newIdeasThisWeek,
      unlinkedTotal,
      topGainers,
      topOverall,
      currentLeader,
      leaderChanged,
      previousLeaderId,
    };
  }, [slackMessages, linearIssues, mappings]);

  // Generate the brief paragraph for Slack (mrkdwn format)
  const briefData = useMemo(() => {
    // Build enumerated list with Slack mrkdwn links
    const top10ListSlack = stats.topOverall
      .map((item, idx) => {
        if (isLocalIssue(item.issueId)) {
          return `${idx + 1}. ${item.issueId}: ${item.title}`;
        }
        const url = getLinearIssueUrl(item.issueId, item.title);
        return `${idx + 1}. <${url}|${item.issueId}>: ${item.title}`;
      })
      .join("\n");

    // Plain text for display (with actual URLs)
    const top10ListDisplay = stats.topOverall.map((item, idx) => ({
      rank: idx + 1,
      issueId: item.issueId,
      title: item.title,
      url: isLocalIssue(item.issueId) ? null : getLinearIssueUrl(item.issueId, item.title),
    }));

    const introParagraph = stats.requestsThisWeek === 0
      ? "No new feedback was linked this week."
      : `Thanks for all the posted comments in #customer-feedback this week! Across ${stats.requestsThisWeek} requests, ${stats.linkedToExisting} were linked to existing backlog items and ${stats.newIdeasThisWeek} are new ideas.`;

    const slackBrief = `${introParagraph}

Here are the current top 10 requested features:
${top10ListSlack || "None yet"}`;

    return {
      slackBrief,
      top10ListDisplay,
      introParagraph,
    };
  }, [stats]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(briefData.slackBrief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (mappings.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Insights</h1>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center">
          <p className="text-[var(--muted)] mb-4">
            No data yet. Link some Slack messages to Linear issues first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Insights</h1>
        <p className="text-[var(--muted)] mt-1">
          Weekly 2-minute talk track for feedback impact
        </p>
      </div>

      {/* SECTION 1: Brief to be shared in Slack */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Weekly Brief for Slack</h2>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 space-y-4">
          <div className="relative">
            <div className="pr-20 space-y-3">
              <p className="text-sm leading-relaxed">{briefData.introParagraph}</p>
              {briefData.top10ListDisplay.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-[var(--muted)]">Current top 10 requested features:</p>
                  <ol className="text-sm space-y-1 list-none">
                    {briefData.top10ListDisplay.map((item) => (
                      <li key={item.issueId} className="flex items-baseline gap-2">
                        <span className="text-[var(--muted)] w-5 flex-shrink-0">{item.rank}.</span>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-[var(--primary)] hover:underline"
                          >
                            {item.issueId}
                          </a>
                        ) : (
                          <span className="font-mono text-xs text-[var(--primary)]">{item.issueId}</span>
                        )}
                        <span>: {item.title}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <button
              onClick={handleCopy}
              className="absolute top-0 right-0 px-3 py-1.5 text-xs rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Stat chips */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
            <div className="px-3 py-1 rounded-md bg-[var(--background)] text-xs">
              <span className="text-[var(--muted)]">Requests this week:</span>{" "}
              <span className="font-medium">{stats.requestsThisWeek}</span>
            </div>
            <div className="px-3 py-1 rounded-md bg-[var(--background)] text-xs">
              <span className="text-[var(--muted)]">Linked to existing:</span>{" "}
              <span className="font-medium text-green-400">{stats.linkedToExisting}</span>
            </div>
            <div className="px-3 py-1 rounded-md bg-[var(--background)] text-xs">
              <span className="text-[var(--muted)]">New ideas:</span>{" "}
              <span className="font-medium text-blue-400">{stats.newIdeasThisWeek}</span>
            </div>
            {stats.unlinkedTotal > 0 && (
              <div className="px-3 py-1 rounded-md bg-[var(--background)] text-xs">
                <span className="text-[var(--muted)]">Unlinked total:</span>{" "}
                <span className="font-medium text-yellow-400">{stats.unlinkedTotal}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: Backlog movement */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Backlog Movement</h2>
        <p className="text-sm text-[var(--muted)]">Biggest vote gainers (this week)</p>

        {stats.topGainers.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 text-center">
            <p className="text-[var(--muted)]">No votes recorded this week</p>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)]">
                    Issue
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-[var(--muted)]">
                    +Votes
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-[var(--muted)]">
                    Total
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-[var(--muted)]">
                    Companies
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)]">
                    Top requesters
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.topGainers.map((item) => (
                  <tr
                    key={item.issueId}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <LinearIssueLink issueId={item.issueId} title={item.title} />
                        <span className="text-sm truncate max-w-[250px]" title={item.title}>
                          {item.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-green-400 font-medium">+{item.weekVotes}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{item.totalVotes}</td>
                    <td className="px-4 py-3 text-center">
                      {new Set(item.companies.filter(Boolean)).size}
                    </td>
                    <td className="px-4 py-3">
                      <CompanyPills companies={item.companies} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 3: New leader callout */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Leader Status</h2>
        {stats.currentLeader ? (
          <div
            className={`border rounded-lg p-4 ${
              stats.leaderChanged
                ? "bg-green-600/10 border-green-600/30"
                : "bg-[var(--card)] border-[var(--border)]"
            }`}
          >
            {stats.leaderChanged ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-lg">★</span>
                  <span className="font-semibold text-green-400">New leading feature request!</span>
                </div>
                <p className="text-lg font-medium">{stats.currentLeader.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  Now #1 with{" "}
                  <span className="text-[var(--foreground)] font-medium">
                    {stats.currentLeader.totalVotes} votes
                  </span>
                  , requested by{" "}
                  <span className="text-[var(--foreground)] font-medium">
                    {new Set(stats.currentLeader.companies.filter(Boolean)).size} companies
                  </span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-[var(--muted)]">Leading request remains:</p>
                <p className="text-lg font-medium">{stats.currentLeader.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  <span className="text-[var(--foreground)] font-medium">
                    {stats.currentLeader.totalVotes} votes
                  </span>{" "}
                  from{" "}
                  <span className="text-[var(--foreground)] font-medium">
                    {new Set(stats.currentLeader.companies.filter(Boolean)).size} companies
                  </span>
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <p className="text-[var(--muted)]">No issues with votes yet</p>
          </div>
        )}
      </section>

      {/* SECTION 4: Top requests overall */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Top Requests Overall</h2>
        <p className="text-sm text-[var(--muted)]">All-time top 10 by total votes</p>

        {stats.topOverall.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 text-center">
            <p className="text-[var(--muted)]">No voted issues yet</p>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="text-center px-4 py-3 text-sm font-medium text-[var(--muted)] w-12">
                    #
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)]">
                    Issue
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-[var(--muted)]">
                    Votes
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-[var(--muted)]">
                    Companies
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--muted)]">
                    Requesters
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.topOverall.map((item, idx) => (
                  <tr
                    key={item.issueId}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                          idx === 0
                            ? "bg-yellow-500/20 text-yellow-400"
                            : idx === 1
                            ? "bg-gray-400/20 text-gray-300"
                            : idx === 2
                            ? "bg-amber-600/20 text-amber-500"
                            : "bg-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <LinearIssueLink issueId={item.issueId} title={item.title} />
                        <span className="text-sm truncate max-w-[250px]" title={item.title}>
                          {item.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{item.totalVotes}</td>
                    <td className="px-4 py-3 text-center">
                      {new Set(item.companies.filter(Boolean)).size}
                    </td>
                    <td className="px-4 py-3">
                      <CompanyPills companies={item.companies} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
