import {
  CONTACT,
  COST_LAYERS,
  FAQS,
  INDUSTRIES,
  PH_SKILLS,
  SERVICES,
  SERVICE_OPTIONS,
  STEPS,
  TEAM_SIZE_OPTIONS,
  VALUES,
  WHY,
  type ServiceKey,
} from "./content";
import type { BobFlowKey } from "./events";

// Bob's script: the menu, keyword-matched answers, and two guided flows that send a visitor's details to the team.
// Answers are built from lib/content.ts so they match the page. Typed questions are matched against each answer's
// keywords first; only questions with no match go to Claude (when ANTHROPIC_API_KEY is set).
// Messages can use **bold** and [links](#section) to sections of the page.

export const BOB = {
  teaser: "Hi, I'm Bob. Thinking about an offshore team? I can help you plan one in about a minute.",
  /** Milliseconds after the page loads before the teaser appears. It shows once per browser session. */
  teaserDelay: 3000,
  greeting:
    "Hi, I'm Bob, the Beyond Borders virtual assistant. I can answer questions about BBO, help you plan a team, or connect you with our people. What would you like to do?",
  menu: "What else can I help you with?",
  unsure: `I'm not sure I have the answer to that one. Our team can help: call ${CONTACT.phone}, email ${CONTACT.email}, or leave your details and they'll reach out.`,
  declined: `I can't help with that one. Ask me anything about BBO, or reach our team at ${CONTACT.email}.`,
  cancelled: "Okay, I stopped. Nothing was sent. What else can I help with?",
  notSent: `No problem. Nothing has been sent. You can reach our team any time at ${CONTACT.email} or ${CONTACT.phone}.`,
  pickOption: "Please choose one of the options below, or type **cancel** to stop.",
  sendFailed: `I couldn't send your details automatically. Use the link below to email them to our team (it opens pre-filled), or call ${CONTACT.phone}.`,
  emailLink: "Email my details to BBO",
  placeholder: "Type your question",
  choosePlaceholder: "Choose an option above",
  disclaimer: "Bob is a virtual assistant and can make mistakes.",
};

/** Details a flow collects. The first six are the consultation form's fields; the rest go into its message. */
export interface Lead {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  service?: string;
  size?: string;
  timeline?: string;
  bestTime?: string;
  consent?: string;
}

export type TopicKey =
  | `svc-${ServiceKey}`
  | "pricing"
  | "savings"
  | "timing"
  | "process"
  | "hours"
  | "languages"
  | "size"
  | "industries"
  | "philippines"
  | "why"
  | "mission"
  | "about"
  | "contact"
  | "bpo"
  | "sla"
  | "outsourcing"
  | "services"
  | "hello"
  | "thanks"
  | "bye"
  | "unsure";

export type BobAction =
  | { type: "menu" }
  | { type: "topic"; topic: TopicKey }
  | { type: "flow"; flow: BobFlowKey; prefill?: Lead }
  | { type: "pick"; value: string }
  | { type: "skip" }
  | { type: "retry" };

/** A quick-reply button. */
export interface BobChoice {
  label: string;
  action: BobAction;
}

export interface FlowStep {
  field: keyof Lead;
  ask: (lead: Lead) => string;
  /** Quick replies to pick from. Typed text that matches one (or one of the aliases) counts as picking it. */
  options?: string[];
  aliases?: Record<string, string>;
  /** Picking this option ends the flow without sending anything. */
  stop?: string;
  optional?: boolean;
  /** Returns a request to try again when the answer won't work. */
  check?: (value: string) => string | undefined;
  /** Bob's short response to the answer. */
  reply?: (value: string) => string | undefined;
  input?: { placeholder: string; inputMode?: "text" | "email" | "tel"; autoComplete?: string };
}

export interface Flow {
  /** Button label, also shown as the visitor's message when the flow starts. */
  label: string;
  intro: string;
  steps: FlowStep[];
  /** Sent to the team as the request's message. */
  note: (lead: Lead) => string;
  done: (lead: Lead) => string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const firstName = (lead: Lead) => (lead.name ?? "").trim().split(/\s+/)[0];
const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
const sentence = (items: string[]) => `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
const faq = (question: RegExp) => FAQS.find((f) => question.test(f.q))?.a ?? BOB.unsure;
const SOONER = `Need us sooner? Call ${CONTACT.phone}.`;
const AGREED = "Agreed to be contacted by email or phone.";

/* Questions shared by both flows */

const NAME: FlowStep = {
  field: "name",
  ask: () => "What's your name?",
  check: (v) => (v.length >= 2 ? undefined : "Please enter your name."),
  input: { placeholder: "Your full name", autoComplete: "name" },
};

const COMPANY: FlowStep = {
  field: "company",
  ask: (lead) => `Thanks, ${firstName(lead)}. What's your company called?`,
  input: { placeholder: "Company name", autoComplete: "organization" },
};

