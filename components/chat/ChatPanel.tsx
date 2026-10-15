"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { ASSISTANT_NAME, COPY, REPLY_DELAY_MS } from "@/lib/chatbot/config";
import { extractProfile, loadKnowledgeBase, type KbSection, type Link, type SiteProfile, type Unit } from "@/lib/chatbot/kb";
import { SiteSearch, stripGreeting, type Intent, type Reply } from "@/lib/chatbot/search";
import { readChat, writeChat } from "@/lib/chatbot/session";
import { normalize } from "@/lib/chatbot/text";
import CallbackForm from "./CallbackForm";

/** Matches the CSS breakpoint where the panel fills the screen. */
const FULL_SCREEN = "(max-width: 560px), (max-height: 560px)";
const MAX_MESSAGES = 60;
const MAX_QUESTION = 200;

interface SectionRef {
  id: string;
  heading: string;
  url: string;
}

/**
 * One chat message. Messages are kept in sessionStorage, so they hold plain data only,
 * and every string in them is rendered as text (React escapes it), never as HTML.
 */
interface Message {
  id: string;
  from: "bot" | "user";
  text?: string;
  answer?: { heading: string; units: Unit[]; url: string };
  options?: SectionRef[];
  optionsLabel?: string;
  /** Adds a "Something else" button after "Did you mean" options. */
  noneOfThese?: boolean;
  /** Shows the quick-reply topic buttons. */
  topics?: boolean;
  /** Shows the site's contact details. */
  contact?: boolean;
  /** Shows a "Request a callback" button. */
  callback?: boolean;
  links?: Link[];
  lines?: string[];
  form?: { question?: string; sentTo?: string };
}

type Draft = Omit<Message, "id" | "from">;

// ---------------------------------------------------------------------------
// Restoring stored messages: anything malformed is dropped.

const isStr = (v: unknown): v is string => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const optional = (v: unknown, test: (v: unknown) => boolean) => v === undefined || test(v);
const listOf = (test: (v: unknown) => boolean) => (v: unknown) => Array.isArray(v) && v.every(test);
const isUnit = (u: unknown) => isObj(u) && isStr(u.text) && optional(u.lead, isStr) && optional(u.items, listOf(isStr));
const isRef = (o: unknown) => isObj(o) && isStr(o.id) && isStr(o.heading) && isStr(o.url);
const isLink = (l: unknown) => isObj(l) && isStr(l.label) && isStr(l.href);

function isMessage(m: unknown): m is Message {
  return (
    isObj(m) &&
    isStr(m.id) &&
    (m.from === "bot" || m.from === "user") &&
    optional(m.text, isStr) &&
    optional(m.answer, (a) => isObj(a) && isStr(a.heading) && isStr(a.url) && listOf(isUnit)(a.units)) &&
    optional(m.options, listOf(isRef)) &&
    optional(m.optionsLabel, isStr) &&
    optional(m.links, listOf(isLink)) &&
    optional(m.lines, listOf(isStr)) &&
    optional(m.form, (f) => isObj(f) && optional(f.question, isStr) && optional(f.sentTo, isStr))
  );
}

function restoreMessages(): Message[] | null {
  const stored = readChat()?.messages.filter(isMessage) ?? [];
  return stored.length ? stored : null;
}

// ---------------------------------------------------------------------------
// Helpers

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toRef = (s: KbSection): SectionRef => ({ id: s.id, heading: s.heading, url: s.url });

