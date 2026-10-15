import { NextResponse } from "next/server";
import { sendLeadEmail } from "@/lib/mailer";

// Nodemailer needs Node's net/tls modules, so this route can't run on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Leave time for a slow SMTP handshake; the transporter timeouts in lib/mailer.ts stay under this.
export const maxDuration = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ConsultationRequest {
  name: string;
  company: string;
  email: string;
  phone?: string;
  service?: string;
  size?: string;
  message?: string;
}

export async function POST(req: Request) {
  let body: Partial<ConsultationRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real visitors never see or fill this field, so report success to the bot and drop the request.
  if (typeof (body as Record<string, unknown>)["bot-field"] === "string" && (body as Record<string, string>)["bot-field"].trim()) {
    return NextResponse.json({ ok: true });
  }

  const clean = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const lead: ConsultationRequest = {
    name: clean(body.name, 200),
    company: clean(body.company, 200),
    email: clean(body.email, 320),
    phone: clean(body.phone, 50),
    service: clean(body.service, 100),
    size: clean(body.size, 100),
    message: clean(body.message),
  };

  if (!lead.name || !lead.company || !EMAIL_RE.test(lead.email)) {
    return NextResponse.json({ error: "Please add your full name, company, and a valid work email." }, { status: 422 });
  }

  const receivedAt = new Date().toISOString();
  const result = await sendLeadEmail({
    tag: "consultation",
    heading: "New consultation request",
    subject: `New consultation request: ${lead.company} (${lead.name})`,
    replyTo: lead.email,
    replyName: lead.name,
    rows: FIELDS.map(([k, label]) => [label, lead[k] ?? ""]),
    receivedAt,
    log: { ...lead, receivedAt },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true });
}

const FIELDS: [keyof ConsultationRequest, string][] = [
  ["name", "Name"],
  ["company", "Company"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["service", "Area of support"],
  ["size", "Team size"],
  ["message", "Message"],
];
