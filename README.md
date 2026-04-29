# Sprout Society — Grant Manager v2

Grant pipeline and workspace for **Sprout Society Inc.** (EIN 83-1298420).

Built with Next.js 14 + React 18. No database required for local dev — data
persists in `localStorage`.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How storage works

The Grant Manager uses a `window.storage` key-value API.

| Environment | Storage backend |
|---|---|
| Claude.ai artifact | Claude's built-in persistent storage (cross-session) |
| Local dev (`npm run dev`) | `localStorage` (persists across page reloads, browser-only) |

The `lib/storage.js` polyfill handles the local fallback automatically — no
config needed. Data written locally stays in your browser's `localStorage`
under keys prefixed with `sprout_v2_`.

---

## Project structure

```
sprout-grant-tool/
├── app/
│   ├── globals.css       # Minimal reset (component injects its own styles)
│   ├── layout.js         # Root layout + metadata
│   └── page.js           # Renders <GrantManagerV2 />
├── components/
│   └── GrantManagerV2.jsx  # The full Grant Manager (brand-styled, self-contained)
├── lib/
│   └── storage.js        # localStorage polyfill for window.storage
├── public/               # Static assets
├── package.json
└── README.md
```

---

## Grant profile import format

In the Claude conversation, ask Claude to "build a grant profile JSON for
[Funder Name]". Paste the JSON output into the tool's **Add Grant → Import
from Claude** view.

Required fields: `funder`, `grantName`, `deadline`, `status`

Optional: `questions[]`, `tasks[]`, `contacts[]`, `framingNotes`,
`applicationUrl`, `amount`

---

## Sprout Society

- Address: 449 Troutman St, Brooklyn NY 11237
- Website: sproutsociety.org
- EIN: 83-1298420
- Founded: 2019
