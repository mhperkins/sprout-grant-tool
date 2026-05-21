# Grant Profile JSON Schema
**Version:** 1.0  
**Status:** Active  
**Owner:** Grant Tool V2  
**Last Updated:** May 2026  
**Pairs with:** Funder Brief Protocol, Grant Finding Protocol  

---

## Purpose

When Claude generates a grant profile for import into the Grant Manager, it must match this schema exactly. The Import modal validates on `funder` and `grantName` at minimum, but a complete profile with all fields populated produces a workspace that's ready to write — not one that needs manual cleanup after import.

**Always deliver grant profiles as valid JSON.** Single grant: a plain object `{ }`. Multiple grants: an array `[ { }, { } ]`.

---

## Full Schema

```json
{
  "id": "",
  "funder": "Foundation or agency name",
  "grantName": "Specific grant or program name",
  "amount": 25000,
  "deadline": "2026-08-15",
  "status": "not_started",
  "applicationUrl": "https://...",
  "framingNotes": "How Sprout Society should position this application. Key angles, language to use, pitfalls to avoid.",

  "questions": [
    {
      "id": "q1",
      "category": "narrative",
      "question": "Exact question text from the application",
      "hint": "Writing guidance for this specific funder — what they want to hear, what to avoid",
      "charLimit": 1500,
      "draft": ""
    }
  ],

  "tasks": [
    {
      "id": "t1",
      "text": "Specific task required for this application",
      "done": false
    }
  ],

  "contacts": [
    {
      "id": "c1",
      "name": "Program Officer Name",
      "title": "Program Officer, [Program Name]",
      "email": "",
      "notes": "Any context about this contact — how they describe the fund, their stated priorities"
    }
  ],

  "notes": "Free-form research notes, alignment observations, prior relationship history",
  "funderBrief": "Paste the completed Funder Research Brief here after running the Funder Brief Protocol",
  "funderBriefUpdatedAt": null,

  "createdAt": "",
  "updatedAt": ""
}
```

---

## Field Reference

### Top-Level Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | No | Leave empty — tool generates on import |
| `funder` | string | **Yes** | Org or agency name |
| `grantName` | string | **Yes** | Specific grant/program name |
| `amount` | number | No | Integer, no commas or $ sign |
| `deadline` | string | No | `YYYY-MM-DD` format only |
| `status` | string | No | See status values below |
| `applicationUrl` | string | No | Direct link to application portal |
| `framingNotes` | string | No | Strategic framing for this specific funder |
| `notes` | string | No | Research notes, alignment, history |
| `funderBrief` | string | No | Completed Funder Research Brief — paste after running the protocol |

### Status Values

```
not_started    default for new grants
in_progress    actively writing
submitted      application sent
awarded        funded
rejected       not funded this cycle
future         good fit but not applying yet
```

### questions Array

Each question object represents one application question.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Short unique ID: `q1`, `q2`, etc. Used for answer matching on re-import |
| `category` | string | No | `narrative`, `impact`, `equity`, `budget`, `financials` |
| `question` | string | Yes | Exact question text from the application |
| `hint` | string | No | Funder-specific writing guidance — what this funder cares about, what language to use |
| `charLimit` | number | No | Character limit if stated in the guidelines |
| `draft` | string | No | Leave empty on first import — filled in the workspace |

**Question categories:**

| Category | Use for |
|---|---|
| `narrative` | Mission, history, program descriptions |
| `impact` | Outcomes, measurement, who benefits |
| `equity` | DEI, underserved communities, access |
| `budget` | Budget narrative, use of funds |
| `financials` | Org financials, funding sources |

### tasks Array

Tasks are application requirements that aren't narrative questions — documents to gather, signatures to get, portal registrations, etc.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Short unique ID: `t1`, `t2`, etc. |
| `text` | string | Yes | Specific, actionable task description |
| `done` | boolean | Yes | Always `false` on import |

### contacts Array

Program officers or other key contacts at the funder. Different from Sprout Society's CRM contacts.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Short unique ID: `c1`, `c2`, etc. |
| `name` | string | Yes | Full name |
| `title` | string | No | Title and program area |
| `email` | string | No | Only if publicly available — never guess |
| `notes` | string | No | Context from research — what they emphasize, their stated priorities |

---

## Generating a Complete Profile: What to Include

A well-built grant profile saves time in the workspace. When generating JSON for import, include:

**Always:**
- `funder`, `grantName`, `amount`, `deadline`, `status`
- `applicationUrl` if the portal URL is known
- `framingNotes` with the top 2-3 Sprout Society alignment angles for this funder
- All application questions with accurate `charLimit` and specific `hint` values

**When research supports it:**
- `notes` with Phase A-D output from the Funder Research Brief Protocol
- `contacts` with verified program officer names and titles
- `tasks` with registration requirements, document uploads, or board signatures needed

**Leave empty:**
- `id`, `createdAt`, `updatedAt` — generated on import
- `draft` on all questions — filled in the workspace
- `funderBrief` — pasted in after running the full protocol separately

---

## Example: Minimal Valid Profile

```json
{
  "funder": "NYC Department of Cultural Affairs",
  "grantName": "Cultural Development Fund — General Operating",
  "amount": 15000,
  "deadline": "2026-09-12",
  "status": "not_started",
  "applicationUrl": "https://www.nyc.gov/site/dcla/organizations/cdf.page",
  "framingNotes": "Lead with free community space and peer support angle. Emphasize Brooklyn geographic focus and underserved communities. Budget under $100K is typical for this program.",
  "questions": [
    {
      "id": "q1",
      "category": "narrative",
      "question": "Describe your organization's mission and primary activities.",
      "hint": "DCLA values cultural access and community engagement. Lead with the space and the people it serves, not clinical outcomes.",
      "charLimit": 2000,
      "draft": ""
    },
    {
      "id": "q2",
      "category": "impact",
      "question": "How will this funding support your work in the coming year?",
      "hint": "Be specific about what general operating funds free up — staff time, programming, space costs.",
      "charLimit": 1000,
      "draft": ""
    }
  ],
  "tasks": [
    { "id": "t1", "text": "Register on Foundant portal before applying", "done": false },
    { "id": "t2", "text": "Upload current 990 and board list", "done": false }
  ],
  "contacts": [],
  "notes": "",
  "funderBrief": ""
}
```

---

## Re-importing Updated Answers

The Import modal supports re-importing a profile with updated `draft` values to overwrite existing answers. Matching happens by question `id` first, then by position. Always keep `id` values stable across re-imports — changing them breaks matching and may scramble answers.

Before overwriting, the workspace saves the existing draft to `versions` history automatically. Nothing is permanently lost on re-import.

---

## Claude Prompt for Generating a Grant Profile

```
Generate a grant profile JSON for [FUNDER NAME] — [GRANT PROGRAM NAME].

Use the Grant Profile Schema from Grant Profile Schema.md.

Known details:
- Application URL: [URL]
- Deadline: [date]
- Amount: [range or exact]
- Any other context: [paste guidelines, notes, or research]

Include:
- All application questions with accurate charLimits and funder-specific hints
- framingNotes with the top 2-3 Sprout Society alignment angles
- tasks for any registration, document, or non-narrative requirements
- contacts if program officer is publicly identified in the guidelines

Leave draft empty on all questions. Leave id, createdAt, updatedAt empty.
Output valid JSON only — no markdown fences, no commentary outside the JSON.
```
