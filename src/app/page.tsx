import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome to Kapas 6th sense</h1>
      <p className="text-[var(--muted)]">
        Your daily actions hub for Product @ kapa. Select a tab above to get started.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/ingest"
          className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
        >
          <h2 className="font-semibold mb-1">Ingest data</h2>
          <p className="text-sm text-[var(--muted)]">Import and process new data sources</p>
        </Link>
        <Link
          href="/review"
          className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
        >
          <h2 className="font-semibold mb-1">Review new feedback</h2>
          <p className="text-sm text-[var(--muted)]">Review and categorize incoming feedback</p>
        </Link>
        <Link
          href="/linear"
          className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
        >
          <h2 className="font-semibold mb-1">Update Linear</h2>
          <p className="text-sm text-[var(--muted)]">Sync updates to Linear issues</p>
        </Link>
      </div>
    </div>
  );
}
