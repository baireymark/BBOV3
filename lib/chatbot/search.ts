// Rule-based question answering over the knowledge base: no AI and no external service.
// A question is matched by keyword scoring (BM25 with field weights) that forgives typos,
// understands synonyms and word variations (stemming), and only answers when it is confident.

import { ASSISTANT_NAME } from "./config";
import type { KbSection, KnowledgeBase, SiteProfile, Unit } from "./kb";
import { QUERY_FILLER, STOPWORDS, allowedEdits, contentWords, editDistance, normalize, stem, words } from "./text";

// ---------------------------------------------------------------------------
// Vocabulary

/** Words that mean the same thing for this kind of site. A synonym counts for less than the exact word. */
const SYNONYM_GROUPS = [
  "price prices pricing cost costs fee fees rate rates quote quotes quotation charge charges budget expensive cheap affordable afford plans",
  "contact reach touch",
  "phone telephone call calls calling",
  "email mail inbox",
  "hire hiring recruit recruiting recruitment staff staffing employ employee employees workers personnel headcount",
  "outsource outsourcing outsourced offshore offshoring bpo",
  "team teams people professionals staff agents talent workforce workers",
  "customer customers client clients consumer consumers",
  "support service services help assistance care helpdesk",
  "hotel hotels hospitality resort resorts motel lodging accommodation vacation rentals airbnb",
  "reservation reservations booking bookings book reserve",
  "sales sell selling leads prospecting prospects pipeline telemarketing outbound",
  "appointment appointments meeting meetings scheduling calendar",
  "admin administrative administration clerical backoffice paperwork",
  "data database databases records spreadsheet spreadsheets",
  "technical tech helpdesk troubleshooting",
  "custom customized customised customize tailored bespoke personalized",
  "start begin started onboarding onboard process steps step setup",
  "grow growth scale scaling expand expansion",
  "save saving savings cheaper efficiency efficient reduce lower",
  "location located based address headquarters hq",
  "philippines filipino filipinos philippine",
  "language languages multilingual bilingual",
  "industry industries sector sectors vertical verticals",
  "ecommerce shop shops store stores shopify",
  "healthcare health medical clinic clinics dental",
  "property properties realty realtor",
  "finance financial bank banking fintech",
  "faq faqs questions",
  "company history story founded background",
  "mission vision purpose",
  "values principles beliefs culture",
  "advantages advantage reasons difference different",
  "sla slas agreement guarantee kpi kpis metrics",
  "quality qa standards standard",
  "training train trained",
  "consultation consult discovery",
  "chat livechat messaging",
  "complaint complaints escalation escalations",
  "crm crms",
];

/** Phrases rewritten before matching, so two-word ideas match as one ("how much" means price). */
const REWRITES: [RegExp, string][] = [
  [/\bhow much\b/g, "price"],
  [/\b(does|do|will|would) (it|this|that|you|outsourcing|a team) cost\b/g, "price"],
  [/\bhow (does|do|will) (it|this|that|you|outsourcing) work\b/g, "how it works"],
  // The site doesn't state timelines or round-the-clock cover; these words keep such questions from matching loosely.
  [/\bhow (long|soon|quickly|fast)\b/g, "timeline"],
  [/\b24 ?(\/|x) ?7\b|\b24 hours\b|\b(a)?round the clock\b/g, "roundtheclock"],
  [/\blead gen(eration)?\b/g, "leads prospecting"],
  [/\bcold call(s|ing)?\b/g, "outbound calling prospecting"],
  [/\bit (support|help ?desk|services?|team)\b/g, "technical support"],
  [/\bhelp ?desk\b/g, "helpdesk"],
  [/\bcall ?backs?\b/g, "callback"],
  [/\be ?mail\b/g, "email"],
  [/\bcx\b/g, "customer experience"],
  [/\b(book|schedule|arrange|set up) an? (call|meeting|demo)\b/g, "schedule consultation"],
  [/\bback ?office\b/g, "backoffice"],
  [/\blive ?chat\b/g, "live chat"],
  [/\bstart ?ups?\b/g, "startup"],
];

