export interface EmailSender {
  send(to: string, template: string, body: string): Promise<void>;
}
export interface SmsSender {
  send(to: string, template: string, body: string): Promise<void>;
}
export interface WhatsAppSender {
  send(to: string, template: string, body: string): Promise<void>;
}
export interface EmbeddingProvider {
  embed(input: Uint8Array): Promise<number[]>;
}
// Dev-only test hooks so browser tests can complete real auth flows without an account.
// Written to disk because Turbopack dev may bundle adapters per-route; files survive.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
export const devTestOutboxDir = () => join(process.cwd(), ".local-data", "outbox");
export const devTestOutboxFile = (channel: string, to: string) =>
  join(devTestOutboxDir(), `${channel}-${encodeURIComponent(to)}.json`);
const devOnly = (kind: string) => {
  if (process.env.NODE_ENV === "production" && process.env.APP_ENV !== "staging")
    throw new Error(`${kind}_PROVIDER_NOT_CONFIGURED`);
};
async function record(channel: string, to: string, template: string, body: string) {
  await mkdir(devTestOutboxDir(), { recursive: true });
  await writeFile(devTestOutboxFile(channel, to), JSON.stringify({ template, body }));
}
export const email: EmailSender = {
  async send(to, template, body) {
    devOnly("EMAIL");
    await record("email", to, template, body);
    console.info("DEV_EMAIL", to, template, body);
  }
};
export const sms: SmsSender = {
  async send(to, template, body) {
    devOnly("SMS");
    await record("sms", to, template, body);
    console.info("DEV_SMS", to, template, body);
  }
};
