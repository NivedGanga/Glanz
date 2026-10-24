# 003: External adapters

Choose Google Gemini for photo suggestions. Separate free development and paid production projects/keys; free-tier inputs may be used for product improvement. Production budget alert is required. The adapter refuses real photos with a development key. No live AI in normal CI.

Choose Resend for transactional email and Twilio for SMS. Both remain behind adapters and mock implementations until credentials exist. Configure sending-domain SPF, DKIM and DMARC; register Indian DLT sender ID and template IDs before sending OTP. Shop sign-in uses email magic links; customer sign-in uses phone OTP. Define WhatsApp and embeddings interfaces only, without implementations or calls.
