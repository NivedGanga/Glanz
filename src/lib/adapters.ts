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
// Never populated in production builds (NODE_ENV=production && APP_ENV!==staging throws above).
export const devTestOutbox = new Map<string, { template: string; body: string }>();
const devOnly = (kind: string) => {
  if (process.env.NODE_ENV === "production" && process.env.APP_ENV !== "staging")
    throw new Error(`${kind}_PROVIDER_NOT_CONFIGURED`);
};
export const email: EmailSender = {
  async send(to, template, body) {
    devOnly("EMAIL");
    devTestOutbox.set(`email:${to}`, { template, body });
    console.info("DEV_EMAIL", to, template, body);
  }
};
export const sms: SmsSender = {
  async send(to, template, body) {
    devOnly("SMS");
    devTestOutbox.set(`sms:${to}`, { template, body });
    console.info("DEV_SMS", to, template, body);
  }
};
