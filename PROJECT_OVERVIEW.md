# Jobfolio

Jobfolio is a personal workspace for organizing a job search. It brings job opportunities, application progress, notes, and application documents together in one place, helping users keep track of their next career move.

## What users can do

- **Save opportunities:** Add a job title, company, job posting link, salary requirement, and personal notes. All form fields are optional, so an opportunity can be saved before every detail is available.
- **Track progress:** Move applications through five statuses: **Saved**, **Applied**, **Interview**, **Offer**, and **Closed**.
- **Find applications:** Search by job title, company, or notes, and filter by status. Applications appear with the most recently created first.
- **Manage documents:** Attach one CV or résumé and one cover letter to each application. Download, replace, or remove those documents later.
- **Edit and delete records:** Update application details or delete an application and its attached documents after confirming the deletion.

Supported document formats are PDF, DOC, DOCX, and TXT, with a maximum size of 10 MB per document.

## Typical workflow

1. Sign in with ChatGPT.
2. Create an application with any details currently available.
3. Attach the CV and cover letter used for that opportunity, if needed.
4. Update the status as the application progresses.
5. Use search, filters, and the application detail view to revisit opportunities and retrieve documents.

## How the application works

The browser displays a React dashboard and communicates with server API routes. Application records are stored in Cloudflare D1 through Drizzle ORM. Uploaded documents are stored separately in Cloudflare R2, with their storage keys and original filenames recorded in the database.

Authentication uses the hosting platform's Sign in with ChatGPT integration. Server routes use the authenticated user's stable ID to scope database operations. Document downloads also check that the requested application belongs to the current user.

## Technology stack

| Area | Technology |
| --- | --- |
| Interface | React 19 and TypeScript |
| Application routing | Next.js App Router conventions, running through Vinext |
| Development and builds | Vite |
| Styling and icons | CSS, Tailwind CSS tooling, and Lucide React |
| Server runtime | Cloudflare Workers |
| Application database | Cloudflare D1 with Drizzle ORM |
| Document storage | Cloudflare R2 |
| Authentication | Platform-managed Sign in with ChatGPT |

## Project structure

```text
jobfolio/
├── app/
│   ├── page.tsx                  # Dashboard entry point
│   ├── tracker.tsx               # Application list, forms, and detail dialogs
│   ├── globals.css               # Application styling
│   ├── layout.tsx                # Shared layout and page metadata
│   ├── chatgpt-auth.ts           # Server-side authentication helpers
│   └── api/
│       ├── applications/route.ts # List, create, edit, update status, and delete
│       └── documents/[id]/[kind]/route.ts
│                                 # Download a CV or cover letter
├── db/
│   ├── index.ts                  # D1 database connection
│   └── schema.ts                 # Application data model
├── drizzle/                      # SQL migrations and migration metadata
├── components/ui/                # Reusable UI components included with the starter
├── public/                       # Fonts and favicon
├── worker/index.ts               # Cloudflare Worker entry point
├── scripts/                      # Runtime, installation, and build helpers
├── .openai/hosting.json          # Hosting and storage binding declarations
└── README.md                     # Detailed starter and runtime documentation
```

## Data model

Each application stores a unique ID, its owner's user ID, job title, company, posting URL, salary requirement, status, notes, and creation timestamp. It also stores the filenames and R2 keys for its CV and cover letter. Applications start with the status `Saved` unless another valid status is supplied.

The hosting configuration declares two bindings:

- `DB`: Cloudflare D1 database for application records.
- `BUCKET`: Cloudflare R2 bucket for uploaded documents.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/applications` | List the current user's applications |
| `POST` | `/api/applications` | Create an application using multipart form data |
| `PUT` | `/api/applications` | Edit an application and optionally replace or remove documents |
| `PATCH` | `/api/applications` | Update an application's status |
| `DELETE` | `/api/applications` | Delete an application and its documents |
| `GET` | `/api/documents/[id]/[kind]` | Download an attached document; `kind` is `cv` or `letter` |

All application and document routes require authentication. Application writes check the request's origin when an Origin header is present. Upload validation checks filename extensions and file sizes; it does not inspect document contents.

## Running locally

Use Node.js **22.13.0 or newer**. From the workspace root:

```sh
cd jobfolio
npm run install:ci
npm run build
```

For a fresh local database, apply the existing migration after the build has generated the Wrangler configuration:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_nasty_kylun.sql
```

Run this migration only if it has not already been applied to the local database. Then start the development server:

```sh
npm run dev
```

The portable development server normally starts at `http://localhost:5173`; use the URL printed by the command. In portable loopback development, visiting `/signin-with-chatgpt?return_to=/` creates the starter's mock development identity. Hosted authentication is managed by the platform.

Other available commands:

| Command | Purpose |
| --- | --- |
| `npm run build` | Generate the deployment build |
| `npm start` | Preview the built Worker locally |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate migrations after database schema changes |

See [README.md](README.md) for execution profiles, hosting integration, and additional setup details.

## Current scope

Jobfolio currently focuses on manually managing applications and their documents. The implemented dashboard does not provide automated job importing, application submission, reminders, interview scheduling, or AI-generated application materials.
