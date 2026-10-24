# Wave 3 status

Shipped UTC availability helpers, row-locked manual block writes and event entries, private S3 photo resizing/EXIF stripping and signed access, Gemini adapter safety guard, suggested-tag validation and review, asynchronous pg-boss job handler and DST/property unit tests. All three wave flags remain off.

Open: no actual storage, Gemini keys, worker host or PostgreSQL instance is provisioned. CI fake job provider and DB-backed race test are missing; the job and full user interface are unverified. The media deletion worker is still needed. Never enable photo entry for real photos until the 50-photo accuracy gate is approved.