const EMAIL: FlowStep = {
  field: "email",
  ask: () => "What's the best work email to reach you?",
  check: (v) => (EMAIL_RE.test(v) ? undefined : "That email doesn't look right. Please check it and try again."),
  input: { placeholder: "you@company.com", inputMode: "email", autoComplete: "email" },
};

const checkPhone = (v: string) =>
  (v.match(/\d/g) ?? []).length >= 7 ? undefined : "That number looks too short. Please include the country or area code.";
const PHONE_INPUT = { placeholder: "Phone number", inputMode: "tel", autoComplete: "tel" } as const;

const CONSENT_YES = "Yes, send it";
const CONSENT_NO = "No thanks";

/** Last step: show what will be sent and ask before sending it. */
const CONSENT: FlowStep = {
  field: "consent",
  ask: (lead) =>
    "Last step. I'll send these details to our team so they can contact you by email or phone about your request:\n" +
    list([`Name: ${lead.name}`, `Company: ${lead.company}`, `Email: ${lead.email}`, ...(lead.phone ? [`Phone: ${lead.phone}`] : [])]) +
    "\nOK to send?",
  options: [CONSENT_YES, CONSENT_NO],
  aliases: Object.fromEntries([
    ...["yes", "y", "yeah", "yep", "sure", "ok", "okay", "send", "agree", "i agree"].map((w) => [w, CONSENT_YES]),
    ...["no", "n", "nope", "decline", "don't send", "dont send"].map((w) => [w, CONSENT_NO]),
  ]),
  stop: CONSENT_NO,
};

/** Tailors the thank-you to the team size the visitor chose. */
function sizeTip(size?: string) {
  if (size === TEAM_SIZE_OPTIONS[0]) return "Starting with one position is a simple way to begin, and you can build from there.";
  if (size === TEAM_SIZE_OPTIONS.at(-1)) return "For a full department, our team will design the roles, structure, and processes with you before building it out.";
  return "Our team will map out the roles and structure your team needs with you.";
}

export const FLOWS: Record<BobFlowKey, Flow> = {
  // Like Gunny's eligibility check: what the visitor needs, then how to reach them.
  evaluation: {
    label: "Plan my team",
    intro: "Great, this takes about a minute. You can type **cancel** at any time.",
    steps: [
      {
        field: "service",
        ask: () => "Which area do you need support in?",
        options: SERVICE_OPTIONS,
        reply: (v) => SERVICES.find((s) => s.option === v)?.tagline ?? "No problem. We'll work out the right roles with you.",
      },
      { field: "size", ask: () => "How big a team do you have in mind?", options: TEAM_SIZE_OPTIONS },
      {
        field: "timeline",
        ask: () => "When would you like the team to start?",
        options: ["As soon as possible", "In 1 to 3 months", "In 3 to 6 months", "Just exploring"],
      },
      NAME,
      COMPANY,
      EMAIL,
      {
        field: "phone",
        ask: () => "And a phone number, in case a call is easier? You can skip this.",
        optional: true,
        check: checkPhone,
        input: PHONE_INPUT,
      },
      CONSENT,
    ],
    note: (lead) => `Sent from Bob chat (team plan). Preferred start: ${lead.timeline ?? "not given"}. ${AGREED}`,
    done: (lead) =>
      `Thanks, ${firstName(lead)}. Your request is in. ${sizeTip(lead.size)} We'll be in touch at ${lead.email} to set up a time to talk.\n\n${SOONER}`,
  },
  // Like Gunny's "talk to an advocate": the topic, contact details, and a good time to call.
  callback: {
    label: "Talk to our team",
    intro: "Happy to connect you with our team. I just need a few details. Type **cancel** any time.",
    steps: [
      { field: "service", ask: () => "What would you like to talk about?", options: SERVICE_OPTIONS },
      NAME,
      COMPANY,
      EMAIL,
      { field: "phone", ask: () => "What's the best number to call you on?", check: checkPhone, input: PHONE_INPUT },
      {
        field: "bestTime",
        ask: () => "When's a good time to call, in your time zone?",
        options: ["Morning", "Afternoon", "Evening", "Any time"],
      },
      CONSENT,
    ],
    note: (lead) =>
      `Sent from Bob chat (callback request). Best time to call: ${lead.bestTime}, ` +
      `visitor's time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}. ${AGREED}`,
    done: (lead) =>
      `Thanks, ${firstName(lead)}. Your request is in, and our team will reach out at ${lead.phone} to arrange a call.\n\n${SOONER}`,
  },
};

