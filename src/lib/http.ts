import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { flags } from "./flags";
import type { Run1Flag } from "./catalog";

export async function guarded(flag: Run1Flag, action: () => Promise<Response>) {
  try {
    if (!await flags.enabled(flag)) return NextResponse.json({ error: "FEATURE_DISABLED" }, { status: 404 });
    return await action();
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "INVALID_INPUT", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "";
    const publicCodes = new Set(["RATE_LIMITED", "UNAUTHORIZED", "FORBIDDEN", "FEATURE_DISABLED",
      "INVALID_WINDOW", "INVALID_PHONE_DISTRICT", "INVALID_CODE", "INVALID_LINK",
      "SIGNUP_DETAILS_REQUIRED", "PLAN_NOT_CONFIGURED", "ITEM_CAP_REACHED",
      "INVALID_SHOP_INVENTORY", "INVALID_ATTRIBUTE", "UNKNOWN_CATEGORY", "DESIGN_NOT_FOUND",
      "INVALID_TOKEN", "INVALID_PHOTO", "PHOTO_TOO_LARGE", "STORAGE_NOT_CONFIGURED",
      "AI_QUOTA_REACHED", "TAG_NOT_FOUND", "UNIT_NOT_FOUND", "UNAVAILABLE_WITH_BUFFER",
      "LISTING_INCOMPLETE_OR_NO_OWN_PHOTO", "DISTRICT_NOT_FOUND", "DISTRICT_MISMATCH",
      "REQUEST_NOT_FOUND", "DUPLICATE_SHOP", "SHOP_NOT_RECOMMENDED", "DECLINE_REASON_REQUIRED",
      "NONEXISTENT_LOCAL_DATE", "AMBIGUOUS_LOCAL_DATE", "INVALID_LOCAL_DATE"]);
    const code = publicCodes.has(message) ? message : "INTERNAL_ERROR";
    const status = code === "RATE_LIMITED" ? 429 : code === "UNAUTHORIZED" ? 401 :
      code === "FORBIDDEN" ? 403 : code === "INTERNAL_ERROR" ? 500 : 400;
    return NextResponse.json({ error: status === 500 ? "INTERNAL_ERROR" : code }, { status });
  }
}
