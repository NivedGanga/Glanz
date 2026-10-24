# 009: Free local development media

Use an explicit local filesystem adapter for development and persistent single-host staging. It costs nothing and needs no account or bucket. Uploads are resized to WebP without EXIF, stored outside `public/` with owner-only file permissions and served through five-minute HMAC-signed links. The worker reads media directly from the private directory.

`STORAGE_PROVIDER=local` requires a generated local signing secret and is refused in production or on Vercel, whose filesystem is ephemeral. This is **not** a free production hosting solution. R2 remains the intended S3-compatible production provider, but only the owner can provision a real account and bucket. No cloud credentials can be generated locally. `PHOTO_TAGGER=fake` is synthetic-demo-only and makes no external AI calls; it is not a substitute for production Gemini validation. The private directory and all generated local secrets remain untracked.

Next.js server output tracing explicitly excludes `.env*`, `.local-data/` and `.git/`. A local production build was inspected to confirm zero traced secret or media paths. This exclusion must remain in place if deployment packaging changes.
