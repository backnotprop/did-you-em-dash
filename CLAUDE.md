# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Did you em dash?" is a single-page Astro application that searches Hacker News submissions to determine if a user has used em dashes in their writing. The app searches through a user's comments and optionally story titles for various em dash patterns, with both loose matching (--,––,——,–,—) and strict matching (— only).

Proove you used em dash before ChatGPT.

## Development Commands

- `npm run dev` - Start development server at localhost:4321
- `npm run build` - Build static site to ./dist/
- `npm run preview` - Preview built site locally

## Architecture

### Core Technologies

- **Astro** with React integration and static output
- **React 19** with TypeScript for the main application component
- **Single-page architecture** with one main React component

### Key Components

**src/components/App.tsx** - The entire application logic including:

- Hacker News API integration with concurrent batch processing
- Two search modes: loose (multiple dash types) vs strict (true em dashes only)
- Real-time progress tracking with animated loading states
- URL query parameter support for shareable searches
- Inline badge toggles for search settings

**src/pages/index.astro** - Minimal Astro wrapper that renders the React app with `client:load`

### Search Logic Architecture

The search functionality is built around these key patterns:

1. **Dual Regex System**: `LOOSE_EM_DASH_REGEX` vs `STRICT_EM_DASH_REGEX` for different matching strictness
2. **Concurrent Processing**: Searches submissions in batches of 10 for performance
3. **Content Filtering**: Comments-only by default, optionally includes story titles
4. **Temporal Filtering**: Only searches content before November 30, 2022
5. **Progressive Search**: Stops at first match (oldest-first order)

### State Management Patterns

The app uses React hooks with careful dependency management:

- `useCallback` for `performSearch` to prevent infinite re-renders
- `useEffect` for URL parameter parsing and auto-submission
- Settings state (`strictMode`, `includeStories`) affects search behavior

### URL Parameter Support

- `?username=someuser` - Auto-populate and search for user
- `?strict=true` or `?strict=1` - Enable strict em dash mode
- Combined: `?username=pg&strict=true`

### Visual Feedback System

- **Badge UI**: Inline "strict" and "+titles" toggles within input field
- **Progress States**: "retrieving" → "searching" → "found"/"failed"
- **Dynamic Title**: Changes based on strict mode setting
- **Result Display**: Shows found post with link to original HN item

## Important Implementation Notes

- The search function must be declared before any `useEffect` that depends on it to avoid initialization errors
- Settings badges use visual state (color/opacity) to indicate active/inactive modes
- All search results link back to original Hacker News posts
- The app handles invalid usernames gracefully and validates before auto-submission
