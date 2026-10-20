// gte-small embeddings from the Edge Runtime's built-in model (CPU only, no LLM call).
/// <reference types="npm:@supabase/functions-js@2.118.0/src/edge-runtime.d.ts" />

let session: Supabase.ai.Session | null = null

/** 384-dim normalized vector, serialized the way pgvector accepts it ("[0.1,...]"). */
export async function embed(text: string): Promise<string> {
  session ??= new Supabase.ai.Session('gte-small')
  const vector = (await session.run(text, { mean_pool: true, normalize: true })) as number[]
  return JSON.stringify(vector)
}
