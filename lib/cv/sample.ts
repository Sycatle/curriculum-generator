import type { CvData, Theme } from "./schema";

/**
 * Sample data used by the /showcase page and the landing-page hero.
 * Kept in sync with the live CV in spirit; not a 1:1 copy.
 */
export const sampleCvData: CvData = {
  header: {
    name: "Sycatle",
    title: "Software Engineer · Full-stack",
    email: "sycatle@pm.me",
    phone: "+33 6 00 00 00 00",
    location: "Paris, France",
    links: [
      { label: "GitHub", href: "https://github.com/sycatle" },
      { label: "Site", href: "https://sycatle.dev" },
    ],
  },
  photoUrl: undefined,
  summary:
    "Ingénieur full-stack passionné par les systèmes propres, les expériences utilisateur soignées et l'open-source. J'aime livrer en production ce qui n'existait que sur le whiteboard la veille.",
  experiences: [
    {
      role: "Senior Software Engineer",
      company: "Stripe-like SaaS",
      startDate: "2023-01",
      endDate: null,
      location: "Paris",
      summary: "Plateforme de paiement marchand B2B en pleine scale-up.",
      bullets: [
        "Mise à l'échelle de l'API checkout : 10× le throughput, p99 sous 80 ms",
        "Refonte du dashboard merchant en Next.js 15 + RSC",
        "Owner du système de webhooks et de la file d'attente idempotente",
      ],
      stack: ["TypeScript", "Next.js", "PostgreSQL", "Stripe API", "Redis"],
    },
    {
      role: "Software Engineer",
      company: "Startup B2B SaaS",
      startDate: "2021-03",
      endDate: "2022-12",
      location: "Remote",
      summary: undefined,
      bullets: [
        "MVP livré en 9 semaines (auth, billing, CRUD, dashboards)",
        "Migration Heroku → AWS ECS + RDS, baisse de coût de 40 %",
      ],
      stack: ["Node.js", "Express", "PostgreSQL", "AWS"],
    },
  ],
  projects: [
    {
      name: "curriculum-generator",
      url: "https://github.com/sycatle/curriculum-generator",
      description:
        "Self-hosted, open-source CV generator. Édite le contenu, puis exporte un PDF A4 sur une ou plusieurs pages. C'est ce que tu lis.",
      stack: ["Next.js", "React-PDF", "Drizzle", "Tailwind"],
    },
  ],
  education: [
    {
      degree: "Master Informatique",
      school: "Université Paris-Saclay",
      startDate: "2018-09",
      endDate: "2020-06",
      location: "Paris",
      details: undefined,
    },
  ],
  skills: [
    { category: "Langages", items: ["TypeScript", "JavaScript", "Go", "SQL"] },
    {
      category: "Frameworks",
      items: ["Next.js 15", "React 19", "Node.js", "Express", "Drizzle"],
    },
    { category: "Infra", items: ["Docker", "Caddy", "PostgreSQL", "Linux", "Cloudflare"] },
    { category: "Pratiques", items: ["TDD", "DDD", "Code review", "OSS"] },
  ],
  languages: [
    { name: "Français", level: "Natif" },
    { name: "Anglais", level: "C1" },
  ],
  certifications: [],
  interests: ["Open-source", "Photographie", "Lecture", "Course à pied"],
};

export const sampleTheme: Theme = {
  template: "premium",
  pageMode: "single",
  colors: {
    primary: "#0F172A",
    text: "#111827",
    muted: "#6B7280",
    accent: "#2563EB",
  },
  fonts: { heading: "sans", body: "sans" },
  spacing: "normal",
  accentStyle: "bar",
};
