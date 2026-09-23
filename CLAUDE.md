# Grant Tool V2 — CLAUDE.md

> Project memory and context for Claude Code. Not committed to git.

---

## What This Is

A standalone Next.js grant management tool for Sprout Society. Tracks the full grant lifecycle: pipeline view, per-grant writing workspace, Claude-powered JSON import, funder research brief storage, and org profile editing.

**V2 vs V1:** V2 is a clean rewrite. Storage moved from `window.storage` / localStorage (V1 pattern) to Supabase-native. The `lib/storage.js` file is a leftover localStorage polyfill from V1 — it is not used by any V2 code. Do not reference it.

---

## Architecture

| Layer | Detail |
|---|---|
| Framework | Next.js (App Router), plain JavaScript — no TypeScript |
| Database | Supabase (`sprout_grants`, `sprout_profile`, `sprout_contacts` tables) |
| Auth | None — no login screen, no Supabase auth |
| AI | No API routes. Claude runs in the conversation; output is pasted into the Import modal |
| Deployment | Local dev only (not yet on Vercel) |

---

## Key Files

| File | Role |
|---|---|
| [app/page.js](app/page.js) | Entry point. Dynamically imports `GrantManagerV2` with `ssr: false`. |
| [components/GrantManagerV2.jsx](components/GrantManagerV2.jsx) | **The entire UI** (~1,600 lines). All views, Supabase helpers, and styles live here. |
| [lib/supabase.js](lib/supabase.js) | Supabase client singleton using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| [lib/storage.js](lib/storage.js) | V1 localStorage polyfill. **Not used by V2.** Ignore it. |
| [Funder Brief Protocol.md](Funder Brief Protocol.md) | Research protocol for deep funder analysis (Phases A-G). |
| [grant finding protocol.txt](grant finding protocol.txt) | Protocol for discovering and pre-filtering new grants. Includes the org profile block for Claude context. |
| [grant research protocol.txt](grant research protocol.txt) | Supporting grant research guidance. |
| [Grant Profile Schema.md](Grant Profile Schema.md) | JSON schema reference for grant profile import. Use this when generating import JSON. |

---

## Supabase Tables

| Table | Shape | Notes |
|---|---|---|
| `sprout_grants` | `{ id: text PK, data: jsonb, updated_at: timestamptz }` | One row per grant. `data` is the full grant object. |
| `sprout_profile` | `{ id: text PK, data: jsonb, updated_at: timestamptz }` | Single row: `id = "profile"`. Shared with CRM. |
| `sprout_contacts` | `{ id: text PK, data: jsonb, updated_at: timestamptz }` | Single row: `id = "contacts"`. Value is a contacts array. Read-only in this tool. |

---

## Supabase Helpers (top of GrantManagerV2.jsx)

All DB calls go through these — never write raw Supabase calls in render functions or event handlers.

| Helper | What it does |
|---|---|
| `dbGetGrants()` | Fetch all grants, return as array |
| `dbSetGrants(array)` | Upsert all, delete removed rows |
| `dbDeleteGrant(id)` | Hard delete one grant |
| `dbGetProfile()` | Fetch org profile |
| `dbSetProfile(profile)` | Upsert org profile |
| `dbGetContacts()` | Fetch contacts array (read-only in this tool) |

---

## Views

| View ID | Component | What it shows |
|---|---|---|
| `pipeline` | `PipelineView` | All grants in a sortable table with status, deadline, progress |
| `workspace` | `WorkspaceView` | Per-grant editor: questions, tasks, contacts, funder brief, export |
| `import` | `ImportView` | JSON paste from Claude or manual entry form |
| `contacts` | `ContactsView` | Read-only view of CRM contacts (from `sprout_contacts`) |
| `orgProfile` | `OrgProfileView` | Edit Sprout Society org profile |

---

## Grant Status Values

```
not_started   Not Started
in_progress   In Progress
submitted     Submitted
awarded       Awarded
rejected      Not Funded
future        Future Pipeline
```

