# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kapas 6th sense is a Next.js app for daily actions for Product @ kapa. It provides three main workflows: data ingestion, feedback review, and Linear updates.

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
src/app/
├── layout.tsx      # Root layout with navigation
├── page.tsx        # Home page
├── globals.css     # Global styles and CSS variables
├── ingest/         # Data ingestion page
├── review/         # Feedback review page
└── linear/         # Linear updates page
```

The app uses CSS variables for theming (defined in `globals.css`) with a dark color scheme.
