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
export const email: EmailSender = {
  async send(to, template, body) {
    if (process.env.NODE_ENV === "production") throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
    console.info("DEV_EMAIL", to, template, body);
  }
};
export const sms: SmsSender = {
  async send(to, template, body) {
    if (process.env.NODE_ENV === "production") throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
    console.info("DEV_SMS", to, template, body);
  }
};
