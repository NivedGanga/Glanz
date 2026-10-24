import { NextRequest, NextResponse } from "next/server";
import { devTestOutbox } from "../../../../lib/adapters";

// Development test hook: exposes the last dev-adapter message so browser tests can
// complete real auth flows. Never available outside demo/development mode.
export async function GET(req: NextRequest) {
  if (process.env.APP_ENV !== "development" || process.env.DEMO_MODE !== "1" ||
    process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const channel = req.nextUrl.searchParams.get("channel");
  const to = req.nextUrl.searchParams.get("to") ?? "";
  const entry = devTestOutbox.get(`${channel}:${to}`);
  return NextResponse.json(entry ?? { template: null, body: null });
}
