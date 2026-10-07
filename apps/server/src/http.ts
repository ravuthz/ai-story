import type { Context } from "hono";
import { NotFoundError } from "@ai-story/core";
import { ZodError, type z } from "zod";

/** Parses and validates a JSON body with a shared schema. */
export async function body<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  return schema.parse(await c.req.json().catch(() => ({})));
}

export function onError(error: Error, c: Context) {
  if (error instanceof ZodError) return c.json({ error: "Invalid input", issues: error.issues }, 400);
  if (error instanceof NotFoundError) return c.json({ error: error.message }, 404);
  console.error(error);
  return c.json({ error: error.message }, 500);
}