/** If sending fails: a pre-filled email the visitor can send themselves, so the request isn't lost. */
export function leadMailto(flow: Flow, lead: Lead) {
  const lines = (
    [
      ["Name", lead.name],
      ["Company", lead.company],
      ["Email", lead.email],
      ["Phone", lead.phone],
      ["Area of support", lead.service],
      ["Team size", lead.size],
    ] as const
  )
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);
  const body = `Hello BBO,\n\n${lines.join("\n")}\n\n${flow.note(lead)}\n`;
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(`${flow.label}: ${lead.company} (${lead.name})`)}&body=${encodeURIComponent(body)}`;
}

/** The value typed text gives the current question, or undefined if it doesn't answer it. */
export function readAnswer(step: FlowStep, text: string) {
  if (step.optional && /^skip$/i.test(text)) return "";
  if (!step.options) return text;
  const t = text.trim().toLowerCase();
  return (
    step.aliases?.[t] ??
    step.options.find((o) => o.toLowerCase() === t) ??
    (t.length >= 3 ? step.options.find((o) => o.toLowerCase().includes(t)) : undefined)
  );
}

/* Quick replies */

const PLAN: BobChoice = { label: FLOWS.evaluation.label, action: { type: "flow", flow: "evaluation" } };
const CALL: BobChoice = { label: FLOWS.callback.label, action: { type: "flow", flow: "callback" } };
const MENU_CHOICE: BobChoice = { label: "Main menu", action: { type: "menu" } };
const topic = (label: string, key: TopicKey): BobChoice => ({ label, action: { type: "topic", topic: key } });

export const MENU: BobChoice[] = [
  PLAN,
  CALL,
  topic("Our services", "services"),
  topic("Pricing", "pricing"),
  topic("How it works", "process"),
  topic("Why the Philippines", "philippines"),
];
/** Offered after an answer that doesn't set its own. */
export const NEXT: BobChoice[] = [PLAN, CALL, MENU_CHOICE];
/** Offered after a visitor's details are sent. */
export const AFTER_SENT: BobChoice[] = [topic("Our services", "services"), topic("How it works", "process"), MENU_CHOICE];
export const RETRY: BobChoice[] = [{ label: "Try again", action: { type: "retry" } }, MENU_CHOICE];
export const SKIP: BobChoice = { label: "Skip", action: { type: "skip" } };

/* Answers */

interface Topic {
  /** Words and phrases that point to this answer. Phrases with spaces score highest. */
  keys: string[];
  answer: string[];
  choices?: BobChoice[];
}

/** Specific keywords for each service; the rest of each answer comes from SERVICES in lib/content.ts. */
const SERVICE_KEYS: Record<ServiceKey, string[]> = {
  cx: ["customer service", "customer support", "customer experience", "customer care", "call center", "call centre", "contact center", "live chat", "email support", "phone support", "inbound", "complaints", "retention", "cx"],
  hospitality: ["hotel", "hotels", "hospitality", "resort", "resorts", "reservations", "reservation", "booking", "bookings", "guest", "guests", "vacation rental", "vacation rentals", "property managers"],
  sales: ["sales", "business development", "prospecting", "lead generation", "lead qualification", "appointment setting", "outbound", "cold calling", "cold call", "pipeline", "sdr"],
  backoffice: ["back office", "back-office", "admin", "administrative", "data entry", "scheduling", "order processing", "database", "reporting", "research", "quality assurance", "paperwork"],
  tech: ["technical support", "tech support", "help desk", "helpdesk", "it support", "troubleshooting", "technical"],
  custom: ["custom", "customized", "tailored", "bespoke", "something else", "unique"],
};

const serviceTopics = Object.fromEntries(
  SERVICES.map((s): [string, Topic] => [
    `svc-${s.key}`,
    {
      keys: SERVICE_KEYS[s.key],
      answer: [
        `**${s.title}.** ${s.tagline}`,
        s.items ? `${s.intro}\n${list(s.items.slice(0, 8))}${s.items.length > 8 ? "\n- and more" : ""}` : s.intro,
        ...(s.outro ? [s.outro] : []),
      ],
      choices: [
        { label: "Plan a team for this", action: { type: "flow", flow: "evaluation", prefill: { service: s.option } } },
        { label: CALL.label, action: { type: "flow", flow: "callback", prefill: { service: s.option } } },
        topic("Other services", "services"),
      ],
    },
  ])
) as Record<`svc-${ServiceKey}`, Topic>;

const lower = (items: string[]) => items.map((i) => i.toLowerCase());

// Order matters only for ties: earlier entries win, so specific answers come before general ones.
export const TOPICS: Record<TopicKey, Topic> = {
  ...serviceTopics,
  pricing: {
    keys: ["cost", "costs", "price", "prices", "pricing", "fee", "fees", "rate", "rates", "how much", "quote", "budget", "expensive", "afford", "pay"],
    answer: [faq(/pricing/i), "The quickest way to get a quote is to tell us about the team you need."],
    choices: [PLAN, CALL, MENU_CHOICE],
  },
  savings: {
    keys: ["save", "savings", "cheaper", "overhead", "total cost", "reduce costs", "lower costs", "salary", "salaries", "hiring costs", "business case", "roi"],
    answer: [
      `Salary is only part of what a team costs. Every employee also carries ${sentence(lower(COST_LAYERS))}.`,
      "BBO helps you find the roles and processes where an offshore team creates a stronger financial and operational model, so you spend smarter while keeping the standards your customers expect. More in [The business case](#business-case).",
    ],
  },
  timing: {
    keys: ["how long", "how soon", "how fast", "how quickly", "timeline", "when can", "ready", "lead time", "turnaround"],
    answer: [
      "Timing depends on the roles, the skills you need, and the size of the team, so our team will give you a timeline once they've learned about your needs.",
    ],
  },
  process: {
    keys: ["how does it work", "how it works", "how do you work", "process", "steps", "get started", "start", "onboarding", "next step", "what happens", "recruit", "hiring process"],
    answer: [
      `Six steps take you from first conversation to a team that grows with you:\n${STEPS.map((s, i) => `${i + 1}. **${s.title}:** ${s.text}`).join("\n")}`,
      "You can start step one right here: tap **Plan my team**. More in [How it works](#how-it-works).",
    ],
  },
  hours: {
    keys: ["hours", "time zone", "time zones", "timezone", "24 7", "overnight", "night shift", "shifts", "shift", "weekend", "weekends", "coverage", "us hours"],
    answer: [
      "We work out operating hours and time-zone coverage with each client during the Discover step, so your team is set up around your business.",
    ],
  },
  languages: {
    keys: ["language", "languages", "multilingual", "bilingual", "english", "speak english", "spanish", "accent"],
    answer: [
      "We offer multilingual support for businesses serving diverse markets. Tell our team which languages you need, and they'll confirm the details with you.",
    ],
  },
  size: {
    keys: ["team size", "how many", "one person", "one position", "small team", "single", "department", "scale", "grow", "growing", "minimum"],
    answer: [
      "We build teams of any size, from one dedicated professional to an entire department. Start with one position, build a team, and grow from there.",
    ],
  },
  industries: {
    keys: ["industry", "industries", "real estate", "healthcare", "health care", "e-commerce", "ecommerce", "insurance", "financial", "finance", "travel", "retail", "property management", "technology", "professional services", "home services"],
    answer: [`We support businesses across ${sentence(lower(INDUSTRIES))}.`],
  },
  philippines: {
    keys: ["philippines", "filipino", "filipinos", "manila", "offshore", "why the philippines"],
    answer: [
      `The Philippines has built a deep workforce of professionals experienced in:\n${list(PH_SKILLS)}`,
      "BBO connects that talent directly to your business, so you're not limited to hiring in your local market. More in [Why the Philippines](#philippines).",
    ],
  },
  why: {
    keys: ["why bbo", "why choose", "why you", "why should", "different", "difference", "seats", "advantages", "quality"],
    answer: [
      "**BBO does not sell seats.** We build a team around your operation, your systems, and your standards.",
      list(WHY.map((w) => `**${w.title}:** ${w.text}`)),
    ],
  },
  mission: {
    keys: ["mission", "vision", "values", "believe", "promise", "promises"],
    answer: [
      "**Our mission:** to help businesses grow by connecting them with exceptional Filipino talent and delivering service built on trust, accountability, and results.",
      `**Our values:** ${sentence(VALUES.map((v) => v.title))}. More in [Mission and values](#mission).`,
    ],
  },
  about: {
    keys: ["about", "who are you", "what is bbo", "who is bbo", "beyond borders", "company", "founded", "story", "background"],
    answer: [
      "Beyond Borders Outsourcing Services Inc. was founded on a simple belief: great businesses deserve access to great people, wherever those people live.",
      "We connect companies with skilled professionals in the Philippines and build dedicated teams around each client's operation, with a focus on long-term partnership. More in [About BBO](#about).",
    ],
  },
  contact: {
    keys: ["contact", "phone", "call", "number", "email", "reach", "talk", "speak", "human", "person", "representative", "someone", "appointment", "schedule", "consultation", "meeting", "book"],
    answer: [`You can reach our team at ${CONTACT.phone} or ${CONTACT.email}. Or leave your details right here and they'll reach out.`],
    choices: [CALL, PLAN],
  },
  bpo: { keys: ["bpo", "business process outsourcing"], answer: [faq(/\bBPO\b/)] },
  sla: { keys: ["sla", "slas", "service level", "service level agreement"], answer: [faq(/\bSLA\b/)] },
  outsourcing: { keys: ["what is outsourcing", "outsourcing", "outsource"], answer: [faq(/what is outsourcing/i)] },
  services: {
    keys: ["services", "service", "what do you do", "offer", "provide", "what can you do", "help with"],
    answer: [`We build dedicated teams for six core services:\n${list(SERVICES.map((s) => s.label))}`, "Pick one to learn more, or see [Services](#services) on this page."],
    choices: [...SERVICES.map((s) => topic(s.shortLabel ?? s.label, `svc-${s.key}`)), PLAN],
  },
  hello: {
    keys: ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy"],
    answer: ["Hi there. I can answer questions about BBO, help you plan a team, or connect you with our people. What can I help with?"],
    choices: MENU,
  },
  thanks: {
    keys: ["thanks", "thank you", "thx", "appreciate", "great", "awesome", "perfect", "ok", "okay", "cool"],
    answer: ["You're welcome. Is there anything else I can help with?"],
    choices: MENU,
  },
  bye: {
    keys: ["bye", "goodbye", "see you", "that's all", "thats all", "done"],
    answer: [`Take care. If you need anything, I'm right here, or call ${CONTACT.phone}.`],
  },
  unsure: { keys: [], answer: [BOB.unsure], choices: [CALL, PLAN, MENU_CHOICE] },
};

