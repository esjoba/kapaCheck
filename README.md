# Kapas 6th Sense

A tool for daily Product actions at kapa. Link Slack feedback to Linear issues with smart similarity matching.

## Features

### Ingest Data
- Upload Linear issues from CSV or JSON exports
- Paste Slack messages with automatic field parsing (WHO, TOPIC, ISSUE/REQUEST)
- Supports both Slack API JSON format and plain text input

### Review Feedback
- Card-based review interface for processing Slack messages one at a time
- Similarity-based suggestions showing top 3 matching Linear issues
- Manual search across all Linear issues
- "Create new idea" option for novel feedback (creates LOCAL-xxx placeholder)
- Mark messages as reviewed, filter by review status

### Consolidation Opportunities
- Find similar Linear issues that might be duplicates
- Adjustable similarity threshold (0.3-0.9)
- Token bucketing optimization for large datasets (>400 issues)
- Expandable descriptions for side-by-side comparison

### Update Linear
- Table view of all messages with linking status
- Change or unlink issue associations
- Summary stats: total, linked, unlinked counts
- Confidence scores for each link

### Clickable Issue IDs
- All Linear issue IDs link directly to Linear
- URL format: `https://linear.app/kapa/issue/{ID}/{slug}`
- Local placeholder issues show as plain text

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
- TF-IDF cosine similarity for text matching
