import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { GET } from "../app/api/local-media/[fileId]/route";
import { readPhoto, signedPhotoUrl, storePhoto, verifyLocalMedia } from "../lib/media";
import { flagPrerequisite } from "../lib/flags";

describe("private local media", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "glanz-media-"));
    vi.stubEnv("STORAGE_PROVIDER", "local");
    vi.stubEnv("LOCAL_MEDIA_DIR", directory);
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("MEDIA_SIGNING_SECRET", "local-test-only-secret-with-at-least-32-characters");
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });
  it("strips metadata, stores privately and serves only a valid expiring link", async () => {
    const input = await sharp({ create: {
      width: 20, height: 20, channels: 3, background: "#e43432"
    } }).withMetadata({ exif: { IFD0: { ImageDescription: "private metadata" } } }).jpeg().toBuffer();
    const key = await storePhoto(input);
    expect((await stat(join(directory, key))).mode & 0o777).toBe(0o600);
    expect((await sharp(await readPhoto(key)).metadata()).exif).toBeUndefined();
    const url = await signedPhotoUrl(key);
    const response = await GET(new NextRequest(url), {
      params: Promise.resolve({ fileId: key.slice("photos/".length) })
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const missingSignature = new URL(url);
    missingSignature.searchParams.set("signature", "0".repeat(64));
    expect((await GET(new NextRequest(missingSignature), {
      params: Promise.resolve({ fileId: key.slice("photos/".length) })
    })).status).toBe(403);
    const expires = Number(new URL(url).searchParams.get("expires"));
    expect(verifyLocalMedia(key, expires, new URL(url).searchParams.get("signature")!,
      (expires + 1) * 1000)).toBe(false);
  });
  it("rejects local storage on Vercel and keeps fake photo flags off without demo configuration", () => {
    const env = { STORAGE_PROVIDER: "local", APP_ENV: "development", VERCEL: "1",
      APP_ORIGIN: "http://localhost:3000", MEDIA_SIGNING_SECRET: "a".repeat(32),
      PHOTO_TAGGER: "fake", DEMO_MODE: "1" };
    expect(flagPrerequisite("shop.photo_entry", env)).toBe(false);
    expect(flagPrerequisite("customer.photo_tagging", { ...env, VERCEL: undefined })).toBe(true);
    expect(flagPrerequisite("shop.photo_entry", { ...env, VERCEL: undefined,
      DEMO_MODE: "0" })).toBe(false);
    vi.stubEnv("VERCEL", "1");
    expect(verifyLocalMedia("photos/00000000-0000-0000-0000-000000000000.webp",
      Math.floor(Date.now() / 1000) + 120, "0".repeat(64))).toBe(false);
  });
});
