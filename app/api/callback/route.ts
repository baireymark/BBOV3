import { NextResponse } from "next/server";
import { sendLeadEmail } from "@/lib/mailer";

// Callback requests from the chat assistant. Sent to the same inbox as consultation requests.
// Nodemailer needs Node's net/tls modules, so this route can't run on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Leave time for a slow SMTP handshake; the transporter timeouts in lib/mailer.ts stay under this.
export const maxDuration = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CallbackRequest {
  name: string;
  email: string;
  phone: string;
  /** The question the visitor asked in the chat before asking for a callback, if any. */
  question?: string;
  /** The page the request was made from. */
  page?: string;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body || typeof body !== "object") throw new Error("Not an object");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real visitors never see or fill this field, so report success to the bot and drop the request.
  if (typeof body["bot-field"] === "string" && body["bot-field"].trim()) {
    return NextResponse.json({ ok: true });
  }

  const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const lead: CallbackRequest = {
    name: clean(body.name, 200),
    email: clean(body.email, 320),
    phone: clean(body.phone, 50),
    question: clean(body.question, 500),
    page: clean(body.page, 300),
  };

  // The visitor must agree to be contacted; the form sends `consent: true` only when the box is ticked.
  if (!lead.name || !EMAIL_RE.test(lead.email) || lead.phone.replace(/\D/g, "").length < 7 || body.consent !== true) {
    return NextResponse.json(
      { error: "Please add your name, a valid email, and a phone number, and agree to be contacted." },
      { status: 422 }
    );
  }

  const receivedAt = new Date().toISOString();
  const result = await sendLeadEmail({
    tag: "callback",
    heading: "New callback request (website chat)",
    subject: `New callback request: ${lead.name}`,
    replyTo: lead.email,
    replyName: lead.name,
    rows: [
      ["Name", lead.name],
      ["Email", lead.email],
      ["Phone", lead.phone],
      ["Question asked in chat", lead.question ?? ""],
      ["Page", lead.page ?? ""],
      ["Consent", `Agreed to be contacted about this request (${receivedAt})`],
    ],
    receivedAt,
    log: { ...lead, consent: true, receivedAt },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true });
}
