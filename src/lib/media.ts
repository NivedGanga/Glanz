import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

const keyPattern = /^photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
export function localMediaAvailable(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return env.STORAGE_PROVIDER === "local" && !env.VERCEL &&
    (env.APP_ENV === "development" || env.APP_ENV === "staging") &&
    Boolean(env.APP_ORIGIN && env.MEDIA_SIGNING_SECRET && env.MEDIA_SIGNING_SECRET.length >= 32);
}
function localPath(key: string) {
  if (!keyPattern.test(key)) throw new Error("INVALID_STORAGE_KEY");
  const root = process.env.LOCAL_MEDIA_DIR || join(process.cwd(), ".local-data");
  if (!isAbsolute(root)) throw new Error("INVALID_STORAGE_DIRECTORY");
  return join(root, key);
}
function signingSecret() {
  if (!localMediaAvailable()) throw new Error("LOCAL_STORAGE_UNAVAILABLE");
  return process.env.MEDIA_SIGNING_SECRET!;
}
export function signLocalMedia(key: string, expires: number) {
  localPath(key);
  return createHmac("sha256", signingSecret()).update(`${key}:${expires}`).digest("hex");
}
export function verifyLocalMedia(key: string, expires: number, signature: string, now = Date.now()) {
  if (!localMediaAvailable() || !keyPattern.test(key) || !Number.isSafeInteger(expires) ||
    expires <= Math.floor(now / 1000) || expires > Math.floor(now / 1000) + 300 ||
    !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = signLocalMedia(key, expires);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
function client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION ?? "auto",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" }
  });
}
function bucket() {
  if (!process.env.S3_BUCKET) throw new Error("STORAGE_NOT_CONFIGURED");
  return process.env.S3_BUCKET;
}
export async function storePhoto(bytes: Buffer) {
  if (process.env.STORAGE_PROVIDER === "local" && !localMediaAvailable())
    throw new Error("LOCAL_STORAGE_UNAVAILABLE");
  if (bytes.length > 10_000_000) throw new Error("PHOTO_TOO_LARGE");
  // sharp writes a new file without the original EXIF; never pass through raw uploads.
  const resized = await sharp(bytes, { limitInputPixels: 32_000_000 })
    .rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 }).toBuffer();
  const key = `photos/${randomUUID()}.webp`;
  if (process.env.STORAGE_PROVIDER === "local") {
    const path = localPath(key);
    await mkdir(join(process.env.LOCAL_MEDIA_DIR || join(process.cwd(), ".local-data"), "photos"),
      { recursive: true, mode: 0o700 });
    await writeFile(path, resized, { flag: "wx", mode: 0o600 });
    return key;
  }
  await client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: resized,
    ContentType: "image/webp" }));
  return key;
}
export async function signedPhotoUrl(key: string) {
  if (process.env.STORAGE_PROVIDER === "local") {
    const expires = Math.floor(Date.now() / 1000) + 300;
    const url = new URL(`/api/local-media/${key.slice("photos/".length)}`, process.env.APP_ORIGIN);
    url.searchParams.set("expires", String(expires));
    url.searchParams.set("signature", signLocalMedia(key, expires));
    return url.toString();
  }
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 300 });
}
export async function readPhoto(key: string) {
  if (process.env.STORAGE_PROVIDER === "local") {
    signingSecret();
    return readFile(localPath(key));
  }
  const result = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!result.Body) throw new Error("MEDIA_FETCH_FAILED");
  return result.Body.transformToByteArray();
}
