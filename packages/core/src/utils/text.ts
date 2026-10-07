export const slugify = (value: string, max = 60): string =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max) || "untitled";

export const newId = (): string => crypto.randomUUID();

export const nowIso = (): string => new Date().toISOString();

/** Extracts the first JSON object from free-form LLM output (handles ```json fences and chatter). */
export function extractJson<T = unknown>(output: string): T {
  const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? output;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error(`No JSON object found in output:\n${output.slice(0, 500)}`);
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

/** Runs async tasks with bounded concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
