import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { devTestOutboxFile } from "../../../../lib/adapters";

// Development test hook: exposes the last dev-adapter message so browser tests can
// complete real auth flows. Never available outside demo/development mode.
export async function GET(req: NextRequest) {
  if (process.env.APP_ENV !== "development" || process.env.DEMO_MODE !== "1" ||
    process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const channel = req.nextUrl.searchParams.get("channel") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!/^[a-z]+$/.test(channel) || to.length > 200)
    return NextResponse.json({ template: null, body: null });
  try {
    const content = JSON.parse(await readFile(devTestOutboxFile(channel, to), "utf8"));
    return NextResponse.json({ template: content.template ?? null, body: content.body ?? null });
  } catch {
    return NextResponse.json({ template: null, body: null });
  }
}
