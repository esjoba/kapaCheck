import type { Metadata } from "next";
import Link from "next/link";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kapas 6th sense",
  description: "Daily actions for Product @ kapa",
};

const navItems = [
  { href: "/ingest", label: "Ingest data" },
  { href: "/review", label: "Review new feedback" },
  { href: "/linear", label: "Update Linear" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <nav className="border-b border-[var(--border)] bg-[var(--card)]">
            <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-8">
              <Link href="/" className="font-semibold text-lg">
                Kapas 6th sense
              </Link>
              <div className="flex gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-2 rounded-md text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
          <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
