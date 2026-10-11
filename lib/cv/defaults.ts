import type { CvData, Theme } from "./schema";

export const defaultTheme: Theme = {
  template: "premium",
  pageMode: "single",
  colors: {
    primary: "#0F172A",
    text: "#111827",
    muted: "#6B7280",
    accent: "#2563EB",
  },
  fonts: {
    heading: "sans",
    body: "sans",
  },
  spacing: "normal",
  accentStyle: "bar",
};

export const blankCvData: CvData = {
  header: {
    name: "Your Name",
    title: "Your Role",
    email: undefined,
    phone: undefined,
    location: undefined,
    links: [],
  },
  photoUrl: undefined,
  summary: undefined,
  experiences: [],
  projects: [],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
  interests: [],
};
