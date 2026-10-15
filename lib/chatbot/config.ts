// The chat assistant's name and its own lines. Facts about the business never live here:
// answers come from the site's pages, and contact details from the site's markup.

export const ASSISTANT_NAME = "Bob";

/** Ends a sentence with the business name without doubling its period ("…Services Inc." + "."). */
const endWith = (name: string) => `${name.replace(/\.+$/, "")}.`;

export const COPY = {
  welcome: (business: string) => `Hi, I'm ${ASSISTANT_NAME}, the assistant for ${endWith(business)} How can I help?`,
  greeting: (business: string) => `Hello! What would you like to know about ${business.replace(/\.+$/, "")}?`,
  thanks: "You're welcome. Is there anything else I can help with?",
  bye: "Thanks for stopping by. I'm here if you have more questions.",
  identity: (business: string) =>
    `I'm ${ASSISTANT_NAME}, an automated assistant for ${endWith(business)} I answer using only the content of this website. ` +
    "When the website doesn't cover something, I'll share the team's contact details.",
  contact: "Here's how to reach the team:",
  callback: "Leave your details and the team can call you back.",
  noHours: "This website doesn't list opening hours. Here's how to reach the team:",
  hours: "Opening hours listed on this website:",
  noAddress: "This website doesn't list a street address. Here's how to reach the team:",
  address: "Address listed on this website:",
  noSocial: "This website doesn't list any social media profiles. Here's how to reach the team:",
  social: "Find the team here:",
  noPrivacy: "I couldn't find a privacy policy on this website. For questions about your data, contact the team:",
  privacy: "You can read the privacy policy here:",
  noJobs: "I couldn't find job openings on this website. You can ask the team directly:",
  jobs: "You can see open positions here:",
  unsure: "I'm not sure I found the right answer. Did you mean:",
  noneOfThese: "Something else",
  none: "Sorry, I couldn't find an answer to that on this website. You can contact the team directly:",
  offline: "I can't search the website right now. You can contact the team directly:",
  empty: "Ask me a question about the website, or pick a topic below.",
  related: "Related topics",
  readMore: "Read more",
  topics: "Choose a topic:",
  footnote: `${ASSISTANT_NAME} answers using this website's content only.`,
};

/** Delay before a reply appears, so it reads as a reply rather than flashing in. */
export const REPLY_DELAY_MS = 250;
