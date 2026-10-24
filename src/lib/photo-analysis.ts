export type PhotoInput = { bytes: Uint8Array; isSynthetic: boolean };
export type SuggestedValue = { field: string; value: string };
export interface PhotoTagger {
  analyse(photo: PhotoInput, schema: Record<string, string[]>): Promise<SuggestedValue[]>;
}
export function allowedTags(value: unknown, schema: Record<string, string[]>): SuggestedValue[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_MODEL_JSON");
  const tags: SuggestedValue[] = [];
  for (const [field, values] of Object.entries(value)) {
    if (!Array.isArray(values) || !schema[field]) continue;
    for (const entry of values) if (typeof entry === "string" && schema[field].includes(entry))
      tags.push({ field, value: entry });
  }
  return tags;
}
export class GeminiTagger implements PhotoTagger {
  constructor(private readonly tier: "dev" | "prod", private readonly apiKey: string,
    private readonly model = "gemini-2.0-flash") {}
  async analyse(photo: PhotoInput, schema: Record<string, string[]>) {
    if (this.tier === "dev" && !photo.isSynthetic) throw new Error("DEV_KEY_REAL_PHOTO_REFUSED");
    if (!this.apiKey) throw new Error("AI_NOT_CONFIGURED");
    const prompt = `Return JSON only. For each field choose only values from these lists: ${JSON.stringify(schema)}. No other keys or values.`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt },
          { inline_data: { mime_type: "image/webp", data: Buffer.from(photo.bytes).toString("base64") } }] }],
          generationConfig: { responseMimeType: "application/json" } })
      });
      if (!response.ok) throw new Error("AI_PROVIDER_ERROR");
      const data = await response.json();
      try { return allowedTags(JSON.parse(data.candidates[0].content.parts[0].text), schema); }
      catch { if (attempt === 1) throw new Error("INVALID_MODEL_JSON"); }
    }
    throw new Error("INVALID_MODEL_JSON");
  }
}
