# Wave 3 follow-up: local media

Shipped a no-account development storage option: private files outside `public/`, owner-only permissions, WebP resizing with EXIF removed, five-minute HMAC-signed retrieval and direct worker reads. Fake AI suggestions are synthetic-only, with no Gemini call or invented API key. `shop.photo_entry` and `customer.photo_tagging` can be tested locally with `STORAGE_PROVIDER=local`, `PHOTO_TAGGER=fake` and `DEMO_MODE=1`. In the seed, fake design photos are now written to the local store. Production flags remain off.

Local secrets were generated using cryptographic randomness in gitignored `.env.local` and `.env.docker.local`, both mode `0600`. No secret values were printed or committed. Docker PostgreSQL, migrations, seed and the pg-boss worker started successfully; a health job completed. Local unit, integration and browser tests cover private media, signature expiry, forbidden Vercel use, fake/real-photo safety and upload/tag-confirmation through the worker.

Open: local disk is not persistent on Vercel and must never carry real customer data in a production deployment. Only the owner can create a hosted storage account or actual Gemini, SMS and email provider credentials. Media erasure for account deletion remains pending and blocks real-user launch.
