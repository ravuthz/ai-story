/** Minimal client for Gemini's generateContent REST endpoint, shared by image and TTS providers. */
export class GeminiApi {
  private static readonly BASE = "https://generativelanguage.googleapis.com/v1beta/models";

  constructor(private readonly apiKey: string) {}

  get configured(): boolean {
    return !!this.apiKey;
  }

  /** Returns the first inline (base64) payload in the response. */
  async generateInlineData(model: string, body: object): Promise<{ data: Buffer; mimeType: string }> {
    const res = await fetch(`${GeminiApi.BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini ${model} failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[];
    };
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!part) throw new Error(`Gemini ${model} returned no inline data`);
    return { data: Buffer.from(part.data, "base64"), mimeType: part.mimeType };
  }
}