/** Porter stemming merges a few words that mean different things ("accounting" and "accountability"). */
const STEM_EXCEPTIONS: Record<string, string> = {
  customer: "customer",
  customers: "customer",
  hospital: "hospital",
  hospitals: "hospital",
  accountability: "accountability",
  accountable: "accountability",
  accounting: "accounting",
  general: "general",
  generally: "general",
  generate: "generate",
  generates: "generate",
  generating: "generate",
  generation: "generate",
};

const stemWord = (w: string) => STEM_EXCEPTIONS[w] ?? stem(w);

const SYNONYMS = new Map<string, Set<string>>();
for (const group of SYNONYM_GROUPS) {
  const stems = [...new Set(group.split(" ").map(stemWord))];
  for (const s of stems) {
    const set = SYNONYMS.get(s) ?? new Set<string>();
    stems.forEach((o) => o !== s && set.add(o));
    SYNONYMS.set(s, set);
  }
}
const SYNONYM_WORDS = SYNONYM_GROUPS.flatMap((g) => g.split(" "));

function rewrite(query: string) {
  let q = normalize(query);
  for (const [re, to] of REWRITES) q = q.replace(re, to);
  return q;
}

// Keys for matching a question to a section's name (heading, menu label or id) outright.
/** Every word as written: "how it works" == "How it works". */
const fullKey = (text: string) => words(rewrite(text)).join(" ");
/** Topic words as written: "What is your mission?" == "Our mission". */
const topicKey = (text: string) => contentWords(rewrite(text), QUERY_FILLER).join(" ");
/** Topic words, stemmed: "FAQ" == "FAQs". */
const topicStemKey = (text: string) => contentWords(rewrite(text), QUERY_FILLER).map(stemWord).join(" ");

/** Name lookups, preferring headings over menu labels over ids, then broader sections ("Services" over the value "Service"). */
class NameIndex {
  private map = new Map<string, { section: KbSection; rank: number }>();
  constructor(private key: (text: string) => string) {}
  add(name: string, section: KbSection, kind: number) {
    const key = this.key(name);
    if (!key) return;
    const rank = kind * 10 + section.level;
    const taken = this.map.get(key);
    if (!taken || rank < taken.rank) this.map.set(key, { section, rank });
  }
  get(query: string) {
    const key = this.key(query);
    return key ? this.map.get(key)?.section : undefined;
  }
}

// ---------------------------------------------------------------------------
// Index

const FIELD_WEIGHT = { heading: 3, alias: 2.5, keyword: 2, body: 1 };
const K1 = 1.2;
const B = 0.4;
/** Extra score for each question word found in a section's heading, menu label or id. */
const TITLE_BONUS = 0.75;

interface Doc {
  section: KbSection;
  tf: Map<string, number>;
  len: number;
  bigrams: Set<string>;
  titleTerms: Set<string>;
  unitTerms: Set<string>[];
}

interface QueryTerm {
  word: string;
  /** Index term -> weight: 1 for the word itself, less for synonyms and typo corrections. */
  expansions: Map<string, number>;
}

export interface Scored {
  section: KbSection;
  score: number;
  coverage: number;
}

export type Intent =
  | "greeting"
  | "thanks"
  | "bye"
  | "identity"
  | "callback"
  | "contact"
  | "hours"
  | "address"
  | "social"
  | "privacy"
  | "jobs";

export type Reply =
  | { kind: "answer"; section: KbSection; units: Unit[]; related: KbSection[] }
  | { kind: "unsure"; options: KbSection[] }
  | { kind: "none" }
  | { kind: "intent"; intent: Intent };

