"use client";

import { getLinearIssueUrl, isLocalIssue } from "@/lib/linearUrl";

interface LinearIssueLinkProps {
  issueId: string;
  title: string;
  className?: string;
}

/**
 * Renders a clickable Linear issue ID that opens the issue in Linear
 * For local placeholder issues (LOCAL-xxx), renders as plain text
 */
export function LinearIssueLink({ issueId, title, className = "" }: LinearIssueLinkProps) {
  const baseClassName = `font-mono text-xs text-[var(--primary)] ${className}`;

  // Local issues don't have a Linear URL
  if (isLocalIssue(issueId)) {
    return (
      <span className={baseClassName} title="Local placeholder issue">
        {issueId}
      </span>
    );
  }

  const url = getLinearIssueUrl(issueId, title);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClassName} hover:underline`}
      title={`Open ${issueId} in Linear`}
    >
      {issueId}
    </a>
  );
}
