import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Client } from "https://deno.land/x/postgresjs@v3.5.0/mod.ts";

const client = new Client(Deno.env.get("DATABASE_URL")!);
await client.connect();

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }

  const { sql } = await req.json();
  if (!sql || typeof sql !== "string") {
    return new Response(JSON.stringify({ error: "sql is required" }), { status: 400 });
  }

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const results: Array<{ ok: boolean; statement?: string; error?: string }> = [];

  for (const stmt of statements) {
    try {
      await client.queryArray(stmt);
      results.push({ ok: true, statement: stmt.slice(0, 80) });
    } catch (err: any) {
      results.push({ ok: false, statement: stmt.slice(0, 80), error: String(err.message) });
    }
  }

  return new Response(JSON.stringify({ results, total: statements.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