// Confidence thresholds, tuned against questions about the site (see README).
const MIN_SCORE = 1.5; // Below this nothing matched well enough to mention.
const ANSWER_SCORE = 3; // At or above this (with good coverage and a clear lead), answer directly.
const ANSWER_COVERAGE = 0.66; // Share of the question's keywords the section must contain.
const CLEAR_LEAD = 1.25; // The best section must beat the runner-up by this factor.

const stemsOf = (text: string) => contentWords(text).map(stemWord);

function bigramsOf(stems: string[], into: Set<string>) {
  for (let i = 1; i < stems.length; i++) into.add(`${stems[i - 1]} ${stems[i]}`);
}

export class SiteSearch {
  readonly sections: KbSection[];
  readonly profile: SiteProfile;
  private docs: Doc[];
  private df = new Map<string, number>();
  private vocab = new Map<string, string>();
  private names = [new NameIndex(fullKey), new NameIndex(topicKey), new NameIndex(topicStemKey)];
  /** Short words from element ids, which are often abbreviations ("diff", "faq"). */
  private idWords = new Set<string>();
  private byId = new Map<string, KbSection>();
  private avgLen: number;

  constructor(kb: KnowledgeBase) {
    this.sections = kb.sections;
    this.profile = kb.profile;
    this.docs = kb.sections.map((section) => {
      const tf = new Map<string, number>();
      const bigrams = new Set<string>();
      const add = (text: string, weight: number) => {
        const stems = stemsOf(text);
        stems.forEach((s) => tf.set(s, (tf.get(s) ?? 0) + weight));
        bigramsOf(stems, bigrams);
        contentWords(text).forEach((w) => this.vocab.set(w, stemWord(w)));
      };
      const titles = [section.heading, ...section.aliases, ...section.keywords];
      add(section.heading, FIELD_WEIGHT.heading);
      section.aliases.forEach((a) => add(a, FIELD_WEIGHT.alias));
      section.keywords.forEach((k) => add(k, FIELD_WEIGHT.keyword));
      section.units.forEach((u) => add(u.text, FIELD_WEIGHT.body));
      const len = [...tf.values()].reduce((a, b) => a + b, 0);
      return {
        section,
        tf,
        len,
        bigrams,
        titleTerms: new Set(titles.flatMap(stemsOf)),
        unitTerms: section.units.map((u) => new Set(stemsOf(u.text))),
      };
    });
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avgLen = this.docs.reduce((a, d) => a + d.len, 0) / Math.max(1, this.docs.length);
    // Synonyms are typo-correction targets too ("pirce" -> "price" -> "pricing").
    for (const w of SYNONYM_WORDS) if (!this.vocab.has(w)) this.vocab.set(w, stemWord(w));
    const [full, ...topic] = this.names;
    for (const s of kb.sections) {
      this.byId.set(s.id, s);
      // Whole names are the ones visitors see: headings and menu labels. Ids only name topics.
      full.add(s.heading, s, 0);
      s.aliases.forEach((a) => full.add(a, s, 1));
      for (const index of topic) {
        index.add(s.heading, s, 0);
        s.aliases.forEach((a) => index.add(a, s, 1));
        s.keywords.forEach((k) => index.add(k, s, 2));
      }
      s.keywords.forEach((k) => k.split(" ").forEach((w) => w.length >= 3 && w.length <= 5 && this.idWords.add(w)));
    }
  }

  section(id: string) {
    return this.byId.get(id);
  }

