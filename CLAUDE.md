# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kapas 6th Sense is a Next.js app for daily Product actions at kapa. It helps link Slack customer feedback to Linear issues using text similarity matching. The app has four main workflows:

1. **Ingest Data** - Import Linear issues and Slack messages
2. **Review Feedback** - Process messages with AI-suggested issue matches
3. **Consolidation Opportunities** - Find duplicate/similar Linear issues
4. **Update Linear** - Manage and review all message-to-issue links

## Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Tech Stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS v4

## Architecture

```
src/
├── app/
│   ├── layout.tsx           # Root layout with navigation
│   ├── page.tsx             # Home page
│   ├── globals.css          # Global styles and CSS variables
│   ├── providers.tsx        # React context providers
│   ├── ingest/              # Data ingestion page
│   ├── review/              # Feedback review page
│   ├── consolidation/       # Consolidation opportunities page
│   ├── linear/              # Update Linear page
│   └── api/
│       ├── consolidation-opportunities/  # API for pairwise similarity
│       ├── linear-export/   # Fetch FEED issues from Linear API
│       └── slack-export/    # Fetch messages from Slack API
├── components/
│   └── LinearIssueLink.tsx  # Clickable Linear issue ID component
├── lib/
│   ├── similarity.ts        # TF-IDF cosine similarity functions
│   ├── csvParser.ts         # Linear CSV import parser (supports both formats)
│   └── linearUrl.ts         # Linear URL generation utility
└── store/
    └── AppContext.tsx       # React Context state with localStorage
```

## State Management

The app uses React Context (`AppContext`) with localStorage persistence. State includes:
- `linearIssues` - Array of Linear issues (id, title, description, status)
- `slackMessages` - Array of Slack messages (id, rawText, parsed fields, reviewed status)
- `mappings` - Links between Slack messages and Linear issues

## Key Algorithms

### Text Similarity (`lib/similarity.ts`)
- Tokenization with stopword removal
- Term frequency calculation
- Cosine similarity between TF vectors
- Used for both Slack→Linear matching and consolidation

### Consolidation Optimization
- Brute force for ≤400 issues
- Token bucketing for larger datasets (compares only issues sharing 2+ top tokens)

## API Integrations

### Linear API (`/api/linear-export`)
- Fetches FEED team issues updated in the past 12 months
- Exports to CSV with: identifier, title, description, status, team, creator, assignee, priority, labels, customerCount, customers, customerRequests, dates, url
- Requires Linear API key (from Linear Settings → API)

### Slack API (`/api/slack-export`)
- Fetches messages from #kapa-customer-feedback channel
- Configurable date range (default: last 24 hours)
- Requires Bot Token with scopes: `channels:read`, `channels:history` (or `groups:*` for private channels)

### CSV Parser (`lib/csvParser.ts`)
- Auto-detects format from headers
- Supports both manual Linear export (ID column) and API export (identifier column)
- Header-based column mapping for flexibility

## Theming

The app uses CSS variables for theming (defined in `globals.css`) with a dark color scheme. Key variables:
- `--background`, `--foreground` - Main colors
- `--card`, `--border`, `--muted` - UI elements
- `--primary`, `--primary-hover` - Accent colors
