import { describe, expect, it } from "vitest";
import { contentDisposition, cvFilename } from "@/lib/cv/filename";
import type { CvData } from "@/lib/cv/schema";
import { mailtoHref, telHref } from "@/lib/pdf/meta";

const header = (name: string, title: string): CvData["header"] => ({
  name,
  title,
  phone: undefined,
  location: undefined,
  links: [],
});

describe("cvFilename", () => {
  it("builds CV-Prenom-Nom-Titre in ASCII", () => {
    expect(cvFilename(header("Éloïse Lefèvre-Çelik", "Développeuse full-stack"), "pdf")).toBe(
      "CV-Eloise-Lefevre-Celik-Developpeuse-full-stack.pdf",
    );
    expect(cvFilename(header("Œdipe Ørsted", "Dev · Ops / SRE"), "docx")).toBe("CV-OEdipe-Orsted-Dev-Ops-SRE.docx");
  });
  it("truncates long names on a word boundary", () => {
    const f = cvFilename(header("Jean Dupont", "Ingénieur ".repeat(30)), "pdf");
    expect(f.length).toBeLessThanOrEqual(84);
    expect(f).toMatch(/^CV-Jean-Dupont-Ingenieur(-Ingenieur)*\.pdf$/);
  });
  it("falls back to CV when the header is empty", () => {
    expect(cvFilename(header("", ""), "pdf")).toBe("CV.pdf");
  });
});

describe("contentDisposition", () => {
  const h = header("Éloïse Lefèvre", "Dev");
  it("is inline by default and attachment on download", () => {
    expect(contentDisposition(h, "pdf", false)).toMatch(/^inline; /);
    expect(contentDisposition(h, "pdf", true)).toMatch(/^attachment; /);
  });
  it("carries an ASCII filename and a UTF-8 filename*", () => {
    expect(contentDisposition(h, "pdf", true)).toBe(
      `attachment; filename="CV-Eloise-Lefevre-Dev.pdf"; filename*=UTF-8''CV-%C3%89lo%C3%AFse-Lef%C3%A8vre-Dev.pdf`,
    );
  });
});

describe("contact hrefs", () => {
  it("normalises phone numbers", () => {
    expect(telHref("+33 6 12 34 56 78")).toBe("tel:+33612345678");
    expect(telHref("06 12 34 56 78")).toBe("tel:+33612345678");
    expect(telHref("+33 (0)6.12.34.56.78")).toBe("tel:+33612345678");
    expect(telHref("0033 6 12 34 56 78")).toBe("tel:+33612345678");
  });
  it("builds mailto", () => {
    expect(mailtoHref(" a@b.fr ")).toBe("mailto:a@b.fr");
  });
});