  private idf(term: string) {
    const df = this.df.get(term) ?? 0;
    const n = this.docs.length;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  private termScore(doc: Doc, term: string) {
    const f = doc.tf.get(term);
    if (!f) return 0;
    return (this.idf(term) * f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.len) / this.avgLen));
  }

  /** The question's keywords, each with the index terms it can match. */
  queryTerms(query: string): QueryTerm[] {
    const seen = new Set<string>();
    const terms: QueryTerm[] = [];
    for (const word of contentWords(rewrite(query), QUERY_FILLER)) {
      // Quantities ("5 agents") are not topics.
      if (seen.has(word) || /^\d+$/.test(word)) continue;
      seen.add(word);
      terms.push({ word, expansions: this.expand(word) });
    }
    return terms;
  }

  private expand(word: string): Map<string, number> {
    const out = new Map<string, number>();
    const add = (term: string, weight: number) => {
      if (this.df.has(term) && (out.get(term) ?? 0) < weight) out.set(term, weight);
    };
    const addWithSynonyms = (s: string, weight: number) => {
      add(s, weight);
      SYNONYMS.get(s)?.forEach((syn) => add(syn, weight * 0.7));
    };
    const s = stemWord(word);
    addWithSynonyms(s, 1);
    // A known word (or a synonym of one) is spelled correctly; numbers are never "corrected".
    if (out.size || /\d/.test(word)) return out;

    // Not on the site as written: look for a close spelling.
    const max = allowedEdits(word);
    let best = max + 1;
    let matches: string[] = [];
    for (const candidate of this.vocab.keys()) {
      if (Math.abs(candidate.length - word.length) > max) continue;
      // Short words: keep the first letter, which typos rarely change, to avoid unrelated matches.
      if (word.length <= 5 && candidate[0] !== word[0]) continue;
      const d = editDistance(word, candidate, max);
      if (d < best) [best, matches] = [d, [candidate]];
      else if (d === best) matches.push(candidate);
    }
    if (best <= max) for (const m of matches) addWithSynonyms(this.vocab.get(m)!, best === 1 ? 0.8 : 0.6);

    // A word cut short ("hospi" -> "hospitality"), or an id written short ("diff" for "different").
    if (word.length >= 4 && !out.size) {
      for (const [candidate, cs] of this.vocab) if (candidate.length > word.length + 1 && candidate.startsWith(word)) add(cs, 0.6);
      for (const short of this.idWords) if (word.startsWith(short)) add(stemWord(short), 0.6);
    }
    return out;
  }

  /** Sections ranked by how well they match the question. */
  rank(terms: QueryTerm[]): Scored[] {
    if (!terms.length) return [];
    const results: Scored[] = [];
    for (const doc of this.docs) {
      let total = 0;
      let matched = 0;
      for (const t of terms) {
        let best = 0;
        let title = 0;
        let weight = 0;
        for (const [term, w] of t.expansions) {
          const s = w * this.termScore(doc, term);
          if (s > 0) weight = Math.max(weight, w);
          best = Math.max(best, s);
          // A synonym in a heading is weaker evidence than the word itself.
          if (doc.titleTerms.has(term)) title = Math.max(title, w * w * this.idf(term) * TITLE_BONUS);
        }
        // Coverage counts a synonym or typo match as part of a match.
        matched += weight;
        total += best + title;
      }
      if (!matched) continue;
      // Words that appear side by side in the section ("appointment setting", or "customer service"
      // for "customer support") count extra.
      let phrase = 0;
      for (let i = 1; i < terms.length; i++) {
        let pair = 0;
        for (const [a, wa] of terms[i - 1].expansions) {
          for (const [b, wb] of terms[i].expansions) {
            if (doc.bigrams.has(`${a} ${b}`)) pair = Math.max(pair, wa * wb * 0.75 * (this.idf(a) + this.idf(b)));
          }
        }
        phrase += pair;
      }
      const coverage = matched / terms.length;
      results.push({ section: doc.section, score: total * (0.5 + 0.5 * coverage) + phrase, coverage });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  /** Up to three sentences (or lists) from the section that best match the question, in page order. */
  pickUnits(section: KbSection, terms: QueryTerm[], max = 3): Unit[] {
    const doc = this.docs.find((d) => d.section.id === section.id);
    if (!doc || !section.units.length) return [];
    const scores = doc.unitTerms.map((set) => {
      let s = 0;
      for (const t of terms) {
        let best = 0;
        for (const [term, w] of t.expansions) if (set.has(term)) best = Math.max(best, w * this.idf(term));
        s += best;
      }
      return s;
    });
    const top = Math.max(...scores);
    // Matched on the heading only (or opened from a button): the section's opening lines answer best.
    if (top <= 0) return section.units.slice(0, max);
    return scores
      .map((score, i) => ({ score, i }))
      .filter((x) => x.score >= top * 0.5)
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, max)
      .sort((a, b) => a.i - b.i)
      .map((x) => section.units[x.i]);
  }

  answerWith(section: KbSection, terms: QueryTerm[] = []): Reply {
    const related = section.children.map((id) => this.byId.get(id)).filter((s): s is KbSection => !!s);
    return { kind: "answer", section, units: this.pickUnits(section, terms), related };
  }

  /** Finds the section a key page link points to ("/#about"). */
  sectionAt(href: string | undefined) {
    if (!href) return undefined;
    return this.sections.find((s) => s.url === href) ?? this.sections.find((s) => s.page === href && s.level === 1);
  }

  respond(query: string): Reply {
    const intent = detectIntent(query, this.profile);
    if (intent && intent !== "about") return { kind: "intent", intent };
    const terms = this.queryTerms(query);

    // A quick reply, heading or menu label typed as is ("How it works", "Why BBO").
    const [full, topic, topicStem] = this.names;
    const named = full.get(query);
    if (named) return this.answerWith(named, terms);
    if (intent === "about") {
      const about = this.sectionAt(this.profile.pages.about?.href);
      if (about) return this.answerWith(about);
    }
    // A question about one named topic ("What is your mission?", "FAQ").
    const topical = topic.get(query) ?? topicStem.get(query);
    if (topical) return this.answerWith(topical, terms);

    // When half the question's words appear nowhere on the site ("do you sell pizza"), any match is a guess.
    const unknown = terms.filter((t) => !t.expansions.size).length;
    if (!terms.length || unknown * 2 >= terms.length) return { kind: "none" };

    const ranked = this.rank(terms);
    const [best, next] = ranked;
    if (!best || best.score < MIN_SCORE || best.coverage < 0.34) return { kind: "none" };

    const related = (a: KbSection, b: KbSection) => a.parent === b.id || b.parent === a.id;
    const clearLead = !next || best.score >= next.score * CLEAR_LEAD || related(best.section, next.section);
    if (best.score >= ANSWER_SCORE && best.coverage >= ANSWER_COVERAGE && clearLead) return this.answerWith(best.section, terms);

    const options: KbSection[] = [];
    for (const r of ranked) {
      if (r.score < best.score * 0.4 || options.length === 3) break;
      if (!options.some((o) => normalize(o.heading) === normalize(r.section.heading))) options.push(r.section);
    }
    return { kind: "unsure", options };
  }
}

