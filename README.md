# Beyond Borders Outsourcing — Website

The marketing website for **Beyond Borders Outsourcing Services Inc. (BBO)**. BBO builds dedicated offshore teams in the Philippines for customer experience, hotel and hospitality, sales, and back-office support.

> *Innovation Without Borders.* · *Your Business. Our People. One Team.*

The site is a single scrolling page. It explains what BBO does, how working with BBO goes, and why to choose it, and it ends with a form for booking a consultation.

---

## Contents

- [Page overview](#page-overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Editing content](#editing-content)
- [Styling and branding](#styling-and-branding)
- [Consultation form](#consultation-form)
- [Chat assistant (Bob)](#chat-assistant-bob)
- [Accessibility and performance](#accessibility-and-performance)
- [Deployment](#deployment)
- [Before going live](#before-going-live)

---

## Page overview

The sections below appear from top to bottom. The links in the header and footer jump to the ones that have an anchor.

| # | Section | Anchor | What it says |
|---|---------|--------|--------------|
| 1 | **Hero** | `#top` | "Build beyond borders. Grow without limits." over an aurora gradient. A canvas globe links the Manila hub to six markets, each tagged with a core service, plus a strip of four service links. |
| 2 | **Before you hire** | — | Growth creates pressure, and adding staff adds overhead. BBO offers another way to grow. |
| 3 | **The BBO Difference / Why BBO** | `#why-bbo` | "BBO does not sell seats." plus five reasons to choose BBO. |
| 4 | **Core Services** | `#services` | Six services in a tabbed panel. Service links anywhere on the page open the matching tab. |
| 5 | **Team sizer** | — | A slider from one person to an entire department. |
| 6 | **How It Works** | `#how-it-works` | Six steps: Discover → Design → Build → Integrate → Perform → Scale. |
| 7 | **The Business Case** | `#business-case` | An "iceberg" of the hidden costs below salary. |
| 8 | **Why the Philippines** | `#philippines` | Workforce skills and a live clock board from Manila to client markets. |
| 9 | **Promise, Mission & Vision** | `#mission` | Four promises, mission and vision. |
| 10 | **Values** | — | Accountability, Service, People, Partnership, Performance. |
| 11 | **Who We Serve** | — | Twelve industries. |
| 12 | **About BBO** | `#about` | The company story and its focus on long-term partnership. |
| 13 | **FAQs** | `#faq` | What is outsourcing, how pricing works, what BPO and an SLA are. |
| 14 | **Talk to BBO** | `#consultation` | The final call to action, contact details, and the consultation form. |
| 15 | **Footer** | — | Logo, contact details, and links to services and company pages. |

**Contact details shown on the site:** +1 213 597 1200 · info@beyondborders.ph

---

## Features

- **Interactive canvas globe.** Dotted landmasses, a pulsing hub over Manila, and animated arcs to Los Angeles, New York, London, Dubai, Singapore, and Sydney. Each market carries a clickable service tag. Visitors can drag (or use the arrow keys) to spin it, and it pauses when off screen.
- **Tabbed services** with keyboard support. "Ask about…" buttons and the team sizer prefill the consultation form.
- **Team sizer** slider, **live time-zone board**, and a cost "iceberg".
- **Responsive layout** with a mobile menu, from 360 px phones up to wide desktops.
- **Consultation form** with inline validation, a honeypot spam field, and a thank-you message.
- **Chat assistant ("Bob")** in the bottom-right corner that answers questions from the site's own content, with no AI service involved. See [Chat assistant (Bob)](#chat-assistant-bob).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| UI | React 19 + TypeScript |
| Globe | Plain 2D canvas, no dependencies |
| Styling | Plain CSS with custom properties (`app/globals.css`) |
| Fonts | Sora (headings) and Manrope (body) via `next/font/google`, self-hosted at build time |
| Rendering | The page is static (pre-rendered). Only the form endpoint runs on the server. |
| Email | [Nodemailer](https://nodemailer.com) sends consultation requests over SMTP |

---

## Getting started

**Requirements:** Node.js 20.9 or newer.

```bash
npm install
npm run dev            # http://localhost:3000
```

Production build:

```bash
npm run build
npm start              # serves the production build on port 3000
```

---

## Project structure

```
bbo-next/
├── app/
│   ├── layout.tsx                 # <html>, metadata (title/description), fonts
│   ├── page.tsx                   # Puts the sections together in order
│   ├── globals.css                # Entire site stylesheet
│   ├── icon.png                   # Favicon (BBO mark on a dark tile)
│   ├── api/consultation/route.ts  # Form submission endpoint
│   └── api/callback/route.ts      # Chat "Request a callback" endpoint
├── components/
│   ├── chat/
│   │   ├── ChatWidget.tsx         # Floating chat button; loads the panel on first use
│   │   ├── ChatPanel.tsx          # Chat panel: messages, quick replies, answers
│   │   └── CallbackForm.tsx       # Name, email, phone and consent form in the chat
│   ├── Header.tsx                 # Fixed header, nav, mobile menu
│   ├── Logo.tsx                   # Logo image (header, footer)
│   ├── Globe.tsx                  # Canvas hero globe + service tags
│   ├── ServiceTabs.tsx            # Tabbed core services
│   ├── TeamSizer.tsx              # Team size slider
│   ├── ClockBoard.tsx             # Live time-zone board
│   ├── SvcLink.tsx                # Link that opens a service tab
│   ├── ConsultForm.tsx            # Consultation form (client component)
│   └── sections/
│       ├── Hero.tsx
│       ├── Intro.tsx              # Before you hire · Difference · Why BBO
│       ├── Services.tsx           # Core services · Team sizer · How it works
│       ├── Approach.tsx           # Business case · Philippines
│       ├── Company.tsx            # Promise/Mission · Values · Industries · About · FAQ
│       └── Contact.tsx            # Final call to action + Footer
├── lib/
│   ├── content.ts                 # ★ All editable site copy
│   ├── events.ts                  # Service-tab / form-prefill signals between components
│   ├── land-mask.ts               # Packed land bitmap for the globe
│   ├── mailer.ts                  # Sends form and callback emails over SMTP
│   └── chatbot/
│       ├── config.ts              # ★ Assistant name and its own lines
│       ├── kb.ts                  # Builds the knowledge base and business details from the pages
│       ├── search.ts              # Keyword matching, synonyms, intents, confidence rules
│       ├── text.ts                # Tokenizer, stemmer, typo distance, sentence splitter
│       └── session.ts             # Keeps the conversation while the visitor browses
└── public/images/
    ├── bbo-logo-{300,400,664}.avif  # Full logo at three widths (header, footer)
    ├── bbo-logo.webp              # Full logo for browsers without AVIF
    └── bbo-mark.webp              # BBO mark (globe and B)
```

---

## Editing content

Most text changes happen in **`lib/content.ts`**, with no layout code to touch:

| To change… | Edit in `lib/content.ts` |
|------------|--------------------------|
| Services, checklists, and button labels | `SERVICES`, `HERO_STRIP` |
| How It Works steps | `STEPS` |
| Values | `VALUES` |
| Industries served | `INDUSTRIES` |
| FAQs | `FAQS` |
| Hidden cost layers | `COST_LAYERS` |
| Clock board cities | `CLOCK_ZONES` |
| Phone and email | `CONTACT` |
| Form dropdown options | `SERVICES[].option`, `TEAM_SIZE_OPTIONS` |
| Nav and footer links | `NAV`, `FOOTER_COMPANY` |

Longer paragraphs, such as the hero copy and the About story, are written directly in the matching file in `components/sections/`.

Edit the **page title and description** (for search engines and link previews) in `app/layout.tsx` under `metadata`.

To **replace the logo**, replace the `bbo-logo` files in `public/images/` (and `app/icon.png`) and keep the same names and widths. The logo needs a transparent background and is designed for the site's dark header and footer. If the image proportions change, update `width` and `height` in `components/Logo.tsx` and the `3.02` width-to-height ratio in `app/globals.css`.

---

## Styling and branding

All colors, gradients, fonts, and spacing are CSS variables at the top of `app/globals.css`:

| Variable | Value | Use |
|----------|-------|-----|
| `--ink` / `--ink-deep` | `#0B0A2A` / `#070619` | Dark sections and headings |
| `--blue`, `--violet`, `--pink`, `--cyan`, `--gold` | brand accents | Highlights, markers, borders |
| `--grad` | blue → violet → pink | Primary buttons and accents |
| `--grad-light` | cyan → lilac → pink | Gradient headline text |
| `--grad-warm` | pink → orange → gold | "Schedule a consultation" buttons |
| `--mist` | `#F6F5FF` | Light section background |

The globe's colors are set in `components/Globe.tsx`.

---

## Consultation form

- **Fields:** full name\*, company\*, work email\*, phone, area of support, team size, and a message (\* = required).
- **Validation** runs in the browser (`ConsultForm.tsx`) and again on the server (`app/api/consultation/route.ts`).
- **On success**, the form is replaced with a "Thank you, *Name*" message.
- **Delivery:** each submission is emailed to the team over SMTP with [Nodemailer](https://nodemailer.com). The email's reply-to is the visitor's address, so replying goes straight to them.

### Email setup (Nodemailer / SMTP)

1. Get SMTP credentials for the mailbox that will send the emails (for example from Google Workspace, Microsoft 365, or your hosting provider). With Google Workspace, use an app password rather than the account password.
2. Copy `.env.example` to `.env.local` and fill in:

   | Variable | Purpose |
   |----------|---------|
   | `SMTP_HOST` | SMTP server, for example `smtp.gmail.com` |
   | `SMTP_PORT` | `465` (TLS, the default) or `587` (STARTTLS) |
   | `SMTP_USER` | SMTP username, usually the sending mailbox |
   | `SMTP_PASS` | SMTP password or app password |
   | `CONSULTATION_TO_EMAIL` | Inbox that receives requests. Separate several addresses with commas. |
   | `CONSULTATION_FROM_EMAIL` | Sender, for example `Beyond Borders Website <website@beyondborders.ph>`. Most providers require it to match `SMTP_USER`. |

3. On your host (for example Vercel), add the same variables to the project's environment settings.

If these aren't set, development (`npm run dev`) logs submissions to the console instead of sending them. In production the endpoint returns an error so leads aren't lost without anyone noticing.

---

## Chat assistant (Bob)

Bob is a rule-based assistant. It uses no AI model and no external service. Every answer is a sentence or list copied from the site's own pages, with a "Read more" link to where it appears.

### How it works

1. **Knowledge base.** When a visitor first opens the chat, the browser fetches the home page (and any other same-origin pages it links to, up to 30), splits the content at its headings (`h1`–`h6`, plus FAQ `<summary>` questions), and stores each section's heading, text, and link. The result is cached for the browser session. Nothing is built at deploy time, so the knowledge base always matches the live pages.
2. **Business details.** The name, logo, icon, phone, email, address, opening hours, social links, and key pages (about, services, pricing, FAQ, contact, privacy, careers) are read from the page markup: the header logo, `tel:` and `mailto:` links, header and footer links, and any JSON-LD `Organization` block. Colours and fonts come from the CSS variables in `globals.css`.
3. **Matching.** A question is reduced to keywords and scored against every section (BM25 weighting, with extra weight for headings and menu labels). Word variations are handled by stemming ("pricing" = "price"), typos by edit distance ("pirce" → "price"), and synonyms by the list in `lib/chatbot/search.ts` ("cost" ≈ "price").
4. **Replies.**
   - A confident match shows the 1–3 most relevant sentences from the best section, plus "Read more".
   - A close call shows "Did you mean…?" buttons.
   - No match, or a question whose keywords mostly aren't on the site, shows the contact details and a "Request a callback" button.
   - Questions about phone, email, hours, address, social media, privacy, or jobs are answered from the business details. When the site doesn't list something (for example opening hours), Bob says so instead of guessing.

All page text is rendered as plain text (React escapes it), never as HTML. Links are limited to same-origin paths, `http(s)`, `tel:`, and `mailto:`.

### Editing Bob

| To change… | Edit |
|------------|------|
| The assistant's name, welcome line, and other replies | `lib/chatbot/config.ts` |
| Synonyms, phrase rewrites, and confidence thresholds | `lib/chatbot/search.ts` (`SYNONYM_GROUPS`, `REWRITES`, `ANSWER_SCORE`…) |
| What Bob knows | The page content itself. Bob picks up edits automatically. |
| Content Bob should ignore | Add `data-chatbot-ignore` to the element (used on the live clock board) |
| Chat styles | The "chat assistant (Bob)" block at the end of `app/globals.css` |

The site doesn't currently list an address, opening hours, social profiles, a pricing page, or a privacy policy page, so Bob says these aren't listed. To change that:
- Add a JSON-LD `Organization` block in `app/layout.tsx` with `address`, `openingHours`, and `sameAs`, or add the links to the header or footer.
- Once a page with "Privacy" in its link appears, the callback form's consent checkbox links to it automatically.

Section ids help Bob: a section's `id` (for example `id="industries"`) is used both as a search keyword and as the "Read more" anchor.

### Callback requests

The callback form (name, email, phone, consent) posts to `/api/callback`, which emails the request through the same SMTP settings as the consultation form (see [Email setup](#email-setup-nodemailer--smtp)). The email includes the question the visitor couldn't get answered and the page they were on.

### Behaviour

- Floating button in the bottom-right corner; on phones (and short screens) the chat fills the screen.
- Fully keyboard accessible: Enter opens it, Escape closes it and returns focus to the button, and Tab stays inside the chat while it fills the screen. Messages are announced to screen readers.
- The conversation is kept in `sessionStorage`, so it survives navigating between pages and reloading until the tab is closed. "Start over" in the chat header clears it.
- Only the button ships with the page. The panel and search code load when the chat is first opened (or the button is hovered or focused).

---

## Accessibility and performance

- Semantic landmarks (`header`, `nav`, `main`, `footer`), and every section is labelled by its heading.
- Keyboard focus is visible, and the mobile menu exposes `aria-expanded`.
- Decorative animations are hidden from screen readers. The globe has a text label, and its service tags are real links.
- Respects **`prefers-reduced-motion`**: animations stop and content shows in its final state.
- The globe and canvas animations pause when they're off screen, and they clean up when unmounted.
- Fonts are downloaded at build time and served from the site, so visitors don't request Google Fonts.

---

## Deployment

The project works on **[Vercel](https://vercel.com)** without extra configuration:

```bash
npx vercel deploy
```

It also runs on any Node.js host (`npm run build && npm start`), or on platforms such as Netlify, Render, or Railway.

---

## Before going live

- [ ] **Configure SMTP.** Set the `SMTP_*`, `CONSULTATION_TO_EMAIL`, and `CONSULTATION_FROM_EMAIL` variables on the host (see [Email setup](#email-setup-nodemailer--smtp)). Send a test submission after deploying.
- [ ] Consider stronger spam protection (for example Cloudflare Turnstile). The form already has a honeypot field.
- [ ] Confirm the phone number and email in `lib/content.ts`.
- [ ] Set the production domain and add an Open Graph image for link previews (`app/layout.tsx`).
- [ ] Add analytics if needed (for example Vercel Analytics or Google Analytics).
- [ ] Add privacy policy and terms pages if they're required where you operate. Link the privacy page from the footer so the chat's consent checkbox links to it.
- [ ] Send a test callback request from the chat after deploying.

---

© Beyond Borders Outsourcing Services Inc. Fonts: Sora and Manrope, both under the SIL Open Font License.
