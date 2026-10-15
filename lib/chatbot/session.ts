// The conversation lives in sessionStorage, so it follows the visitor from page to page
// (and survives a reload) until the browser tab is closed.

const KEY = "bob:chat:v1";

export interface ChatSession {
  open: boolean;
  /** Raw stored messages; the panel validates them before use. */
  messages: unknown[];
}

export function readChat(): ChatSession | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (!v || typeof v !== "object") return null;
    return { open: v.open === true, messages: Array.isArray(v.messages) ? v.messages : [] };
  } catch {
    return null;
  }
}

export function writeChat(patch: Partial<ChatSession>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...(readChat() ?? { open: false, messages: [] }), ...patch }));
  } catch {
    /* Storage unavailable (private mode, quota): the chat still works on this page. */
  }
}
