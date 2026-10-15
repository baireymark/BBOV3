import Anthropic from "@anthropic-ai/sdk";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { BOB_SYSTEM_PROMPT } from "@/lib/bob-prompt";

export const dynamic = "force-dynamic";
// Replies usually finish in seconds; leave headroom on hosts that cap function duration.
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
/** Only the latest messages are sent to the model, which bounds the cost of a long chat. */
const MAX_HISTORY = 20;
const MAX_USER_CHARS = 1000;
const MAX_REPLY_CHARS = 4000;

/** One line of the newline-delimited JSON stream that components/Bob.tsx reads. */
export type BobEvent = { type: "text"; text: string } | { type: "done" } | { type: "refusal" } | { type: "error" };

/** Cloudflare's Rate Limiting binding ("ratelimits" in wrangler.jsonc). */
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export async function POST(req: Request) {
  // AI answers are optional. Without a key the widget answers typed questions from its script (lib/bob-script.ts).
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI answers are not configured." }, { status: 503 });
  }

  if (Number(req.headers.get("content-length")) > 100_000) {
    return NextResponse.json({ error: "Conversation too long." }, { status: 413 });
  }

  let payload: { messages?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const messages = parseHistory(payload?.messages);
  if (!messages) {
    return NextResponse.json({ error: "Invalid conversation." }, { status: 400 });
  }

  if (!(await underRateLimit(req))) {
    return NextResponse.json({ error: "Too many messages. Please wait a minute." }, { status: 429 });
  }

  // An invalid key surfaces as an error once the stream starts.
  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  let stream: ReturnType<typeof client.beta.messages.stream> | undefined;
  let cancelled = false;

  const output = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: BobEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        stream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 4096,
          // Short answers about the website don't need deep reasoning; low effort keeps replies fast and cheap.
          output_config: { effort: "low" },
          // If Claude's safety classifiers decline a message, the API retries it on Anthropic's recommended fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          // Every conversation shares this prompt, so it is cached once and read cheaply by later requests.
          system: [{ type: "text", text: BOB_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "text", text: event.delta.text });
          }
        }
        const reply = await stream.finalMessage();
        // A refusal can arrive after part of the reply has streamed; the widget replaces that partial reply with a notice.
        send({ type: reply.stop_reason === "refusal" ? "refusal" : "done" });
      } catch (err) {
        if (cancelled) return;
        // Log the API status and message so the cause (bad key, rate limit, outage) shows up in the host's logs.
        const e = err as { status?: number; message?: string };
        console.error("[bob] reply failed", { status: e.status, message: e.message });
        send({ type: "error" });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      // The visitor left mid-reply, so stop generating tokens nobody will read.
      cancelled = true;
      stream?.abort();
    },
  });

  return new Response(output, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Text-only turns from the widget. The history must start and end with the visitor. */
function parseHistory(raw: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  if (!Array.isArray(raw)) return null;
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of raw.slice(-MAX_HISTORY)) {
    const role = m?.role;
    const content = typeof m?.content === "string" ? m.content.trim() : "";
    if ((role !== "user" && role !== "assistant") || !content) return null;
    messages.push({ role, content: content.slice(0, role === "user" ? MAX_USER_CHARS : MAX_REPLY_CHARS) });
  }
  while (messages[0]?.role === "assistant") messages.shift();
  return messages.at(-1)?.role === "user" ? messages : null;
}

/** Per-visitor message limit enforced by Cloudflare. Hosts without the binding (e.g. `next start`) skip it. */
async function underRateLimit(req: Request) {
  let limiter: RateLimiter | undefined;
  try {
    limiter = (getCloudflareContext().env as CloudflareEnv & { BOB_RATE_LIMITER?: RateLimiter }).BOB_RATE_LIMITER;
  } catch {
    return true;
  }
  if (!limiter) return true;
  const { success } = await limiter.limit({ key: req.headers.get("cf-connecting-ip") ?? "anonymous" });
  return success;
}
