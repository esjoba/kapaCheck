/**
 * Generate a Linear issue URL from issue ID and title
 * Format: https://linear.app/kapa/issue/{ISSUE_ID}/{slug}
 */
export function getLinearIssueUrl(issueId: string, title: string): string {
  // Convert title to URL-friendly slug
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length

  return `https://linear.app/kapa/issue/${issueId}/${slug}`;
}

/**
 * Check if an issue ID is a local placeholder (not a real Linear issue)
 */
export function isLocalIssue(issueId: string): boolean {
  return issueId.startsWith("LOCAL-");
}
