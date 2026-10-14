// All page copy lives here so it can be edited without touching layout code.

export const NAV = [
  { href: "#services", label: "Services" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#why-bbo", label: "Why BBO" },
  { href: "#about", label: "About" },
];

export type ServiceKey = "cx" | "hospitality" | "sales" | "backoffice" | "tech" | "custom";

export interface Service {
  key: ServiceKey;
  /** Short label used in tabs, globe tags, and footer links. */
  label: string;
  /** Even shorter label where space is tight (hero strip, footer). */
  shortLabel?: string;
  /** Matching option in the consultation form's "Area of support" select. */
  option: string;
  title: string;
  tagline: string;
  intro: string;
  items?: string[];
  outro?: string;
  cta: string;
}

export const SERVICES: Service[] = [
  {
    key: "cx",
    label: "Customer experience",
    option: "Customer Experience",
    title: "Customer experience",
    tagline: "Every conversation represents your brand.",
    intro: "Build a dedicated customer experience team for:",
    items: [
      "Inbound customer service",
      "Phone support",
      "Email support",
      "Live chat",
      "Account assistance",
      "Order support",
      "Appointment scheduling",
      "Customer retention",
      "Customer follow-up",
      "Complaint resolution",
    ],
    cta: "Ask about customer experience",
  },
  {
    key: "hospitality",
    label: "Hotel and hospitality",
    option: "Hotel & Hospitality",
    title: "Hotel and hospitality",
    tagline: "Your guest experience starts before check-in.",
    intro:
      "BBO supports hotels, resorts, vacation rentals, property managers, travel companies, and hospitality groups with:",
    items: [
      "Reservations",
      "Booking assistance",
      "Reservation modifications",
      "Guest inquiries",
      "Confirmation calls",
      "Phone and email support",
      "Customer service",
      "Administrative support",
      "Guest follow-up",
    ],
    outro: "Let your property team focus on the guests in front of them while BBO supports the operation behind them.",
    cta: "Ask about hospitality support",
  },
  {
    key: "sales",
    label: "Sales and business development",
    option: "Sales & Business Development",
    title: "Sales and business development",
    tagline: "Give your salespeople more time to sell.",
    intro: "BBO supports your pipeline through:",
    items: [
      "Outbound calling",
      "Prospecting",
      "Lead qualification",
      "Appointment setting",
      "Customer reactivation",
      "Follow-up",
      "CRM management",
      "Prospect research",
      "Database development",
      "Sales administration",
    ],
    outro: "More activity. More conversations. More opportunities for your sales team.",
    cta: "Ask about sales support",
  },
  {
    key: "backoffice",
    label: "Back-office and administrative support",
    shortLabel: "Back-office and admin support",
    option: "Back-Office & Administrative Support",
    title: "Back-office and administrative support",
    tagline: "Your best people should spend their time on their best work.",
    intro: "BBO handles essential recurring processes, including:",
    items: [
      "Data entry",
      "CRM administration",
      "Scheduling",
      "Document preparation",
      "Order processing",
      "Database management",
      "Reporting",
      "Research",
      "Account administration",
      "Workflow support",
      "Quality assurance",
      "General administrative support",
    ],
    cta: "Ask about back-office support",
  },
  {
    key: "tech",
    label: "Technical support",
    option: "Technical Support",
    title: "Technical support",
    tagline: "Expert assistance that keeps your customers confident in your products and services.",
    intro:
      "Tell us about your product, your support channels, and your operating hours, and we will scope the roles with you.",
    cta: "Ask about technical support",
  },
  {
    key: "custom",
    label: "Customized solutions",
    option: "Customized Solutions",
    title: "Customized solutions",
    tagline: "Services designed to align with your industry and goals.",
    intro: "If the work does not fit a standard category, we start from your process and build the team around it.",
    cta: "Ask about a custom team",
  },
];

/** The four services in the strip under the hero. */
export const HERO_STRIP: { key: ServiceKey; label: string; note: string }[] = [
  { key: "cx", label: "Customer experience", note: "Phone, email and live chat" },
  { key: "hospitality", label: "Hotel and hospitality", note: "Reservations and guest support" },
  { key: "sales", label: "Sales and business development", note: "Prospecting and appointment setting" },
  { key: "backoffice", label: "Back-office and admin support", note: "Data, scheduling and reporting" },
];

export const PRESSURES: [string, string][] = [
  ["More customers require ", "more support."],
  ["More sales require ", "more administration."],
  ["More locations require ", "more people."],
];

export const WHY = [
  { title: "Skilled professionals", text: "Trained, experienced, and motivated people dedicated to your success." },
  { title: "Modern tools", text: "Technology and software that raise productivity and streamline processes." },
  { title: "Global reach", text: "Multilingual support for businesses serving diverse markets." },
  { title: "Scalable teams", text: "Flexible staffing and service options that grow alongside your business." },
  { title: "Cost efficiency", text: "Quality service without the high operational costs." },
];

export const STEPS = [
  { title: "Discover", text: "We learn your business, goals, staffing needs, processes, operating hours, systems, and current challenges." },
  { title: "Design", text: "We determine the roles and operating structure that make sense for your company." },
  { title: "Build", text: "We recruit professionals based on the skills, experience, and communication standards required for your operation." },
  { title: "Integrate", text: "Your BBO team learns your systems, processes, brand standards, and expectations." },
  { title: "Perform", text: "We establish clear responsibilities and performance expectations." },
  { title: "Scale", text: "As your business grows, your BBO team grows with it." },
];

export const COST_LAYERS = [
  "Recruiting",
  "Benefits",
  "Payroll expenses",
  "Office space",
  "Equipment",
  "Training",
  "Management",
  "Overtime",
  "Turnover",
  "Replacement hiring",
];

export const PH_SKILLS = [
  "Customer service",
  "Business operations",
  "Administration",
  "Hospitality support",
  "International client communication",
];

/** Rows on the time-zone board in the Philippines section. */
export const CLOCK_ZONES = [
  { name: "Manila", note: "BBO hub", tz: "Asia/Manila", hub: true },
  { name: "Los Angeles", tz: "America/Los_Angeles" },
  { name: "New York", tz: "America/New_York" },
  { name: "London", tz: "Europe/London" },
  { name: "Dubai", tz: "Asia/Dubai" },
  { name: "Sydney", tz: "Australia/Sydney" },
];

export const PROMISES = [
  "Your customers are our priority.",
  "Your standards become our standards.",
  "Your goals drive our work.",
  "Your success defines ours.",
];

export const VALUES = [
  { title: "Accountability", text: "We own our responsibilities and our results." },
  { title: "Service", text: "Every customer interaction reflects our client's brand." },
  { title: "People", text: "Great businesses start with great people." },
  { title: "Partnership", text: "We build relationships designed to last." },
  { title: "Performance", text: "Results matter. We measure our work by the value we create for our clients." },
];

/** The first industry is highlighted. */
export const INDUSTRIES = [
  "Technology",
  "E-commerce",
  "Financial services",
  "Hotels and hospitality",
  "Insurance",
  "Real estate",
  "Property management",
  "Professional services",
  "Healthcare administration",
  "Home services",
  "Travel",
  "Retail",
];

export const FAQS = [
  {
    q: "What is outsourcing?",
    a: "Outsourcing involves delegating tasks or services to external companies, allowing businesses to focus on core functions while saving costs and improving efficiency through specialized expertise.",
  },
  {
    q: "How does pricing work?",
    a: "Pricing varies based on services, scope, and complexity. We offer flexible plans tailored to your needs, ensuring competitive rates while maintaining high-quality service delivery.",
  },
  {
    q: "What is BPO?",
    a: "Business Process Outsourcing (BPO) involves contracting services like customer support, back-office tasks, and technical assistance to external providers, improving efficiency and reducing operational costs.",
  },
  {
    q: "What is an SLA?",
    a: "A Service Level Agreement (SLA) defines our commitment to meeting specific service quality, response times, and performance metrics. It ensures we deliver services as per agreed standards.",
  },
];

export const SERVICE_OPTIONS = [...SERVICES.map((s) => s.option), "Not sure yet"];

export const TEAM_SIZE_OPTIONS = ["1 position", "2 to 5 people", "6 to 15 people", "An entire department"];

export const CONTACT = {
  phone: "+1 213 597 1200",
  phoneHref: "tel:+12135971200",
  email: "info@beyondborders.ph",
};

export const FOOTER_COMPANY = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#philippines", label: "Why the Philippines" },
  { href: "#mission", label: "Mission and values" },
  { href: "#why-bbo", label: "Why choose BBO" },
  { href: "#about", label: "About BBO" },
  { href: "#faq", label: "FAQs" },
  { href: "#consultation", label: "Schedule a consultation" },
];
