# Run 1 architecture

One TypeScript Next.js application serves `/shop`, `/app`, `/admin`, and typed zod-validated route handlers on Vercel. Drizzle accesses managed Neon PostgreSQL. A separate long-running Node/pg-boss worker runs on Railway; Vercel Cron may call authenticated scheduling endpoints, never host the worker. Production photos require an S3-compatible bucket such as Cloudflare R2. Development photos can live in an untracked local private directory on a persistent host; both adapters serve expiring signed URLs. Local storage is blocked on Vercel and in production. Adapters isolate Gemini, email, SMS, and future embedding/WhatsApp implementations.

Server-side flags have a PostgreSQL source, cohort rules, audit trail and approximately 30-second process cache. Production defaults are off; missing prerequisite configuration prevents enabling. Events are append-only. An entitlement stub supplies configured free-tier limits without affecting search or recommendation ordering.

Request processing follows hard filters, scoring, tie-break ranking, presentation, explicit customer selection, and outcome logging. No recommendation is an automatic forward. UTC timestamps and PostgreSQL range exclusion constraints protect availability; district timezones govern input conversion and quiet hours. Structured attributes use exact values; pg_trgm is restricted to free text. Future runs can add tables and adapters without Run 1 placeholders for later features.

The schema is expanded up front in `src/db/migrations/0001_run1.sql`; no later-run tables are created. All demo records are fictional, marked fake and synthetic. The runtime must never treat demo media as a real listing photo.
