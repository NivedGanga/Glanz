export const run1Flags = {
  "shop.onboarding": "Shop signup and profile",
  "customer.accounts": "Customer OTP accounts",
  "shop.inventory": "Designs, units and rates",
  "shop.attributes": "Structured attributes",
  "shop.catalog_link": "Revocable public catalog",
  "shop.photo_entry": "Photo tagging suggestions",
  "availability.buffers": "Category and shop buffer days",
  "availability.blocks": "Manual availability blocks",
  "marketplace.publish": "Publish complete listings",
  "marketplace.pause": "Pause shops and listings",
  "customer.search": "Date-first catalog search",
  "customer.distance_filter": "Pickup distance filter",
  "customer.item_calendar": "Coarse item availability",
  "marketplace.report": "Authenticity reports",
  "search.fuzzy_keywords": "Trigram keyword search",
  "customer.request": "Customer requests",
  "customer.guided_request": "Guided answers and live count",
  "customer.photo_tagging": "Consented request photo analysis",
  "reco.v1": "Rule-based recommendations",
  "reco.fuzzy_keywords": "Trigram recommendation relevance",
  "shop.inbox": "Selected-shop inbox",
  "shop.decline": "Decline with reason",
  "notifications.digest": "Shop email digests",
  "shop.verified_badge": "Manual verification badge"
} as const;

export type Run1Flag = keyof typeof run1Flags;

// Documentation only: these keys are never inserted into the flag table.
export const reservedKeys = [
  "shop.quoting", "shop.quote_links", "availability.soft_holds", "contact.whatsapp",
  "messaging", "shop.invoicing", "shop.not_for_me", "shop.category_mute",
  "shop.analytics_basic", "shop.checkout", "shop.qr_tags", "billing.subscriptions",
  "billing.seasonal_pause", "reco.visual", "reco.attribute_weights",
  "reco.explanations", "reco.calibration_report", "reviews.public", "reco.auto_match",
  "reco.auto_match.<category>", "business.branches", "business.staff",
  "business.seasonal_pricing", "business.demand", "business.branded_page",
  "customer.size_charts", "customer.fit_profile", "customer.saved",
  "customer.rebook", "customer.alerts", "customer.group_request",
  "customer.complete_look", "customer.reference_search", "district.<id>", "lang.<code>"
] as const;
