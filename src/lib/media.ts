import { randomUUID } from "node:crypto";
import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

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
  if (bytes.length > 10_000_000) throw new Error("PHOTO_TOO_LARGE");
  // sharp writes a new file without the original EXIF; never pass through raw uploads.
  const resized = await sharp(bytes, { limitInputPixels: 32_000_000 })
    .rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 }).toBuffer();
  const key = `photos/${randomUUID()}.webp`;
  await client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: resized,
    ContentType: "image/webp" }));
  return key;
}
export async function signedPhotoUrl(key: string) {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 300 });
}