/** Only same-origin paths, http(s) URLs, and tel:/mailto: links are ever rendered. */
function safeHref(href: string): string | undefined {
  if (/^(tel|mailto):/i.test(href)) return href;
  try {
    const url = new URL(href, location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin === location.origin ? url.pathname + url.search + url.hash : url.href;
  } catch {
    return undefined;
  }
}

const textKey = (s: string | null | undefined) => normalize(s ?? "").replace(/[^a-z0-9]/g, "");

/** Scrolls to a section on this page, first opening the tab or <details> that hides it. */
function revealOnPage(anchor: string, heading?: string) {
  const scope = (anchor && document.getElementById(anchor)) || document.querySelector("main") || document.body;
  let target = scope as HTMLElement;
  if (heading) {
    const key = textKey(heading);
    const matches = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6, summary, dt")).filter(
      (el) => !el.closest("[data-chatbot-ignore]") && textKey(el.textContent) === key
    );
    target = matches.find((el) => scope.contains(el)) ?? matches[0] ?? target;
  }
  const details = target.closest("details");
  if (details && !details.open) details.open = true;
  const panel = target.closest<HTMLElement>('[role="tabpanel"]');
  if (panel?.hidden) {
    const tab =
      document.querySelector<HTMLElement>(`[role="tab"][aria-controls="${CSS.escape(panel.id)}"]`) ??
      document.getElementById(panel.getAttribute("aria-labelledby") ?? "");
    tab?.click();
  }
  requestAnimationFrame(() => {
    target.scrollIntoView({ block: "start" });
    if (!target.matches("a[href], button, summary, input, select, textarea, [tabindex]")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
}

function welcome(profile: SiteProfile): Message {
  return { id: newId(), from: "bot", text: COPY.welcome(profile.name), topics: true };
}

function intentReply(intent: Intent, p: SiteProfile): Draft {
  switch (intent) {
    case "greeting":
      return { text: COPY.greeting(p.name), topics: true };
    case "thanks":
      return { text: COPY.thanks };
    case "bye":
      return { text: COPY.bye };
    case "identity":
      return { text: COPY.identity(p.name), topics: true };
    case "callback":
      return { text: COPY.callback, form: {} };
    case "contact":
      return { text: COPY.contact, contact: true, callback: true };
    case "hours":
      return p.hours.length ? { text: COPY.hours, lines: p.hours, contact: true } : { text: COPY.noHours, contact: true, callback: true };
    case "address":
      return p.address ? { text: COPY.address, lines: [p.address], contact: true } : { text: COPY.noAddress, contact: true, callback: true };
    case "social":
      return p.socials.length ? { text: COPY.social, links: p.socials } : { text: COPY.noSocial, contact: true };
    case "privacy":
      return p.pages.privacy ? { text: COPY.privacy, links: [p.pages.privacy] } : { text: COPY.noPrivacy, contact: true };
    case "jobs":
      return p.pages.careers ? { text: COPY.jobs, links: [p.pages.careers] } : { text: COPY.noJobs, contact: true };
  }
}

function toDraft(reply: Reply, profile: SiteProfile): Draft {
  switch (reply.kind) {
    case "answer":
      return {
        answer: { heading: reply.section.heading, units: reply.units, url: reply.section.url },
        options: reply.related.slice(0, 6).map(toRef),
        optionsLabel: reply.units.length ? COPY.related : COPY.topics,
      };
    case "unsure":
      return { text: COPY.unsure, options: reply.options.map(toRef), noneOfThese: true };
    case "none":
      return { text: COPY.none, contact: true, callback: true };
    case "intent":
      return intentReply(reply.intent, profile);
  }
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  /** Increments when the visitor opens the chat; focus moves into the panel then. */
  focusSignal: number;
  onClose: (restoreFocus: boolean) => void;
}

export default function ChatPanel({ open, focusSignal, onClose }: Props) {
  const uid = useId();
  // Business details come from the page itself; the crawl adds anything found on other pages.
  const baseProfile = useMemo(() => extractProfile(document, location.href), []);
  const [profile, setProfile] = useState(baseProfile);
  const [messages, setMessages] = useState<Message[]>(() => restoreMessages() ?? [welcome(baseProfile)]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const fullScreen = useMediaQuery(FULL_SCREEN);
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<Promise<SiteSearch | null> | null>(null);
  /** The latest question Bob couldn't answer, passed along with a callback request. */
  const unanswered = useRef<string | undefined>(undefined);

  const getSearch = useCallback(() => {
    searchRef.current ??= loadKnowledgeBase(baseProfile).then((kb) => {
      setProfile(kb.profile);
      if (kb.sections.length) return new SiteSearch(kb);
      searchRef.current = null; // Offline or blocked: try again on the next question.
      return null;
    });
    return searchRef.current;
  }, [baseProfile]);

  // Start building the knowledge base as soon as the panel exists.
  useEffect(() => {
    void getSearch();
  }, [getSearch]);

  useEffect(() => writeChat({ messages: messages.slice(-MAX_MESSAGES) }), [messages]);

  useEffect(() => {
    if (!open || !focusSignal) return;
    if (window.matchMedia(FULL_SCREEN).matches) panelRef.current?.focus();
    else inputRef.current?.focus();
  }, [open, focusSignal]);

  // Full screen, the page behind shouldn't scroll.
  useEffect(() => {
    document.documentElement.classList.toggle("bob-lock", open && fullScreen);
    return () => document.documentElement.classList.remove("bob-lock");
  }, [open, fullScreen]);

  // Keep the newest message in view; a long answer is shown from its start.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !open) return;
    const last = body.querySelector<HTMLElement>(".bob-log > :last-child");
    if (typing || !last || last.offsetHeight < body.clientHeight - 24) body.scrollTop = body.scrollHeight;
    else body.scrollTop = last.offsetTop - 12;
  }, [messages, typing, open]);

  const push = (...items: Omit<Message, "id">[]) =>
    setMessages((prev) => [...prev, ...items.map((m) => ({ ...m, id: newId() }))].slice(-MAX_MESSAGES));

  /** Shows Bob's reply after a short pause. Builders that need the knowledge base wait for it. */
  async function reply(build: Draft | ((search: SiteSearch) => Draft)) {
    setTyping(true);
    if (typeof build === "function") {
      const [search] = await Promise.all([getSearch(), wait(REPLY_DELAY_MS)]);
      setTyping(false);
      push({ from: "bot", ...(search ? build(search) : { text: COPY.offline, contact: true, callback: true }) });
    } else {
      await wait(REPLY_DELAY_MS);
      setTyping(false);
      push({ from: "bot", ...build });
    }
  }

  function ask(question: string) {
    const q = question.trim().slice(0, MAX_QUESTION);
    if (!q) return;
    push({ from: "user", text: q });
    void reply((search) => {
      const r = search.respond(stripGreeting(q));
      if (r.kind === "none" || r.kind === "unsure") unanswered.current = q;
      const out = toDraft(r, search.profile);
      if (out.form) out.form = { question: unanswered.current };
      return out;
    });
  }

  function openSection(ref: SectionRef) {
    push({ from: "user", text: ref.heading });
    void reply((search) => {
      const byId = search.section(ref.id);
      const section =
        byId && byId.heading === ref.heading ? byId : search.sections.find((s) => s.heading === ref.heading && s.url === ref.url);
      return toDraft(section ? search.answerWith(section) : search.respond(ref.heading), search.profile);
    });
  }

  function openTopic(topic: Link) {
    push({ from: "user", text: topic.label });
    void reply((search) => {
      const section = search.sectionAt(topic.href);
      return toDraft(section ? search.answerWith(section) : search.respond(topic.label), search.profile);
    });
  }

  function say(label: string, answer: Draft) {
    push({ from: "user", text: label });
    void reply(answer);
  }

  const requestCallback = () => say("Request a callback", { text: COPY.callback, form: { question: unanswered.current } });

  function markSent(id: string, firstName: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, form: { ...m.form, sentTo: firstName } } : m)));
  }

  function restart() {
    unanswered.current = undefined;
    setMessages([welcome(profile)]);
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(draft);
    setDraft("");
  }

  /** Same-page links scroll to the section (opening its tab if needed); full screen, the chat closes so the page shows. */
  function followLink(e: MouseEvent<HTMLAnchorElement>, href: string, heading?: string) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(href, location.href);
    const covering = window.matchMedia(FULL_SCREEN).matches;
    if (url.origin !== location.origin || url.pathname !== location.pathname) {
      if (covering) onClose(false);
      return;
    }
    e.preventDefault();
    if (covering) onClose(false);
    revealOnPage(decodeURIComponent(url.hash.slice(1)), heading);
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose(true);
      return;
    }
    if (e.key !== "Tab" || !fullScreen || !panelRef.current) return;
    // Full screen, the page behind is covered, so Tab cycles within the chat.
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]')
    ).filter((el) => el.tabIndex >= 0 && !el.closest("[hidden]"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Quick replies: the site's main menu, its FAQ, and contact details.
  const topics = useMemo(() => {
    const list = profile.topics.filter((t) => t.href !== profile.pages.contact?.href).slice(0, 5);
    const faq = profile.pages.faq;
    if (faq && !list.some((t) => t.href === faq.href)) list.push(faq);
    return list;
  }, [profile]);

  const firstPhone = profile.phones[0];
  const firstEmail = profile.emails[0];

  function renderLink(l: Link) {
    const href = safeHref(l.href);
    if (!href) return <span>{l.label}</span>;
    const external = /^https?:/.test(href);
    return (
      <a
        href={href}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : { onClick: (e: MouseEvent<HTMLAnchorElement>) => followLink(e, href) })}
      >
        {l.label}
        {external && <span className="bob-sr"> (opens in a new tab)</span>}
      </a>
    );
  }

  function renderBot(m: Message) {
    const answerHref = m.answer && safeHref(m.answer.url);
    return (
      <>
        <div className="bob-bubble">
          <span className="bob-sr">{ASSISTANT_NAME}: </span>
          {m.text && <p>{m.text}</p>}
          {m.answer && (
            <div className="bob-answer">
              <p className="bob-answer-title">{m.answer.heading}</p>
              {m.answer.units.map((u, i) =>
                u.items ? (
                  <div key={i}>
                    {u.lead && <p>{u.lead}</p>}
                    <ul className={`bob-list${u.items.length > 4 ? " cols" : ""}`}>
                      {u.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p key={i}>{u.text}</p>
                )
              )}
              {answerHref && (
                <a className="bob-more" href={answerHref} onClick={(e) => followLink(e, answerHref, m.answer!.heading)}>
                  {COPY.readMore}
                  <span className="bob-sr"> about {m.answer.heading}</span>
                  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </a>
              )}
            </div>
          )}
          {m.lines && (
            <ul className="bob-lines">
              {m.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
          {m.links && (
            <ul className="bob-lines">
              {m.links.map((l, i) => (
                <li key={i}>{renderLink(l)}</li>
              ))}
            </ul>
          )}
          {m.contact && (
            <ul className="bob-contact">
              {profile.phones.map((p) => (
                <li key={p.href}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                  </svg>
                  <span className="bob-sr">Phone: </span>
                  {renderLink(p)}
                </li>
              ))}
              {profile.emails.map((p) => (
                <li key={p.href}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  <span className="bob-sr">Email: </span>
                  {renderLink(p)}
                </li>
              ))}
              {profile.pages.contact && (
                <li>
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                    <rect x="4" y="5" width="16" height="15" rx="2" />
                    <path d="M4 10h16M9 3v4M15 3v4" />
                  </svg>
                  {renderLink(profile.pages.contact)}
                </li>
              )}
            </ul>
          )}
        </div>

        {!!m.options?.length && (
          <div className="bob-chips" role="group" aria-label={m.optionsLabel ?? COPY.unsure}>
            {m.optionsLabel && <p className="bob-chips-label">{m.optionsLabel}</p>}
            {m.options.map((o) => (
              <button key={o.id} type="button" className="bob-chip" onClick={() => openSection(o)}>
                {o.heading}
              </button>
            ))}
            {m.noneOfThese && (
              <button type="button" className="bob-chip" onClick={() => say(COPY.noneOfThese, { text: COPY.none, contact: true, callback: true })}>
                {COPY.noneOfThese}
              </button>
            )}
          </div>
        )}

        {m.topics && (
          <div className="bob-chips" role="group" aria-label="Suggested topics">
            {topics.map((t) => (
              <button key={t.href} type="button" className="bob-chip" onClick={() => openTopic(t)}>
                {t.label}
              </button>
            ))}
            <button type="button" className="bob-chip" onClick={() => say("Contact", intentReply("contact", profile))}>
              Contact
            </button>
          </div>
        )}

        {m.callback && (
          <button type="button" className="bob-action" onClick={requestCallback}>
            Request a callback
          </button>
        )}

        {m.form &&
          (m.form.sentTo !== undefined ? (
            <div className="bob-bubble bob-done" role="status">
              <b>Thanks, {m.form.sentTo}.</b> Your callback request has been sent to the team.
            </div>
          ) : (
            <CallbackForm
              business={profile.name}
              privacy={profile.pages.privacy}
              phone={firstPhone}
              email={firstEmail}
              question={m.form.question}
              onSent={(name) => markSent(m.id, name)}
              onLink={(e, href) => followLink(e, href)}
            />
          ))}
      </>
    );
  }

  return (
    <section
      ref={panelRef}
      id="bob-panel"
      className="bob-panel"
      role="dialog"
      aria-modal={fullScreen || undefined}
      aria-labelledby={`${uid}-title`}
      aria-describedby={`${uid}-sub`}
      hidden={!open}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="bob-head">
        {profile.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bob-logo" src={profile.logo} alt={profile.name} />
        )}
        <div className="bob-id">
          <h2 id={`${uid}-title`}>{ASSISTANT_NAME}</h2>
          <p id={`${uid}-sub`}>Assistant for {profile.acronym ?? profile.name}</p>
        </div>
        <button type="button" className="bob-icon-btn" onClick={restart} aria-label="Start a new conversation" title="Start over">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
            <path d="M4 3.5v5h5" />
          </svg>
        </button>
        <button type="button" className="bob-icon-btn" onClick={() => onClose(true)} aria-label="Close chat" title="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="bob-body" ref={bodyRef}>
        <div className="bob-log" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((m) =>
            m.from === "user" ? (
              <div key={m.id} className="bob-msg from-user">
                <div className="bob-bubble">
                  <span className="bob-sr">You: </span>
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="bob-msg from-bot">
                {profile.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="bob-avatar" src={profile.icon} alt="" />
                ) : (
                  <span className="bob-avatar" aria-hidden="true" />
                )}
                <div className="bob-stack">{renderBot(m)}</div>
              </div>
            )
          )}
        </div>
        {typing && (
          <div className="bob-typing" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>

      <div className="bob-foot">
        <form className="bob-ask" onSubmit={onSubmit}>
          <label className="bob-sr" htmlFor={`${uid}-q`}>
            Ask {ASSISTANT_NAME} a question
          </label>
          <input
            ref={inputRef}
            id={`${uid}-q`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            maxLength={MAX_QUESTION}
            enterKeyHint="send"
            placeholder="Type your question…"
          />
          <button type="submit" className="bob-send" aria-label="Send">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h13M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
        <p className="bob-note">{COPY.footnote}</p>
      </div>
    </section>
  );
}