/* Matching typed text */

const SMALL_TALK = new Set<TopicKey>(["hello", "thanks", "bye"]);

const norm = (s: string) =>
  ` ${s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9%' -]+/g, " ").replace(/\s+/g, " ")} `;

/** The answer whose keywords best match the text (the same scoring as Gunny), or undefined if none do. */
export function matchTopic(text: string): TopicKey | undefined {
  const t = norm(text);
  const words = t.trim().split(" ");
  let best: TopicKey | undefined;
  let bestScore = 0;
  for (const [key, { keys }] of Object.entries(TOPICS) as [TopicKey, Topic][]) {
    let score = 0;
    for (const k of keys) {
      if (k.includes(" ")) {
        if (t.includes(k)) score += 3;
      } else if (t.includes(` ${k} `)) {
        score += k.length > 3 ? 2 : 1;
      } else if (k.length >= 5 && words.some((w) => w.length >= 5 && (w.startsWith(k) || k.startsWith(w)))) {
        score += 1;
      }
    }
    // Small talk shouldn't win over a real question.
    if (SMALL_TALK.has(key) && words.length > 4) score *= 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return bestScore >= 1 ? best : undefined;
}

/** Typed requests that start a flow straight away, as if its button was tapped. */
const FLOW_INTENTS: [RegExp, BobFlowKey][] = [
  [/\b(call ?back|call me|contact me|reach out to me|have someone (call|contact))\b|^talk to (our|your) team$/i, "callback"],
  [/\b(plan (my|a) team|free (evaluation|assessment)|get a quote|request a quote)\b/i, "evaluation"],
];

export function matchFlow(text: string): BobFlowKey | undefined {
  return FLOW_INTENTS.find(([re]) => re.test(text.trim()))?.[1];
}

export const CANCEL_RE = /^(cancel|stop|quit|exit|never ?mind)$/i;
