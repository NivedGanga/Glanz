import { NextRequest, NextResponse } from "next/server";
import { readPhoto, verifyLocalMedia } from "../../../../lib/media";

export async function GET(req: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const key = `photos/${fileId}`;
  const expires = Number(req.nextUrl.searchParams.get("expires"));
  const signature = req.nextUrl.searchParams.get("signature") ?? "";
  if (!verifyLocalMedia(key, expires, signature))
    return NextResponse.json({ error: "INVALID_MEDIA_LINK" }, { status: 403 });
  try {
    return new NextResponse(new Blob([Uint8Array.from(await readPhoto(key))]), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff" }
    });
  } catch {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}
