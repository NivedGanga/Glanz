# Wave 1 status

Shipped scaffold: single app, Run 1 schema, server flags with audit, append-only event table, configurable free entitlement stub, magic-link and OTP endpoints, export/anonymisation endpoint, worker health job, consent records and foundation tests. Both flags are off by default.

Open: credentials and provider accounts absent; development transport logs OTP only outside production. Production email/SMS are intentionally blocked. IP rate-limiting requires trusted proxy headers and atomic controls under concurrency. Physical media erasure worker, full consent/legal review, signup UI and DB-backed integration/e2e checks are not complete. `npm install --offline` failed because dependencies are not cached. No tests or worker job have been verified yet. This wave is not launch-ready.
