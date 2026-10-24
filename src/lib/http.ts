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
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const status = code === "RATE_LIMITED" ? 429 : code === "UNAUTHORIZED" ? 401 :
      code === "FORBIDDEN" ? 403 : code === "INTERNAL_ERROR" ? 500 : 400;
    return NextResponse.json({ error: status === 500 ? "INTERNAL_ERROR" : code }, { status });
  }
}
