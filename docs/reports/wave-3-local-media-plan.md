# Wave 3 follow-up: bucket-free development

1. Add an explicit, private local-disk media adapter with resized uploads, EXIF removal and short-lived signed URLs; reject local storage on Vercel or in production.
2. Add a synthetic-only fake photo tagger for local testing and make photo flags check the selected adapter configuration.
3. Generate untracked local secrets, start PostgreSQL with Docker and run the existing demo flow and test suites.
4. Document that persistent production storage and genuine provider keys still require owner accounts.
