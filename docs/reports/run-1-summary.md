# Run 1 summary — scaffold, not launch-ready

## What shipped

Five separate commits cover Foundations, Inventory, Photo entry and availability, Marketplace and search, and Requests and recommendations v1. The Run 1 migrations define district configuration, inventory, consent, availability, recommendation, moderation, event, flag and notification tables; no Run 2 or Run 3 tables or registered flags exist. All Run 1 flags are seeded **off**. The app, migration/seed scripts, worker, server APIs, demo portal screens, tests and CI scaffold are present. The only Playwright scenario implemented is a mobile portal smoke check, **not** the specified end-to-end business flows.

Every feature remains flagged off in production and in the demo seed. Staging may explicitly turn flags on only when prerequisites exist. Events themselves are always on. Production flags cannot be enabled through the admin flag endpoint while this run is in development.

## Decisions

- [Application, Drizzle, Neon, Vercel and Hobby-to-Pro rule](../decisions/001-stack.md)
- [Railway pg-boss worker and Cloudflare R2 media](../decisions/002-worker-and-media.md)
- [Gemini dev/prod, Resend, Twilio, email magic links, SMS OTP and future adapters](../decisions/003-adapters.md)
- [PostgreSQL flags and the four added Run 1 keys](../decisions/004-flags.md)
- [Kochi district configuration, English-only UI and draft romanised Malayalam synonyms](../decisions/005-district.md)
- [Consent purposes, DPDP legal review and export/deletion choices](../decisions/006-privacy.md)
- [Configurable limits, relevance, digest, badge and later calibration placeholders](../decisions/007-defaults.md)
- [Solo-owner overrides and explicit exclusions of payments/auto-match/later runs](../decisions/008-solo-overrides.md)
- [Proposed latency and photo-accuracy launch gates](../gates.md)

Vercel Pro upgrade date: **pending**. Managed database extension/plan-limit checks, worker host, R2, paid Gemini project and budget alert, DNS and DLT registration: **pending owner provisioning**. No external credentials are stored.

## Verification and blockers

`npm install --offline --ignore-scripts` failed (`ENOTCACHED` for Drizzle). Installing from the registry needs permission, so TypeScript checks, normal/unit/property tests, Testcontainers, Playwright, migrations, the pg-boss health job and the staging demo **have not run**. The CI workflow is a scaffold, not evidence of passing CI. Live AI is excluded from normal CI by design.

Before enabling any real-user flag: fix the issues recorded in [Wave 1](wave-1.md), [Wave 2](wave-2.md), [Wave 3](wave-3.md), [Wave 4](wave-4.md) and [Wave 5](wave-5.md), especially atomic OTP and notification limits, real media erasure, authenticated moderation UI, test coverage, actual provider adapters, publication/photo validation and full end-to-end staging flows. Neon pg_trgm availability on the selected actual plan was not verified before Wave 4; production enablement is blocked. Every missing acceptance check remains open rather than assumed passed.

## Exact commands

After credentials and a PostgreSQL service are supplied, from the repository root:

```sh
npm install
npx tsc --noEmit
npm test
RUN_DB_TESTS=1 npm test
npm run test:e2e
npm run db:migrate
npm run db:seed
WORKER_TEST_JOB=1 npm run worker
```

The seed is **not idempotent**; run it once on a clean demo database. With an S3-compatible bucket configured, it uploads generated synthetic demo photos; without a bucket, it seeds fictional stock but no photos. For local staging, set `APP_ENV=staging`, `DEMO_MODE=1`, and use only synthetic photos and the development Gemini key. Production uses `APP_ENV=production`, paid Gemini and real customer media only; do not reuse demo settings.

## Open questions for Run 2

Confirm the legal entity and privacy-policy owner, WhatsApp Business verification, invoice/GST requirements, provider contracts and storage retention, shop pricing/plan details, seasonal pause rules, and whether offline checkout conflict handling is viable for participating shops. Run 2 requires a separate prompt; no Run 2 code was started here.