// ---------------------------------------------------------------------------
// Intents: greetings, and questions about the business's own details (answered from the site profile).

const GREETING_WORDS = new Set("hi hello hey hiya howdy greetings yo hallo hola good morning afternoon evening day there".split(" "));
const THANKS = /\b(thanks?|thank you|thx|ty|cheers|appreciate it|much appreciated)\b/;
const BYE = /^(ok(ay)? )?(bye|goodbye|good bye|see you|see ya|cya|later)\b/;
const IDENTITY =
  /\b(who|what) are you\b|\bare you (a |an )?(bot|robot|human|real|person|ai|machine|chatbot)\b|\byour name\b|\bwho (am i|is this) (talking|speaking|chatting)\b/;
const CALLBACK =
  /\b(callback|call me|ring me|phone me|contact me|call me back|(speak|talk) (to|with) (a |an )?(someone|somebody|human|person|agent|representative|rep|sales|team)|real person|live agent|human agent)\b/;
const PRIVACY = /\b(privacy|gdpr|personal data|data protection|cookies?)\b/;
// Job seekers, kept apart from questions about hiring a team through the business.
const JOBS =
  /\b(are you hiring|job openings?|jobs?|careers?|vacanc(y|ies)|job applications?|apply (for|to) (a |an |the )?(job|position|role|vacancy)|join your team|internships?|work (for|at) you)\b/;

