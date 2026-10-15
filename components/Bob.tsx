"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { BobEvent } from "@/app/api/bob/route";
import {
  AFTER_SENT,
  BOB,
  CANCEL_RE,
  FLOWS,
  MENU,
  NEXT,
  RETRY,
  SKIP,
  TOPICS,
  leadMailto,
  matchFlow,
  matchTopic,
  readAnswer,
  type BobChoice,
  type FlowStep,
  type Lead,
} from "@/lib/bob-script";
import { CONTACT } from "@/lib/content";
import { announceLead, onOpenBob, openBob, type BobFlowKey, type BobRequest } from "@/lib/events";

interface ChatMessage {
  from: "bot" | "user";
  text: string;
  /** Sent to Claude as conversation context. Flow answers (names, emails, phone numbers) never are. */
  ai?: boolean;
  error?: boolean;
  /** A link shown under the text, e.g. the pre-filled email when a request couldn't be sent. */
  link?: { href: string; label: string };
}

interface FlowState {
  key: BobFlowKey;
  /** The question being asked. Equals the number of steps once the details are being sent. */
  step: number;
  lead: Lead;
}

type ClaudeOutcome = "ok" | "refusal" | "off" | "failed";

const TEASER_SEEN = "bob-teaser-seen";
const GREETING: ChatMessage = { from: "bot", text: BOB.greeting };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Bob "types" for longer when it has more to say. */
const typingTime = (text: string) => 420 + Math.min(700, text.length * 2);

/** A flow question's quick replies: its options, plus Skip when it is optional. */
function choicesFor(step: FlowStep): BobChoice[] {
  const options: BobChoice[] = (step.options ?? []).map((value) => ({ label: value, action: { type: "pick", value } }));
  return step.optional ? [...options, SKIP] : options;
}