---

## Coding Conventions

- **Single-file UI.** All UI lives in `GrantManagerV2.jsx`. Do not split into separate component files unless explicitly asked.
- **No TypeScript.** Plain `.js` and `.jsx` throughout.
- **No Tailwind / CSS frameworks.** All styles live in the `STYLES` template literal at the top of the file, injected via `<style>{STYLES}</style>`. Use inline `style={{}}` for one-offs only.
- **No test suite.**
- **DB calls go through the `db*` helpers.** Never call `supabase` directly from a component render or event handler.
- **`uid()`** generates short random IDs for new grants, questions, tasks, and contacts.

---

## How to Add a New View

1. Add a nav entry to the `Sidebar` component.
2. Add a case in the main render block inside `App` (around line 1595).
3. Write the view component above `App` in the same file.

---

## Grant Profile JSON (Import Format)

See [Grant Profile Schema.md](Grant Profile Schema.md) for the full schema.

Minimum required fields for import: `funder`, `grantName`.

When generating import JSON for Claude to paste in, always include `questions` as an array with `id`, `question`, `hint`, `charLimit`, and `draft` fields. The import modal matches answers by `id`, then falls back to position order.

---

## Common Tasks

**Add a new status value:**
1. Add to `STATUS_LABELS` constant at top of `GrantManagerV2.jsx`
2. Add a CSS rule for `.t-[status]` in the `STYLES` block
3. Add to the status dropdown in `ImportView` and `WorkspaceView`

**Add a field to the grant object:**
1. Add to the import normalization in `ImportView.handleImportJSON`
2. Add to `DEFAULT_ORG` or the grant object shape if it needs a default
3. Add the UI in `WorkspaceView`

**Add a question template:**
1. Add a new key to `TEMPLATE_QUESTIONS` with an array of question objects
2. Add the option to the template selector dropdown in `ImportView`

---

## End-of-Session Protocol

> 🚨 **"update current state" = FOUR steps, ALWAYS. Not two.** Docs alone is an incomplete response.
> Steps **3 (commit and push)** and **4 (delivery slide)** are **NON-NEGOTIABLE** and the most often
> forgotten. If you are about to reply after only steps 1 and 2, STOP. You are not done.

When Max says "update current state", do all four automatically, with no separate prompt. Do not stop,
do not ask, do not report back until all four are complete.

1. **Rewrite the Current State section of this file.** Replace it with this session's snapshot. Prune finished items, add new
   ones. Overwrite, do not append.
2. ****Add a `CHANGELOG.md` entry** at the project root: what changed, why, the effort level and the date, newest at the top. **The file does not exist yet**, so the first session to run this protocol creates it.**
3. **➡️ COMMIT AND PUSH (do not skip).** Use the **PowerShell tool** for all git. Stage the session's
   work **by name, never `-A`**, or a parallel session's uncommitted work gets swept in under a message
   that does not mention it. Commit on **`main`** with a clear message ending in the
   `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` line, then
   `git push origin main`. `CLAUDE.md` **is tracked here**, so the rewritten Current State goes into the commit.
4. **➡️ BUILD THE DELIVERY SLIDE (do not skip).** One self-contained HTML slide detailing what was
   committed and pushed: cards, badges, icons, the commit hash and the branch, built fresh in this
   project's palette. Save it to ``docs/deliveries/<YYYY-MM>/<YYYY-MM-DD>/`` with a date-prefixed filename (create the month folder on the month's first delivery, the date folder on the day's first), and name
   the path in the reply. Every delivery from one day shares that day's folder.

**Self-check before replying:** Did I commit? Did I push? Did I write the slide? If any answer is no,
the protocol is unfinished.

**The canonical version is in `~/.claude/CLAUDE.md`** under "End-of-Session Protocol (every project)".
This copy carries it in full on purpose, so this project never depends on that file being loaded. Where
the two differ, **this file wins**, because the values above are this project's.