// Questions made only of these words (plus filler) ask for the detail; at least one "core" word must be present.
const DETAIL_INTENTS: [Intent, Set<string>, Set<string>][] = [
  [
    "contact",
    new Set("contact contacts phone telephone tel number numbers call email address reach touch whatsapp viber hold details way ways best".split(" ")),
    new Set("contact phone telephone email reach touch whatsapp call number".split(" ")),
  ],
  [
    "hours",
    new Set("hours hour open opening opened opens close closing closed closes time times business office operate operating working available availability today tomorrow weekend weekends saturday sunday holiday holidays days".split(" ")),
    new Set("hours hour open opening opens close closing closed closes availability weekend weekends saturday sunday holiday holidays".split(" ")),
  ],
  [
    "address",
    new Set("address located location locations office offices headquarters hq based find visit directions map situated country city street".split(" ")),
    new Set("address located location office offices headquarters hq based directions situated where".split(" ")),
  ],
  [
    "social",
    new Set("social socials media facebook instagram linkedin twitter youtube tiktok pinterest threads page pages profile profiles account accounts".split(" ")),
    new Set("social socials facebook instagram linkedin twitter youtube tiktok pinterest threads".split(" ")),
  ],
];

const ABOUT_WORDS = new Set("company firm business who about history story background founded owner owners".split(" "));

export function detectIntent(query: string, profile: SiteProfile): Intent | "about" | null {
  const q = rewrite(query);
  const all = words(q);
  if (!all.length) return null;

  if (CALLBACK.test(q)) return "callback";
  if (IDENTITY.test(q)) return "identity";
  if (PRIVACY.test(q)) return "privacy";
  if (JOBS.test(q) || (profile.acronym && new RegExp(`\\bwork (for|at) ${profile.acronym.toLowerCase()}\\b`).test(q))) return "jobs";

  // Name words ("bbo", "beyond", "borders") and generic company words are neutral in detail questions.
  const nameWords = new Set(words(profile.name).concat(profile.acronym ? [profile.acronym.toLowerCase()] : []));
  const neutral = (w: string) => STOPWORDS.has(w) || QUERY_FILLER.has(w) || nameWords.has(w) || ABOUT_WORDS.has(w) || w.length < 2;
  const topical = all.filter((w) => !neutral(w));

  for (const [intent, vocabulary, core] of DETAIL_INTENTS) {
    if (all.some((w) => core.has(w)) && topical.every((w) => vocabulary.has(w))) return intent;
  }

  const acronym = profile.acronym?.toLowerCase();
  if (all.every((w) => GREETING_WORDS.has(w) || w === acronym || w === ASSISTANT_NAME.toLowerCase())) return "greeting";
  if (THANKS.test(q) && all.length <= 6) return "thanks";
  if (BYE.test(q) && all.length <= 4) return "bye";

  // "What is BBO?", "Tell me about Beyond Borders", "Who is the company?"
  const leadName = words(profile.name).slice(0, 2).join(" ");
  const namesBusiness = (acronym && all.includes(acronym)) || (leadName && q.includes(leadName)) || all.includes("company");
  if (namesBusiness && !topical.length) return "about";
  return null;
}

/** Drops a leading greeting ("hi, what does it cost?") so the question itself is matched. */
export function stripGreeting(query: string): string {
  return query.replace(/^\s*(hi|hello|hey|hiya|howdy|greetings|good (morning|afternoon|evening))( there)?( bob)?[\s,.!:;-]+/i, "").trim() || query;
}
