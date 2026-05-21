# Sprout Society Grant Manager V2

Internal grant management tool for Sprout Society. Tracks the full grant lifecycle from discovery to award.

## Features

- Grant pipeline with status tracking and deadline urgency
- Per-grant writing workspace with question editor, version history, and character counters
- Claude-powered JSON import: paste a generated grant profile to create a fully populated workspace
- Funder research brief storage alongside each application
- Org profile editor shared with the CRM
- Read-only view of CRM contacts

## Stack

Next.js, Supabase, Vercel

## Status

Local development — not yet deployed to Vercel

## Project Files

| File | Purpose |
|---|---|
| `CLAUDE.md` | Coding context for Claude Code sessions |
| `Grant Profile Schema.md` | JSON schema for Claude-generated grant profiles |
| `Funder Brief Protocol.md` | Research protocol for deep funder analysis |
| `grant finding protocol.txt` | Protocol for discovering and pre-filtering new grants |
| `grant research protocol.txt` | Supporting grant research guidance |

## V2 Changes from V1

- Storage moved from `window.storage` / localStorage to Supabase-native
- One Supabase row per grant instead of one JSON blob for all grants
- Removed auth screen — no login required
- Removed SocialManager — social tool is now its own standalone repo
- Cleaner single-component architecture