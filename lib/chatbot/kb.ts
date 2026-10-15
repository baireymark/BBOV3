// Builds the assistant's knowledge base from the site's own pages, in the browser.
// Every same-origin page reachable from the home page is fetched, split into sections at its
// headings, and stored with the section's heading, text and link. Business details (name, logo,
// phone, email, address, hours, social links, key pages) are read from the same markup.

import { cleanText, normalize, splitSentences } from "./text";

/** A sentence, or a list (with the sentence that introduces it), from a page section. */
export interface Unit {
  text: string;
  lead?: string;
  items?: string[];
}

export interface KbSection {
  id: string;
  heading: string;
  units: Unit[];
  /** Page path plus anchor, e.g. "/#services". Always same-origin. */
  url: string;
  page: string;
  /** Header and footer link labels that point at the section ("How it works"). */
  aliases: string[];
  /** Words from the ids of the heading and its section ("values-title" -> "values"). */
  keywords: string[];
  level: number;
  parent?: string;
  children: string[];
}

export type KeyPage = "about" | "services" | "pricing" | "faq" | "contact" | "privacy" | "careers";

export interface Link {
  label: string;
  href: string;
}

export interface SiteProfile {
  name: string;
  /** Initialism the site uses for itself, e.g. "BBO". */
  acronym?: string;
  logo?: string;
  icon?: string;
  phones: Link[];
  emails: Link[];
  address?: string;
  hours: string[];
  socials: Link[];
  pages: Partial<Record<KeyPage, Link>>;
  /** Main navigation labels, used for the quick-reply buttons. */
  topics: Link[];
}

export interface KnowledgeBase {
  sections: KbSection[];
  profile: SiteProfile;
}

// ---------------------------------------------------------------------------
// Site details

const SOCIAL_HOSTS: [RegExp, string][] = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)(twitter|x)\.com$/, "X (Twitter)"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)pinterest\.com$/, "Pinterest"],
  [/(^|\.)threads\.net$/, "Threads"],
];

// Checked in order against a link's label, then its path and anchor; the first link found for each key wins.
// "About" must start the label, so buttons like "Ask about customer experience" don't count.
const KEY_PAGES: [KeyPage, RegExp, RegExp][] = [
  ["privacy", /\bprivacy\b/, /\bprivacy\b/],
  ["careers", /\b(careers?|jobs|join (us|our team)|vacancies)\b/, /\b(careers?|jobs)\b/],
  ["pricing", /\b(pricing|prices?|plans)\b/, /\b(pricing|prices|plans)\b/],
  ["faq", /\b(faqs?|frequently asked)\b/, /\bfaqs?\b/],
  ["contact", /\b(contact|get in touch|consultation|book a (call|demo|meeting)|enquir\w*|inquir\w*)\b/, /\b(contact|consultation)\b/],
  ["about", /^(about|who we are|our story)\b/, /\babout\b/],
  ["services", /\bservices?\b/, /\bservices?\b/],
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same-origin path + hash for internal links, or the absolute URL for http(s) links. Anything else is rejected. */
export function safeUrl(href: string | null | undefined, base: string): URL | null {
  if (!href) return null;
  try {
    const url = new URL(href, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function sitePath(url: URL) {
  const path = url.pathname.replace(/\/index\.html?$/, "/").replace(/(.)\/$/, "$1");
  return path + url.hash;
}

function textOf(el: Element | null | undefined) {
  return el ? cleanText(el.textContent ?? "") : "";
}

/** Organization-like objects from JSON-LD blocks, including those nested in @graph. */
function structuredData(doc: Document): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const type = ([] as unknown[]).concat(obj["@type"] ?? []).join(" ");
    if (/Organization|Business|Corporation|Store|Office|Agency|Service/i.test(type)) out.push(obj);
    if (obj["@graph"]) visit(obj["@graph"]);
  };
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      visit(JSON.parse(s.textContent ?? ""));
    } catch {
      /* Invalid JSON-LD is ignored, never guessed at. */
    }
  });
  return out;
}

