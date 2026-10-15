// Text helpers for the chat assistant: tokenizing, stemming, typo distance and sentence splitting.
// Pure functions with no DOM access.

/** Words ignored both when indexing page text and when reading a question. */
export const STOPWORDS = new Set(
  (
    "a about above after again against all also am an and any are as at be because been before being below between both " +
    "but by can cant could did didnt do does doesnt doing dont down during each few for from further had has have having " +
    "he her here hers him his how i id if im in into is isnt it its itll ive just let lets me might more most must my no " +
    "nor not now of off on once only or other our ours out over own same shall she should so some such than that thats " +
    "the their them then there these they this those through to too under until up us very was we well were weve what " +
    "whats when where which while who whom why will with wont would you youd youll your youre yours"
  ).split(" ")
);

/** Words that carry no topic in a question ("can you tell me about..."), though they may appear in page text. */
export const QUERY_FILLER = new Set(
  (
    "please tell know want wanted like need needs give show find get got looking look offer offers offered provide " +
    "provides provided help helps available any anything something thing things kind kinds type types sort info " +
    "information detail details explain describe mean question ask asking use uses using used handle handles " +
    "handling deal work works working worked company companies business businesses firm firms make makes take takes"
  ).split(" ")
);

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Lowercase, strip accents and apostrophes ("client's" -> "clients"). */
export function normalize(text: string): string {
  return text.normalize("NFKD").replace(COMBINING_MARKS, "").toLowerCase().replace(/['’`]/g, "").replace(/&/g, " and ");
}

/**
 * Splits text into lowercase words. Hyphenated words also yield their joined form,
 * so "e-commerce" matches "ecommerce" and "back-office" matches "backoffice".
 */
export function words(text: string): string[] {
  const out: string[] = [];
  for (const m of normalize(text).matchAll(/[a-z0-9]+(?:-[a-z0-9]+)*/g)) {
    const w = m[0];
    if (w.includes("-")) {
      const parts = w.split("-");
      out.push(...parts, parts.join(""));
    } else out.push(w);
  }
  return out;
}

/** Words worth indexing or searching for: no stopwords and no single characters. */
export function contentWords(text: string, extraStops?: Set<string>): string[] {
  return words(text).filter((w) => w.length > 1 && !STOPWORDS.has(w) && !extraStops?.has(w));
}

// ---------------------------------------------------------------------------
// Porter stemmer (M.F. Porter, 1980): "pricing", "prices" and "price" all become "price".

const STEP2: Record<string, string> = {
  ational: "ate", tional: "tion", enci: "ence", anci: "ance", izer: "ize", bli: "ble", alli: "al", entli: "ent",
  eli: "e", ousli: "ous", ization: "ize", ation: "ate", ator: "ate", alism: "al", iveness: "ive", fulness: "ful",
  ousness: "ous", aliti: "al", iviti: "ive", biliti: "ble", logi: "log",
};
const STEP3: Record<string, string> = { icate: "ic", ative: "", alize: "al", iciti: "ic", ical: "ic", ful: "", ness: "" };

const c = "[^aeiou]";
const v = "[aeiouy]";
const C = c + "[^aeiouy]*";
const V = v + "[aeiou]*";
const MGR0 = new RegExp("^(" + C + ")?" + V + C); // measure > 0
const MEQ1 = new RegExp("^(" + C + ")?" + V + C + "(" + V + ")?$"); // measure = 1
const MGR1 = new RegExp("^(" + C + ")?" + V + C + V + C); // measure > 1
const HAS_VOWEL = new RegExp("^(" + C + ")?" + v);
const CVC = new RegExp("^" + C + v + "[^aeiouwxy]$");
const STEP2_RE = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
const STEP3_RE = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
const STEP4_RE = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;

const stemCache = new Map<string, string>();

export function stem(word: string): string {
  if (word.length < 3 || /\d/.test(word)) return word;
  const hit = stemCache.get(word);
  if (hit) return hit;

  let w = word;
  const initialY = w[0] === "y";
  if (initialY) w = "Y" + w.slice(1);
  let m: RegExpExecArray | null;

  // Step 1a: plurals.
  if ((m = /^(.+?)(ss|i)es$/.exec(w))) w = m[1] + m[2];
  else if ((m = /^(.+?)([^s])s$/.exec(w))) w = m[1] + m[2];

  // Step 1b: -eed, -ed, -ing.
  if ((m = /^(.+?)eed$/.exec(w))) {
    if (MGR0.test(m[1])) w = w.slice(0, -1);
  } else if ((m = /^(.+?)(ed|ing)$/.exec(w)) && HAS_VOWEL.test(m[1])) {
    w = m[1];
    if (/(at|bl|iz)$/.test(w)) w += "e";
    else if (/([^aeiouylsz])\1$/.test(w)) w = w.slice(0, -1);
    else if (CVC.test(w)) w += "e";
  }

  // Step 1c: -y to -i.
  if ((m = /^(.+?)y$/.exec(w)) && HAS_VOWEL.test(m[1])) w = m[1] + "i";

  // Steps 2 and 3: double and single suffixes.
  if ((m = STEP2_RE.exec(w)) && MGR0.test(m[1])) w = m[1] + STEP2[m[2]];
  if ((m = STEP3_RE.exec(w)) && MGR0.test(m[1])) w = m[1] + STEP3[m[2]];

  // Step 4: remaining suffixes on long stems.
  if ((m = STEP4_RE.exec(w))) {
    if (MGR1.test(m[1])) w = m[1];
  } else if ((m = /^(.+?)(s|t)(ion)$/.exec(w)) && MGR1.test(m[1] + m[2])) {
    w = m[1] + m[2];
  }

  // Step 5: final -e and -ll.
  if ((m = /^(.+?)e$/.exec(w)) && (MGR1.test(m[1]) || (MEQ1.test(m[1]) && !CVC.test(m[1])))) w = m[1];
  if (/ll$/.test(w) && MGR1.test(w)) w = w.slice(0, -1);

  if (initialY) w = "y" + w.slice(1);
  stemCache.set(word, w);
  return w;
}

// ---------------------------------------------------------------------------

/**
 * Optimal string alignment distance (Levenshtein plus adjacent swaps), so "pirce" -> "price" is one edit.
 * Returns max + 1 as soon as the distance is known to exceed max.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      cur[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** How many typos to forgive in a word of this length. */
export function allowedEdits(word: string): number {
  return word.length < 4 ? 0 : word.length < 9 ? 1 : 2;
}

// Periods after these words rarely end a sentence ("Services Inc. was founded").
const ABBREVIATION = /\b(?:inc|ltd|llc|co|corp|mr|mrs|ms|dr|st|vs|etc|e\.g|i\.e|no|jr|sr|approx)\.$/i;

/** Splits a paragraph into sentences without breaking on common abbreviations. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[.!?]+["')\]”’]*\s+(?=["'(\[“‘]?[A-Z0-9])/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].trimEnd().length;
    const sentence = text.slice(start, end).trim();
    if (ABBREVIATION.test(sentence)) continue;
    if (sentence) out.push(sentence);
    start = re.lastIndex;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** Collapses whitespace and tidies the space left before punctuation when inline elements are joined. */
export function cleanText(text: string): string {
  return text
    .replace(/[ \s]+/g, " ")
    .replace(/\s+([.,;:!?)\]])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .trim();
}
