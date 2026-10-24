import { randomBytes } from "node:crypto";
import { open, access } from "node:fs/promises";
import { join } from "node:path";

const appEnv = join(process.cwd(), ".env.local");
const dockerEnv = join(process.cwd(), ".env.docker.local");
const random = () => randomBytes(32).toString("hex");
async function main() {
  for (const file of [appEnv, dockerEnv]) {
    try { await access(file); throw new Error(`${file} already exists; refusing to overwrite secrets`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const password = random();
  const app = [
    "APP_ORIGIN=http://localhost:3000",
    "APP_ENV=development",
    "DEMO_MODE=1",
    "STORAGE_PROVIDER=local",
    "PHOTO_TAGGER=fake",
    `DATABASE_URL=postgresql://glanz:${password}@127.0.0.1:55432/glanz`,
    `SESSION_SECRET=${random()}`,
    `ADMIN_TOKEN=${random()}`,
    `MEDIA_SIGNING_SECRET=${random()}`
  ].join("\n") + "\n";
  const docker = `POSTGRES_DB=glanz\nPOSTGRES_USER=glanz\nPOSTGRES_PASSWORD=${password}\n`;
  const appFile = await open(appEnv, "wx", 0o600);
  try { await appFile.writeFile(app); } finally { await appFile.close(); }
  const dockerFile = await open(dockerEnv, "wx", 0o600);
  try { await dockerFile.writeFile(docker); } finally { await dockerFile.close(); }
  console.info("Created untracked, owner-only local env files. No production credentials generated.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
