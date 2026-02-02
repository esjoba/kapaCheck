# Kapas 6th Sense

A tool for daily Product actions at kapa. Link Slack feedback to Linear issues with smart similarity matching.

## Features

- **Ingest Data**: Upload Linear issues (CSV or JSON) and paste Slack messages
- **Review Feedback**: Card-based review with similarity-based suggestions, manual search, and "Create new idea" for novel feedback
- **Update Linear**: Table view of all messages with linking status, change/unlink actions, and summary stats

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- Next.js 16 with App Router
- React 19 + TypeScript
- Tailwind CSS v4
- Client-side state with localStorage persistence
