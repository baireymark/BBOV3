import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Nodemailer needs Node's net/tls modules, so this route can't run on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Leave time for a slow SMTP handshake; the transporter timeouts below stay under this.
export const maxDuration = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Values pasted into a host's dashboard often pick up surrounding quotes or stray whitespace.
const env = (name: string) => (process.env[name] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();

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
  const SMTP_HOST = env("SMTP_HOST");
  const SMTP_USER = env("SMTP_USER");
  // Google shows app passwords in groups ("abcd efgh ijkl mnop"); the spaces aren't part of the password.
  const SMTP_PASS = SMTP_HOST.endsWith("gmail.com") ? env("SMTP_PASS").replace(/\s+/g, "") : env("SMTP_PASS");
  const to = env("CONSULTATION_TO_EMAIL");
  const from = env("CONSULTATION_FROM_EMAIL") || SMTP_USER;

  const missing = Object.entries({ SMTP_HOST, SMTP_USER, SMTP_PASS, CONSULTATION_TO_EMAIL: to })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    // Without SMTP configured, local development still works by logging the lead,
    // but production never drops a lead silently.
    if (process.env.NODE_ENV === "production") {
      console.error(`[consultation] SMTP is not configured: missing ${missing.join(", ")}`);
      return NextResponse.json({ error: "We couldn't send your request. Please email us directly." }, { status: 500 });
    }
    console.log("[consultation] new request (SMTP not configured)", { ...lead, receivedAt });
    return NextResponse.json({ ok: true });
  }

  const port = Number(env("SMTP_PORT")) || 465;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Fail fast with a clear error instead of hanging until the serverless function is killed.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transporter.sendMail({
      from,
      to: to.split(",").map((a) => a.trim()).filter(Boolean),
      replyTo: lead.email,
      subject: `New consultation request: ${lead.company} (${lead.name})`,
      html: renderHtml(lead, receivedAt),
      text: renderText(lead, receivedAt),
    });
  } catch (err) {
    // Log the SMTP details (EAUTH, ETIMEDOUT, 535...) so the cause shows up in the host's function logs.
    const e = err as { code?: string; responseCode?: number; response?: string; message?: string };
    console.error("[consultation] SMTP send failed", {
      host: SMTP_HOST,
      port,
      user: SMTP_USER,
      code: e.code,
      responseCode: e.responseCode,
      response: e.response,
      message: e.message,
    });
    return NextResponse.json({ error: "We couldn't send your request. Please try again or email us directly." }, { status: 502 });
  }

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

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function renderText(lead: ConsultationRequest, receivedAt: string) {
  const rows = FIELDS.map(([k, label]) => `${label}: ${lead[k] || "-"}`);
  return ["New consultation request", "", ...rows, "", `Received: ${receivedAt}`].join("\n");
}

function renderHtml(lead: ConsultationRequest, receivedAt: string) {
  const rows = FIELDS.map(
    ([k, label]) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#555;vertical-align:top;white-space:nowrap"><strong>${label}</strong></td>` +
      `<td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(lead[k] || "-")}</td></tr>`
  ).join("");
  return (
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">` +
    `<h2 style="margin:0 0 12px">New consultation request</h2>` +
    `<table style="border-collapse:collapse">${rows}</table>` +
    `<p style="margin-top:16px;color:#777;font-size:12px">Received ${escapeHtml(receivedAt)}. ` +
    `Reply to this email to respond to ${escapeHtml(lead.name)} directly.</p>` +
    `</div>`
  );
}