const str = (v: unknown) => (typeof v === "string" ? cleanText(v) : "");

function formatAddress(v: unknown): string {
  if (typeof v === "string") return cleanText(v);
  if (!v || typeof v !== "object") return "";
  const a = v as Record<string, unknown>;
  const country = typeof a.addressCountry === "object" ? str((a.addressCountry as Record<string, unknown>).name) : str(a.addressCountry);
  return [str(a.streetAddress), str(a.addressLocality), [str(a.addressRegion), str(a.postalCode)].filter(Boolean).join(" "), country]
    .filter(Boolean)
    .join(", ");
}

function formatHours(org: Record<string, unknown>): string[] {
  const out = ([] as unknown[]).concat(org.openingHours ?? []).map(str).filter(Boolean);
  for (const spec of ([] as unknown[]).concat(org.openingHoursSpecification ?? [])) {
    if (!spec || typeof spec !== "object") continue;
    const s = spec as Record<string, unknown>;
    const days = ([] as unknown[])
      .concat(s.dayOfWeek ?? [])
      .map((d) => str(d).replace(/^https?:\/\/schema\.org\//, ""))
      .filter(Boolean)
      .join(", ");
    const time = [str(s.opens), str(s.closes)].filter(Boolean).join("–");
    if (days || time) out.push([days, time].filter(Boolean).join(": "));
  }
  return out;
}

/** Reads the business details from a page. `base` resolves relative URLs. */
export function extractProfile(doc: Document, base: string): SiteProfile {
  const orgs = structuredData(doc);
  const org = (key: string) => orgs.map((o) => o[key]).find((v) => v != null);
  const banner = doc.querySelector("body > header, [role=banner]");
  const footer = doc.querySelector("body > footer, [role=contentinfo]");
  const logoImg = banner?.querySelector("img") ?? doc.querySelector("img[alt*=logo i]");

  const brandLabel = banner?.querySelector("a[aria-label]")?.getAttribute("aria-label")?.replace(/\s+home$/i, "");
  const name =
    str(org("name")) ||
    doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim() ||
    logoImg?.getAttribute("alt")?.trim() ||
    brandLabel?.trim() ||
    doc.querySelector('meta[name="application-name"]')?.getAttribute("content")?.trim() ||
    doc.title.split(/\s[|–—-]\s/)[0].trim() ||
    new URL(base).hostname;

  const logoOrg = org("logo");
  const logoSrc =
    (typeof logoOrg === "string" ? logoOrg : str((logoOrg as Record<string, unknown> | undefined)?.url)) ||
    (logoImg as HTMLImageElement | null)?.currentSrc ||
    logoImg?.getAttribute("src");
  const icons = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]'));
  const icon = icons.sort((a, b) => parseInt(b.getAttribute("sizes") || "0") - parseInt(a.getAttribute("sizes") || "0"))[0];

  const profile: SiteProfile = {
    name,
    acronym: findAcronym(name, doc),
    logo: safeUrl(logoSrc, base)?.href,
    icon: safeUrl(icon?.getAttribute("href"), base)?.href,
    phones: [],
    emails: [],
    address: formatAddress(org("address")) || addressFromMarkup(doc) || undefined,
    hours: orgs.flatMap(formatHours),
    socials: [],
    pages: {},
    topics: [],
  };

  for (const t of ([] as unknown[]).concat(org("telephone") ?? [])) addPhone(profile, str(t), str(t));
  for (const e of ([] as unknown[]).concat(org("email") ?? [])) addEmail(profile, str(e).replace(/^mailto:/i, ""));
  for (const s of ([] as unknown[]).concat(org("sameAs") ?? [])) addSocial(profile, str(s), base);
  doc.querySelectorAll('[itemprop="openingHours"]').forEach((el) => {
    const h = el.getAttribute("content") || textOf(el);
    if (h && !profile.hours.includes(h)) profile.hours.push(h);
  });

  // Links in the header and footer come first, so key pages prefer site-wide navigation.
  // Social profiles are only taken from the header and footer, not from links inside articles.
  const siteWide = [...Array.from(banner?.querySelectorAll("a[href]") ?? []), ...Array.from(footer?.querySelectorAll("a[href]") ?? [])];
  for (const a of [...siteWide, ...Array.from(doc.querySelectorAll("a[href]"))]) {
    // The chat's own links (on the live page) are not site details.
    if (a.closest("[data-chatbot-ignore]")) continue;
    const href = a.getAttribute("href") ?? "";
    const label = textOf(a) || a.getAttribute("aria-label")?.trim() || "";
    if (/^tel:/i.test(href)) addPhone(profile, label, href.slice(4));
    else if (/^mailto:/i.test(href)) addEmail(profile, safeDecode(href.slice(7).split("?")[0]));
    else {
      const url = safeUrl(href, base);
      if (!url) continue;
      if (url.origin !== new URL(base).origin) {
        if (siteWide.includes(a)) addSocial(profile, url.href, base);
      } else if (label && !normalize(label).includes(normalize(name))) {
        // Brand links ("<business name> home") are not key pages, even when the name contains "Services".
        addKeyPage(profile, label, url);
      }
    }
  }

  banner?.querySelectorAll("nav a[href]").forEach((a) => {
    const url = safeUrl(a.getAttribute("href"), base);
    const label = textOf(a);
    if (url && url.origin === new URL(base).origin && label && !profile.topics.some((t) => t.label === label)) {
      profile.topics.push({ label, href: sitePath(url) });
    }
  });
  return profile;
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function addPhone(p: SiteProfile, label: string, raw: string) {
  const number = raw.replace(/[^\d+]/g, "");
  if (number.replace(/\D/g, "").length < 6 || p.phones.some((x) => x.href === `tel:${number}`)) return;
  p.phones.push({ label: label || raw, href: `tel:${number}` });
}

function addEmail(p: SiteProfile, address: string) {
  const email = address.trim();
  if (!EMAIL_RE.test(email) || p.emails.some((x) => x.label.toLowerCase() === email.toLowerCase())) return;
  p.emails.push({ label: email, href: `mailto:${email}` });
}

function addSocial(p: SiteProfile, href: string, base: string) {
  const url = safeUrl(href, base);
  if (!url) return;
  const host = url.hostname.replace(/^www\./, "");
  const network = SOCIAL_HOSTS.find(([re]) => re.test(host))?.[1];
  if (network && !p.socials.some((s) => s.label === network)) p.socials.push({ label: network, href: url.href });
}

function addKeyPage(p: SiteProfile, label: string, url: URL) {
  const text = normalize(label).trim();
  const path = normalize(`${url.pathname} ${url.hash}`).replace(/[-_/#]+/g, " ");
  for (const [key, labelRe, pathRe] of KEY_PAGES) {
    if (!p.pages[key] && (labelRe.test(text) || pathRe.test(path))) {
      p.pages[key] = { label, href: sitePath(url) };
      return;
    }
  }
}

/** Text of an <address> element, minus the phone and email lines it often repeats. */
function addressFromMarkup(doc: Document) {
  const el = doc.querySelector("address, [itemprop=address]");
  if (!el) return "";
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]').forEach((a) => a.remove());
  return cleanText(clone.textContent ?? "").replace(/^[,;\s]+|[,;\s]+$/g, "");
}

/** The initialism a site uses for itself ("BBO" for "Beyond Borders Outsourcing Services Inc."), if it appears on the page. */
function findAcronym(name: string, doc: Document): string | undefined {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("");
  const text = doc.body?.textContent ?? "";
  for (let n = initials.length; n >= 2; n--) {
    const candidate = initials.slice(0, n);
    if (new RegExp(`\\b${candidate}\\b`).test(text)) return candidate;
  }
  return undefined;
}

/** Fills gaps in `into` with details found on another page. */
export function mergeProfile(into: SiteProfile, from: SiteProfile): SiteProfile {
  const union = (a: Link[], b: Link[]) => [...a, ...b.filter((x) => !a.some((y) => y.href === x.href || y.label === x.label))];
  return {
    ...into,
    acronym: into.acronym ?? from.acronym,
    logo: into.logo ?? from.logo,
    icon: into.icon ?? from.icon,
    address: into.address ?? from.address,
    hours: into.hours.length ? into.hours : from.hours,
    phones: union(into.phones, from.phones),
    emails: union(into.emails, from.emails),
    socials: union(into.socials, from.socials),
    pages: { ...from.pages, ...into.pages },
    topics: into.topics.length ? into.topics : from.topics,
  };
}

// ---------------------------------------------------------------------------
// Page sections

// Content that is not part of the page's prose: interface controls, decoration, navigation,
// live widgets, and anything marked with data-chatbot-ignore.
const SKIP_SELECTOR = [
  "script", "style", "noscript", "template", "svg", "canvas", "iframe", "video", "audio", "object", "embed", "img",
  "picture", "form", "button", "select", "input", "textarea", "label", "output", "dialog", "nav", "[role=dialog]",
  "[role=navigation]", "[role=tablist]", "[role=banner]", "[role=contentinfo]", "[aria-hidden=true]", "[aria-live]",
  "[data-chatbot-ignore]",
].join(",");

const BLOCK_TAGS = new Set(
  "ADDRESS ARTICLE ASIDE BLOCKQUOTE CAPTION DD DETAILS DIV DL DT FIELDSET FIGCAPTION FIGURE FOOTER HEADER HR LI MAIN OL P PRE SECTION SUMMARY TABLE TBODY TD TFOOT TH THEAD TR UL".split(
    " "
  )
);

// <summary> and <dt> label the content that follows them, like a minor heading (FAQ questions, for example).
const headingLevel = (el: Element) =>
  /^H[1-6]$/.test(el.tagName) ? Number(el.tagName[1]) : el.tagName === "SUMMARY" || el.tagName === "DT" ? 7 : 0;

function isSkipped(el: Element, root: Element) {
  if (el.matches(SKIP_SELECTOR)) return true;
  // Page-level header and footer when there is no <main>.
  if ((el.tagName === "HEADER" || el.tagName === "FOOTER") && el.parentElement === root && root.tagName === "BODY") return true;
  // Hidden content is skipped, except inactive tab panels, which are real page content.
  if (el.hasAttribute("hidden") && el.getAttribute("role") !== "tabpanel") return true;
  return /display\s*:\s*none|visibility\s*:\s*hidden/i.test(el.getAttribute("style") ?? "");
}

/** Text of inline nodes, with a space wherever elements meet ("<span>One.</span><span>Two.</span>" -> "One. Two."). */
function inlineText(nodes: Node[], root: Element): string {
  const parts: string[] = [];
  const visit = (n: Node) => {
    if (n.nodeType === 3) parts.push(n.nodeValue ?? "");
    else if (n.nodeType === 1 && !isSkipped(n as Element, root)) {
      if ((n as Element).tagName === "BR") parts.push(" ");
      else {
        parts.push(" ");
        n.childNodes.forEach(visit);
        parts.push(" ");
      }
    }
  };
  nodes.forEach(visit);
  return cleanText(parts.join(""));
}

/** A run made only of links (buttons, phone/email links) is navigation, not prose. */
function isLinkOnly(nodes: Node[]) {
  let hasLink = false;
  for (const n of nodes) {
    if (n.nodeType === 3 && (n.nodeValue ?? "").trim()) return false;
    if (n.nodeType === 1) {
      const el = n as Element;
      if (el.tagName === "A") hasLink = true;
      else if (el.textContent?.trim()) return false;
    }
  }
  return hasLink;
}

type PageEvent =
  | { kind: "heading"; level: number; text: string; el: Element }
  | { kind: "block"; text: string; el: Element; list?: Element };

function walk(el: Element, root: Element, out: PageEvent[]) {
  let run: Node[] = [];
  const flush = () => {
    if (run.length && !isLinkOnly(run)) {
      const text = inlineText(run, root);
      const list = el.tagName === "LI" ? el.parentElement ?? undefined : undefined;
      // A few words with no punctuation outside a list are an interface label ("Salary What you see"), not prose.
      const fragment = !list && !/[.!?:]$/.test(text) && text.split(" ").length < 5;
      if (/[\p{L}\p{N}]/u.test(text) && !fragment) out.push({ kind: "block", text, el, list });
    }
    run = [];
  };
  el.childNodes.forEach((child) => {
    if (child.nodeType === 3) return void run.push(child);
    if (child.nodeType !== 1) return;
    const c = child as Element;
    if (isSkipped(c, root)) return;
    const level = headingLevel(c);
    if (level) {
      flush();
      const text = inlineText([c], root);
      if (text) out.push({ kind: "heading", level, text, el: c });
    } else if (BLOCK_TAGS.has(c.tagName)) {
      flush();
      walk(c, root, out);
    } else run.push(c);
  });
  flush();
}

/** Turns a section's blocks into display units. Lists become one unit, joined to the sentence that introduces them. */
function toUnits(blocks: { text: string; list?: Element }[]): Unit[] {
  const units: Unit[] = [];
  for (let i = 0; i < blocks.length; ) {
    const list = blocks[i].list;
    if (!list) {
      splitSentences(blocks[i++].text).forEach((s) => units.push({ text: s }));
      continue;
    }
    const items: string[] = [];
    while (i < blocks.length && blocks[i].list === list) items.push(blocks[i++].text);
    // Items written as full sentences ("Your goals drive our work.") read best as sentences.
    if (items.filter((t) => /[.!?]$/.test(t)).length * 2 >= items.length) {
      items.forEach((t) => splitSentences(t).forEach((s) => units.push({ text: s })));
      continue;
    }
    const prev = units[units.length - 1];
    if (prev && !prev.items && prev.text.endsWith(":")) {
      units[units.length - 1] = { text: `${prev.text} ${items.join(", ")}`, lead: prev.text, items };
    } else units.push({ text: items.join(", "), items });
  }
  return units;
}

const sectionRoot = (el: Element) => el.closest("section, article, main, body");

const GENERIC_ID_WORDS = new Set("title heading header section sec block wrap wrapper container content inner outer main root anchor tab panel".split(" "));

/** "how-it-works" -> "how it works", "valuesTitle" -> "values". Generic words and numbers are dropped. */
function idWords(id: string | null | undefined): string {
  if (!id) return "";
  return id
    .split(/[-_\s]+|(?<=[a-z])(?=[A-Z])/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 1 && !GENERIC_ID_WORDS.has(w) && !/^(h[1-6]|\d+)$/.test(w))
    .join(" ");
}

interface Draft {
  section: KbSection;
  el: Element;
  blocks: { text: string; list?: Element }[];
  root: Element | null;
}

/**
 * Splits one page into sections at its headings. Returns the sections and a map from element id
 * to the first section inside that element, used to attach navigation labels as aliases.
 */
export function extractSections(doc: Document, page: string): { sections: KbSection[]; byId: Map<string, KbSection> } {
  const root = doc.querySelector("main") ?? doc.body;
  if (!root) return { sections: [], byId: new Map() };
  const events: PageEvent[] = [];
  walk(root, root, events);

  const drafts: Draft[] = [];
  const byId = new Map<string, KbSection>();
  const stack: Draft[] = [];
  let orphans: { text: string; list?: Element; root: Element | null }[] = [];

  for (const ev of events) {
    if (ev.kind === "heading") {
      while (stack.length && stack[stack.length - 1].section.level >= ev.level) stack.pop();
      const parent = stack.length ? stack[stack.length - 1] : undefined;
      const section: KbSection = {
        id: `${page}#${drafts.length}`,
        heading: ev.text,
        units: [],
        url: page,
        page,
        aliases: [],
        keywords: [],
        level: ev.level,
        children: [],
      };
      const draft: Draft = { section, el: ev.el, blocks: [], root: sectionRoot(ev.el) };
      // An eyebrow line above a heading in the same <section> belongs to that heading.
      draft.blocks.push(...orphans.filter((o) => o.root === draft.root));
      orphans = [];

      for (let n: Element | null = ev.el; n && n !== root.parentElement; n = n.parentElement) {
        if (n.id && !byId.has(n.id)) byId.set(n.id, section);
      }
      const host = ev.el.closest("section[id], article[id]");
      const leadsHost = !!host && byId.get(host.id) === section;

      // Link to the section's id when this heading opens it (the anchor the site's own menus use),
      // otherwise to the nearest id on the heading or its containers. Hidden tab panels are skipped,
      // since the browser cannot scroll to them; the assistant opens the tab itself.
      let anchor = leadsHost ? host!.id : "";
      for (let n: Element | null = ev.el; !anchor && n && n !== root; n = n.parentElement) {
        if (n.id && n.getAttribute("role") !== "tabpanel") anchor = n.id;
      }
      if (!anchor && parent) anchor = parent.section.url.split("#")[1] ?? "";
      section.url = anchor ? `${page}#${anchor}` : page;

      // Ids name their content: the heading's own id, and its section's id if it is the section's first heading.
      for (const id of [ev.el.id, leadsHost ? host!.id : ""]) {
        const kw = idWords(id);
        if (kw && !section.keywords.includes(kw)) section.keywords.push(kw);
      }

      if (parent && parent.section.level >= 2) {
        section.parent = parent.section.id;
        parent.section.children.push(section.id);
      }
      drafts.push(draft);
      stack.push(draft);
    } else {
      const current = stack[stack.length - 1];
      const block = { text: ev.text, list: ev.list };
      if (current && sectionRoot(ev.el) === current.root) current.blocks.push(block);
      else if (current && !current.root?.contains(ev.el)) orphans.push({ ...block, root: sectionRoot(ev.el) });
      else if (current) current.blocks.push(block);
      else orphans.push({ ...block, root: sectionRoot(ev.el) });
    }
  }

  for (const d of drafts) d.section.units = toUnits(d.blocks);
  // Keep sections with text of their own, or that group other sections (a heading followed by sub-headings).
  const kept = drafts.map((d) => d.section).filter((s) => s.units.length || s.children.length);
  const keptIds = new Set(kept.map((s) => s.id));
  for (const s of kept) s.children = s.children.filter((id) => keptIds.has(id));
  for (const [id, s] of byId) if (!keptIds.has(s.id)) byId.delete(id);
  return { sections: kept, byId };
}

/** Same-origin page links worth crawling. */
function pageLinks(doc: Document, base: string): string[] {
  const origin = new URL(base).origin;
  const out = new Set<string>();
  doc.querySelectorAll("a[href]").forEach((a) => {
    const url = safeUrl(a.getAttribute("href"), base);
    if (!url || url.origin !== origin || a.hasAttribute("download")) return;
    if (/^\/(api|_next)\//.test(url.pathname) || /\.(?!html?$)[a-z0-9]{2,5}$/i.test(url.pathname)) return;
    out.add(sitePath(new URL(url.pathname, origin)));
  });
  return [...out];
}

/**
 * Header and footer link labels for each link target. A target that links share under several
 * labels, any of which is a section heading ("Customer experience", "Technical support" -> "#services"),
 * is a collection link: its labels name sub-topics, not the target, so they are left out.
 */
function navLabels(doc: Document, base: string, headings: Set<string>): Map<string, string[]> {
  const labels = new Map<string, Set<string>>();
  doc.querySelectorAll("body > header a[href], [role=banner] a[href], body > footer a[href], [role=contentinfo] a[href]").forEach((a) => {
    const url = safeUrl(a.getAttribute("href"), base);
    const label = textOf(a);
    if (!url || url.origin !== new URL(base).origin || !label) return;
    const key = sitePath(url);
    labels.set(key, (labels.get(key) ?? new Set()).add(label));
  });
  const out = new Map<string, string[]>();
  for (const [href, set] of labels) {
    const list = [...set];
    if (list.length <= 2 && !list.some((l) => headings.has(normalize(l)))) out.set(href, list);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Crawling and caching

const MAX_PAGES = 30;
const CACHE_KEY = "bob:kb:v1";
const CACHE_TTL = 30 * 60 * 1000;

async function fetchPage(path: string): Promise<Document | null> {
  try {
    const res = await fetch(path, { credentials: "same-origin", headers: { Accept: "text/html" } });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    if (new URL(res.url, location.href).origin !== location.origin) return null;
    return new DOMParser().parseFromString(await res.text(), "text/html");
  } catch {
    return null;
  }
}

/** Crawls the site from the home page and the current page and builds the knowledge base. */
export async function crawlSite(baseProfile: SiteProfile): Promise<KnowledgeBase> {
  const origin = location.origin;
  const queue = [...new Set(["/", location.pathname.replace(/(.)\/$/, "$1")])];
  const seen = new Set(queue);
  const sections: KbSection[] = [];
  const seenText = new Set<string>();
  let profile = baseProfile;

  while (queue.length) {
    const batch = queue.splice(0, 4);
    const docs = await Promise.all(batch.map(fetchPage));
    docs.forEach((doc, i) => {
      if (!doc) return;
      const page = batch[i];
      const base = origin + page;
      profile = mergeProfile(profile, extractProfile(doc, base));

      const { sections: found, byId } = extractSections(doc, page);
      // The h1 is the page's own section, so a link to the page names it.
      const pageSection = found.find((s) => s.level === 1) ?? found[0];
      const headings = new Set(found.map((s) => normalize(s.heading)));
      for (const [href, labels] of navLabels(doc, base, headings)) {
        const [path, hash] = href.split("#");
        if ((path || "/") !== page) continue;
        const target = hash ? byId.get(hash) : pageSection;
        for (const label of labels) if (target && !target.aliases.includes(label)) target.aliases.push(label);
      }
      for (const s of found) {
        // Shared blocks (a sign-up panel on every page, say) are kept once.
        const key = normalize(s.heading + " " + s.units.map((u) => u.text).join(" "));
        if (seenText.has(key)) continue;
        seenText.add(key);
        sections.push(s);
      }
      for (const link of pageLinks(doc, base)) {
        if (!seen.has(link) && seen.size < MAX_PAGES) {
          seen.add(link);
          queue.push(link);
        }
      }
    });
  }
  return { sections, profile };
}

let pending: Promise<KnowledgeBase> | null = null;

/** The knowledge base, built once per browser session (cached in sessionStorage for 30 minutes). */
export function loadKnowledgeBase(baseProfile: SiteProfile): Promise<KnowledgeBase> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null");
      if (cached && Date.now() - cached.at < CACHE_TTL && Array.isArray(cached.kb?.sections) && cached.kb.sections.length) {
        return cached.kb as KnowledgeBase;
      }
    } catch {
      /* Storage can be unavailable (private mode); fall through and crawl. */
    }
    let kb: KnowledgeBase;
    try {
      kb = await crawlSite(baseProfile);
    } catch {
      kb = { sections: [], profile: baseProfile };
    }
    if (!kb.sections.length) {
      pending = null; // Offline or blocked: let the next question retry.
      return kb;
    }
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), kb }));
    } catch {
      /* Quota or privacy mode: the knowledge base still works for this page view. */
    }
    return kb;
  })();
  return pending;
}
