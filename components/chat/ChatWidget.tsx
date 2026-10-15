"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ASSISTANT_NAME } from "@/lib/chatbot/config";
import { readChat, writeChat } from "@/lib/chatbot/session";

// The panel, search engine and knowledge base load on first use, so the page itself only ships this button.
const loadPanel = () => import("./ChatPanel");
const ChatPanel = dynamic(loadPanel, { ssr: false });

/** Floating chat button (bottom right) that opens the site assistant. */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Changes each time the visitor opens the chat, so the panel moves focus into itself then
  // (and not when it reopens by itself on the next page).
  const [focusSignal, setFocusSignal] = useState(0);
  const launcher = useRef<HTMLButtonElement>(null);

  // Keep the chat open across page loads if the visitor left it open.
  useEffect(() => {
    if (readChat()?.open) {
      setLoaded(true);
      setOpen(true);
    }
  }, []);

  const toggle = useCallback((next: boolean, restoreFocus = true) => {
    setOpen(next);
    writeChat({ open: next });
    if (next) {
      setLoaded(true);
      setFocusSignal((n) => n + 1);
    } else if (restoreFocus) launcher.current?.focus();
  }, []);

  const label = open ? `Close chat with ${ASSISTANT_NAME}` : `Chat with ${ASSISTANT_NAME}, the site assistant`;

  return (
    <div className={`bob${open ? " is-open" : ""}`} data-chatbot-ignore>
      {loaded && <ChatPanel open={open} focusSignal={focusSignal} onClose={(restoreFocus) => toggle(false, restoreFocus)} />}
      <button
        ref={launcher}
        type="button"
        className="bob-launcher"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={loaded ? "bob-panel" : undefined}
        onClick={() => toggle(!open)}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
      >
        {open ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
            <path d="M8.5 9.5h.01M12 9.5h.01M15.5 9.5h.01" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