/** Reads or sets a per-tab flag. Storage can be blocked (private windows), in which case the teaser just shows again. */
function sessionFlag(key: string, set = false) {
  try {
    if (set) sessionStorage.setItem(key, "1");
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// **bold**, [label](#section), and BBO's email address and phone number.
const RICH_RE = new RegExp(
  `\\*\\*(.+?)\\*\\*|\\[([^\\]]+)\\]\\((#[\\w-]+)\\)|(${escapeRe(CONTACT.email)})|(${escapeRe(CONTACT.phone)})`,
  "g"
);

/** Renders Bob's message text. Only in-page, mailto, and tel links are possible, so replies can't link elsewhere. */
function rich(text: string, onSectionLink: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(RICH_RE)) {
    const at = m.index ?? 0;
    out.push(text.slice(last, at));
    if (m[1]) out.push(<b key={at}>{m[1]}</b>);
    else if (m[2])
      out.push(
        <a key={at} href={m[3]} onClick={onSectionLink}>
          {m[2]}
        </a>
      );
    else if (m[4])
      out.push(
        <a key={at} href={`mailto:${CONTACT.email}`}>
          {m[4]}
        </a>
      );
    else
      out.push(
        <a key={at} href={CONTACT.phoneHref}>
          {m[5]}
        </a>
      );
    last = at + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

/** Reads the newline-delimited JSON events streamed by /api/bob. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<BobEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as BobEvent;
  }
}

function Avatar() {
  return (
    <span className="bob-avatar" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/bob-avatar.webp" alt="" width={112} height={85} />
    </span>
  );
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

/**
 * Bob, the site's chat assistant: a teaser, a launcher, and a chat panel with quick replies, ready-made answers,
 * and two guided flows that send a visitor's details to the team. Open it from anywhere with openBob() or window.BobChat.
 */
export default function Bob() {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [choices, setChoices] = useState<BobChoice[]>(MENU);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const busyRef = useRef(false);
  const claudeOn = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const restoreFocus = useRef(false);
  const focusAfterReply = useRef(false);
  const openRef = useRef<(request?: BobRequest) => void>(() => {});
  const launchRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const choicesRef = useRef<HTMLDivElement>(null);

  const step = flow ? FLOWS[flow.key].steps[flow.step] : undefined;

  // Stop a reply that is still streaming if the page goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  // The teaser appears once per browser session, a few seconds after the page loads.
  useEffect(() => {
    if (sessionFlag(TEASER_SEEN)) return;
    const timer = setTimeout(() => {
      if (!sessionFlag(TEASER_SEEN)) setTeaser(true);
    }, BOB.teaserDelay);
    return () => clearTimeout(timer);
  }, []);

  // Page buttons call openBob() (lib/events.ts); plain HTML and tag managers can use window.BobChat.
  useEffect(() => {
    openRef.current = openChat;
  });
  useEffect(() => {
    const stop = onOpenBob((request) => openRef.current(request));
    window.BobChat = {
      open: () => openBob(),
      startEvaluation: (prefill) => openBob({ flow: "evaluation", prefill }),
      startCallback: () => openBob({ flow: "callback" }),
    };
    return () => {
      stop();
      delete window.BobChat;
    };
  }, []);

  useEffect(() => {
    if (open && !busyRef.current) focusNext();
    else if (!open && restoreFocus.current) launchRef.current?.focus();
    restoreFocus.current = false;
  }, [open]);

  // A picked quick reply disappears with its button, so move focus on once Bob has answered.
  useEffect(() => {
    if (busy || !focusAfterReply.current) return;
    focusAfterReply.current = false;
    focusNext();
  }, [busy]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, choices, typing, open]);

  /** Focuses the first quick reply, or the text box when Bob is waiting for typed text. */
  function focusNext() {
    (choicesRef.current?.querySelector("button") ?? inputRef.current)?.focus();
  }

  function openChat(request: BobRequest = {}) {
    setOpen(true);
    hideTeaser();
    if (request.flow) {
      const { flow: key, prefill } = request;
      act({ label: FLOWS[key].label, action: { type: "flow", flow: key, prefill } }, true);
    }
  }

  function hideTeaser() {
    setTeaser(false);
    sessionFlag(TEASER_SEEN, true);
  }

  function close() {
    restoreFocus.current = true;
    setOpen(false);
  }

  /** On phones the panel covers the page, so following a link to a section closes it. */
  function onSectionLink() {
    if (window.matchMedia("(max-width: 560px)").matches) setOpen(false);
  }

  function restart() {
    if (busyRef.current) return;
    setFlow(null);
    setMessages([GREETING]);
    setChoices(MENU);
  }

  /** Runs one exchange at a time. Clicks and messages that arrive meanwhile are ignored. */
  async function exclusive(task: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const push = (message: ChatMessage) => setMessages((all) => [...all, message]);

  /** Bob types each message for a moment, then offers the next quick replies. */
  async function say(texts: string[], next: BobChoice[] = [], extra: Partial<ChatMessage> = {}) {
    setChoices([]);
    for (const text of texts) {
      setTyping(true);
      await pause(typingTime(text));
      setTyping(false);
      push({ from: "bot", text, ...extra });
    }
    setChoices(next);
  }

  /** Handles a quick reply. */
  function act(choice: BobChoice, moveFocus = false) {
    if (moveFocus) focusAfterReply.current = true;
    const { action } = choice;
    exclusive(async () => {
      push({ from: "user", text: choice.label, ai: action.type === "topic" || action.type === "menu" });
      switch (action.type) {
        case "menu":
          setFlow(null);
          return say([BOB.menu], MENU);
        case "topic": {
          setFlow(null);
          const { answer, choices: next = NEXT } = TOPICS[action.topic];
          return say(answer, next, { ai: true });
        }
        case "flow":
          return ask({ key: action.flow, step: 0, lead: { ...action.prefill } }, [FLOWS[action.flow].intro]);
        case "pick":
          return answer(action.value);
        case "skip":
          return answer("");
        case "retry":
          return flow ? submit(flow) : say([BOB.menu], MENU);
      }
    });
  }

  /** Asks the flow's next unanswered question, or sends the details once every question is answered. */
  async function ask(state: FlowState, before: string[] = []) {
    const { steps } = FLOWS[state.key];
    let i = state.step;
    // Answers passed in with openBob({ prefill }) skip their questions.
    while (i < steps.length && state.lead[steps[i].field] !== undefined) i++;
    const next = { ...state, step: i };
    setFlow(next);
    if (i === steps.length) {
      if (before.length) await say(before);
      return submit(next);
    }
    await say([...before, steps[i].ask(next.lead)], choicesFor(steps[i]));
  }

  async function answer(value: string) {
    if (!flow) return;
    const s = FLOWS[flow.key].steps[flow.step];
    if (s.stop !== undefined && value === s.stop) {
      setFlow(null);
      return say([BOB.notSent], MENU);
    }
    const reply = value ? s.reply?.(value) : undefined;
    await ask({ ...flow, step: flow.step + 1, lead: { ...flow.lead, [s.field]: value } }, reply ? [reply] : []);
  }

  /** Sends the visitor's details through the consultation form's endpoint, which emails the team. */
  async function submit(state: FlowState) {
    const { lead } = state;
    const def = FLOWS[state.key];
    setChoices([]);
    setTyping(true);
    let sent = false;
    try {
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name,
          company: lead.company,
          email: lead.email,
          phone: lead.phone,
          service: lead.service,
          size: lead.size,
          message: def.note(lead),
        }),
      });
      sent = res.ok;
    } catch (err) {
      console.warn("Bob could not send the request.", err);
    }
    setTyping(false);
    if (!sent) {
      return say([BOB.sendFailed], RETRY, { error: true, link: { href: leadMailto(def, lead), label: BOB.emailLink } });
    }
    setFlow(null);
    announceLead({ flow: state.key, service: lead.service, size: lead.size });
    await say([def.done(lead)], AFTER_SENT);
  }

  /** Handles typed text: an answer to the flow's current question, a request to start a flow, or a question. */
  function onSend(raw: string) {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "";
    exclusive(async () => {
      if (flow && step) {
        if (CANCEL_RE.test(text)) {
          push({ from: "user", text });
          setFlow(null);
          return say([BOB.cancelled], MENU);
        }
        // Typed text answers the current question, unless it is a question itself.
        if (!text.endsWith("?")) {
          const value = readAnswer(step, text);
          if (value !== undefined) {
            push({ from: "user", text });
            const problem = value ? step.check?.(value) : undefined;
            if (problem) return say([problem], choicesFor(step));
            return answer(value);
          }
          // Not one of the options, and nothing Bob can answer either.
          if (!matchTopic(text)) {
            push({ from: "user", text });
            return say([BOB.pickOption], choicesFor(step));
          }
        }
        push({ from: "user", text, ai: true });
        await answerQuestion(text);
        // Then pick the flow back up where it was.
        return ask(flow);
      }
      push({ from: "user", text, ai: true });
      const start = matchFlow(text);
      if (start) return ask({ key: start, step: 0, lead: {} }, [FLOWS[start].intro]);
      await answerQuestion(text);
    });
  }

  /** Answers from the script when the keywords match, then from Claude (if set up), then by offering the team. */
  async function answerQuestion(question: string) {
    const topic = matchTopic(question);
    if (!topic && claudeOn.current) {
      const outcome = await askClaude(question);
      if (outcome === "ok") return setChoices(NEXT);
      if (outcome === "refusal") return say([BOB.declined], NEXT, { error: true });
      if (outcome === "off") claudeOn.current = false;
    }
    const { answer, choices: next = NEXT } = TOPICS[topic ?? "unsure"];
    await say(answer, next, { ai: true });
  }

  /** Streams Claude's answer into a new message. A reply that doesn't finish is removed. */
  async function askClaude(question: string): Promise<ClaudeOutcome> {
    const history = [...messages.filter((m) => m.ai), { from: "user", text: question }].map((m) => ({
      role: m.from === "user" ? "user" : "assistant",
      content: m.text,
    }));
    const controller = new AbortController();
    abortRef.current = controller;
    setChoices([]);
    setTyping(true);
    let reply = "";
    let outcome: BobEvent["type"] = "error";
    try {
      const res = await fetch("/api/bob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      // 503 means AI answers aren't set up. Anything else (rate limit, outage) falls back to the script for this question.
      if (res.status === 503) return "off";
      if (!res.ok || !res.body) return "failed";
      for await (const event of readEvents(res.body)) {
        if (event.type !== "text") {
          outcome = event.type;
          continue;
        }
        const started = reply !== "";
        reply += event.text;
        const message: ChatMessage = { from: "bot", text: reply, ai: true };
        setTyping(false);
        setMessages((m) => (started ? [...m.slice(0, -1), message] : [...m, message]));
      }
    } catch (err) {
      if (!controller.signal.aborted) console.warn("Bob could not reach Claude.", err);
    } finally {
      setTyping(false);
    }
    if (outcome === "done" && reply.trim()) return "ok";
    if (reply) setMessages((m) => m.slice(0, -1));
    return outcome === "refusal" ? "refusal" : "failed";
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSend(input);
  }

  function onInputKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter starts a new line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend(input);
    }
  }

  function onInputChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Grow with the text, up to the max-height set in CSS.
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }

  return (
    <>
      {teaser && !open && (
        <div className="bob-teaser">
          <button type="button" className="bob-teaser-text" onClick={() => openChat()}>
            {BOB.teaser}
          </button>
          <button type="button" className="bob-teaser-close" aria-label="Dismiss" onClick={hideTeaser}>
            <CloseIcon />
          </button>
        </div>
      )}

      <button
        ref={launchRef}
        type="button"
        className="bob-launch"
        hidden={open}
        aria-expanded={open}
        aria-controls="bob-panel"
        onClick={() => openChat()}
      >
        <Avatar />
        Ask Bob
      </button>

      <div
        className="bob-panel"
        id="bob-panel"
        role="dialog"
        aria-labelledby="bob-title"
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <div className="bob-head">
          <Avatar />
          <div>
            <h2 id="bob-title">Bob</h2>
            <p>Beyond Borders virtual assistant</p>
          </div>
          <div className="bob-actions">
            <button type="button" className="bob-icon" aria-label="Start over" title="Start over" disabled={busy} onClick={restart}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button type="button" className="bob-icon" aria-label="Close chat" onClick={close}>
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="bob-scroll" ref={scrollRef}>
          <div className="bob-log" role="log" aria-live="polite" aria-busy={busy}>
            {messages.map((m, i) => (
              <p key={i} className={`bob-msg ${m.from === "user" ? "user" : "bot"}${m.error ? " err" : ""}`}>
                {m.from === "bot" ? rich(m.text, onSectionLink) : m.text}
                {m.link && (
                  <a className="bob-link" href={m.link.href}>
                    {m.link.label}
                  </a>
                )}
              </p>
            ))}
            {typing && (
              <p className="bob-msg bot" aria-hidden="true">
                <span className="bob-typing">
                  <i />
                  <i />
                  <i />
                </span>
              </p>
            )}
          </div>
          {choices.length > 0 && (
            <div className="bob-choices" role="group" aria-label="Quick replies" ref={choicesRef}>
              {choices.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={c.action.type === "flow" ? "lead" : undefined}
                  disabled={busy}
                  onClick={() => act(c, true)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <form className="bob-form" onSubmit={onSubmit}>
          <textarea
            ref={inputRef}
            rows={1}
            maxLength={1000}
            placeholder={step?.input?.placeholder ?? (step?.options ? BOB.choosePlaceholder : BOB.placeholder)}
            inputMode={step?.input?.inputMode}
            autoComplete={step?.input?.autoComplete ?? "off"}
            aria-label="Message Bob"
            value={input}
            onChange={onInputChange}
            onKeyDown={onInputKey}
          />
          <button type="submit" className="bob-send" aria-label="Send" disabled={busy || !input.trim()}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 12h14M13 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
        <p className="bob-foot">{BOB.disclaimer}</p>
      </div>
    </>
  );
}
