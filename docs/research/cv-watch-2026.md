# Veille CV 2026 — Devs & Product Engineers

Archive sourcée des règles ATS, des attentes recruteurs et des bonnes pratiques
de design qui guident les checks déterministes du produit
(`lib/cv/ats-checks.ts`, `lib/cv/bullet-lint.ts`, `lib/cv/job-match.ts`) et le
template `template-ats.tsx`.

Mettre à jour ce fichier en même temps que les seuils dans le code, pour
préserver la traçabilité.

## Ce que les recruteurs lisent (7 s de scan)

1. **Nom, titre, pitch** sous le nom (3-4 lignes max).
2. **Expérience la plus récente** : entreprise, rôle, dates `MM/YYYY – Present`,
   3-5 bullets quantifiés.
3. **Stack visible** — bloc Skills catégorisé (10-16 items) **ou** stack par
   expérience.
4. **Liens publics** : GitHub, portfolio, LinkedIn. Absence = red flag pour un
   rôle front / full-stack / product engineer.

## Règles ATS dures (2026)

- **Single column.** Les parsers lisent en flux linéaire ; les 2-col et
  side-bars mergent expériences avec compétences.
- **Headings standards selon la langue du CV** : `Work Experience` / `Expérience
  professionnelle`, `Education` / `Formation`, `Skills` / `Compétences`, etc.
  Garder les rubriques dans la même langue que le CV.
- **Dates `MM/YYYY – Present`** (pas "Mars 2023", pas "2023").
- **Ordre canonique** : Contact → Summary → Skills → Experience → Projects →
  Education → Certifications → Languages.
- **Police safe** : Inter, Roboto, Calibri, Helvetica, Arial, Open Sans.
- **Pas d'icônes glyphs**, pas de jauges/étoiles, pas de barres de progression.
- **Acronymes + forme longue** (`AWS (Amazon Web Services)`) pour matcher les
  deux écritures dans le JD.
- **Format `.docx`** > PDF côté parsing. PDF accepté seulement si text-layer
  (cas de `@react-pdf/renderer`).

## Bullets qui passent

Formule : `[Verbe d'action fort] [ce qui a été construit] [comment / stack] [résultat chiffré + scope]`.

- ✅ "Rebuilt auth service in Go, cutting login p95 from 850 ms to 120 ms across 500K MAU."
- ❌ "Responsible for the authentication microservice."

Verbes recommandés (passé) : Built, Designed, Shipped, Migrated, Architected,
Reduced, Increased, Led, Owned, Launched, Delivered, Implemented, Refactored,
Optimized, Deployed, Engineered.

Verbes bannis : Helped, Assisted, Participated, Supported, Worked,
Responsible (for), Involved.

Au moins **1 chiffre / 1 décision d'archi** par bullet. Si rien, couper.

## Red flags qui éliminent un dev

- Photo ou infos perso (âge, état civil) — risque légal côté recruteur US/UK,
  dévalorisant en tech.
- > 6-8 langages listés (= aucune maîtrise réelle).
- Compétences génériques (`MS Word`, `HTML`, `JSON` pour un SWE senior).
- Aucun lien public pour un rôle frontend / full-stack / product.
- Titres gonflés ("Head of X" après 2 ans XP).
- Fautes d'orthographe — 58 % des CV en contiennent, 40 % des recruteurs
  éliminent immédiatement.
- Bullets = liste de responsabilités au lieu d'impact chiffré.
- Trous d'emploi non expliqués, job-hopping < 1 an répété.

## Design haut de gamme (2026)

- **Sans-serif géométrique** : Inter, Söhne, GT America, Geist. 10-11 pt corps,
  14-18 pt titres.
- **Hiérarchie typo > décoration.** Beaucoup de white-space, grille modulaire.
- **Accent monochrome** : 1 teinte unique appliquée au nom / liens / dividers.
  Pas d'arc-en-ciel.
- **Pas d'icônes système** (Material/FA). Au mieux des glyphes Unicode
  bien placés (rarement).

## Sources

- [Practical guide to writing FAANG-ready software engineer resumes — Tech Interview Handbook](https://www.techinterviewhandbook.org/resume/)
- [60+ Software Engineer Resume Keywords (2026 ATS Data) — ResumeAdapter](https://www.resumeadapter.com/blog/software-engineer-resume-keywords)
- [ATS Resume Formatting Rules (2026): What Actually Breaks Parsing — ResumeAdapter](https://www.resumeadapter.com/blog/ats-resume-formatting-rules-2026)
- [Why ATS Tables and Columns Break Your Resume Parsing in 2026 — Jobscan](https://www.jobscan.co/blog/resume-tables-columns-ats/)
- [Anatomy of an ATS Friendly Resume Format (2026) — Jobscan](https://www.jobscan.co/blog/20-ats-friendly-resume-templates/)
- [ATS-Friendly Resume Guide (2026): Format, Keywords, Score, and Fixes — OwlApply](https://owlapply.com/en/blog/ats-friendly-resume-guide-2026-format-keywords-score-and-fixes)
- [Developer Resume Red Flags to Avoid — Index.dev](https://www.index.dev/blog/tech-resume-red-flags-developer-jobs)
- [Recruiter confessions: 6 resume red flags — Welcome to the Jungle](https://www.welcometothejungle.com/en/articles/red-flags-on-a-resume)
- [Hiring a Software Engineer? Resume Red Flags — Recruiter.com](https://www.recruiter.com/recruiting/hiring-a-software-engineer-look-out-for-these-resume-red-flags/)
- [20 Product Engineer Resume Examples & Guide — Enhancv](https://enhancv.com/resume-examples/product-engineer/)
- [Software Engineer Resume: 50+ Bullet Points With STAR Format — DevPlaybook](https://devplaybook.cc/blog/software-engineer-resume-50-bullet-points-star-format/)
- [Resumes with Impact: Strong Bullet Points — Columbia Career Education](https://www.careereducation.columbia.edu/resources/resumes-impact-creating-strong-bullet-points)
- [Targeted Resume / Keyword scan — Resume Worded](https://resumeworded.com/targeted-resume)
- [Resume Job Description Match — Teal](https://www.tealhq.com/tool/resume-job-description-match)
- [Typography Trends in Resume Design for 2026 — Resumee](https://myresumee.com/blog/bzg-typography-trends-in-resume-design-for-2026)
- [Minimalist Resume Templates — Enhancv](https://enhancv.com/resume-templates/minimalist/)
