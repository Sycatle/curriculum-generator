# Veille — Automatiser les candidatures et les brancher sur cv-generator

_Date : 2026-05-11_

## Context

Le projet `cv-generator` est déjà mature : Next.js 15 + Postgres/Drizzle, templates PDF `modern` et `ats`, assistant Claude avec tool-calling (rewrite, retarget), import OCR, snapshots, partage public. Tout ce qu'il faut pour produire **un CV ciblé par offre en quelques secondes**.

Manque la moitié aval du flux : **trouver les offres pertinentes** et **soumettre la candidature** (CV adapté + lettre + formulaire). Objectif : full-auto avec personnalisation LLM par employeur, propre, sans se faire bannir, avec un livrable de veille pour décider de l'architecture.

**Périmètre élargi (mai 2026)** : en plus des offres publiées (ATS, job boards), pipeline de **candidatures spontanées en masse** vers les entreprises tech/dev/data/IA susceptibles de correspondre au profil. Profil : **bilingue FR/EN, full remote**, géographies cibles = Paris, Lyon, Marseille, Bordeaux, Londres + grandes villes EU (Berlin, Amsterdam, Barcelone, Dublin, Lisbonne, Stockholm) et US (NYC, SF, Austin, Boston, Remote US). Volume cible : plusieurs centaines d'entreprises ciblées/semaine, personnalisation par société (langue + activité + lien profil).

---

## 1. État de l'art — sourcing (récupérer les offres)

### 1.1. APIs officielles (à privilégier toujours)

| Source | Endpoint / accès | Auth | Verdict |
|---|---|---|---|
| **France Travail** (ex-Pôle Emploi) | `api.francetravail.io` — "Offres d'emploi v2" | OAuth client_credentials gratuit | **Référence FR.** Inclut beaucoup d'offres APEC/partenaires syndiquées. Quotas généreux. |
| **Greenhouse Job Board API** | `GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true` | Aucune | Public, propre, JSON structuré. Couvre énormément de scale-ups US/EU. |
| **Lever** | `GET https://api.lever.co/v0/postings/{company}?mode=json` | Aucune | Idem, filtres `team`/`location`/`commitment` natifs. |
| **Ashby** | `GET https://api.ashbyhq.com/posting-api/job-board/{org}` | Aucune | Croissant chez les startups. |
| **Workday** | `POST https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` | Aucune (mais pattern variable par employeur) | Pas une API "officielle" mais endpoint JSON exploité par leur propre frontend. Pagination offset. Variabilité `wd1/wd3/wd5`. |
| **SmartRecruiters** | `api.smartrecruiters.com/v1/companies/{id}/postings` | Aucune | OK. |

➡️ **Règle d'or** : ces 5-6 ATS couvrent ~70 % des offres tech que tu vises. Pas besoin de scraper LinkedIn pour la majorité de ces postes — l'offre LinkedIn redirige souvent vers l'ATS de toute façon.

### 1.2. Sources sans API → scraping HTTP/HTML

| Source | Stratégie | Risque |
|---|---|---|
| **Welcome to the Jungle** | Pas d'API publique. GraphQL interne accessible via reverse-eng, ou Apify connector `bebity/welcome-to-the-jungle-jobs-scraper`. Beaucoup d'offres redistribuées sur APEC/France Travail → souvent inutile de scraper directement. | Faible (HTML stable, pas de captcha agressif). |
| **APEC** | HTML + JSON embedded. WTTJ multi-distribue vers APEC, donc France Travail capture une partie. | Faible. |
| **Indeed** | HTML + API mobile non documentée. `JobSpy` gère. | Moyen — rate limit IP. |
| **Glassdoor** | Plus dur (Cloudflare). `JobSpy` y arrive avec proxies. | Moyen-élevé. |
| **Hacker News "Who's Hiring"** | Algolia API : `https://hn.algolia.com/api/v1/search?tags=story,author_whoishiring`. | Nul. **Or à ciel ouvert.** |
| **Wellfound / RemoteOK / Otta** | RemoteOK : feed JSON officiel `remoteok.com/api`. Wellfound/Otta : scraping HTML. | Faible. |

### 1.3. LinkedIn — zone rouge

État 2026 : LinkedIn a déployé du **session fingerprinting + détection comportementale** (Q1 2026). Apollo.io, Seamless.ai, HeyReach bannis publiquement en 2025-2026. Easy Apply via bot = ban quasi-garanti à moyen terme sur un compte personnel.

**Recommandations** :
- Ne **jamais** automatiser l'envoi d'Easy Apply depuis ton compte LinkedIn personnel.
- Pour le **sourcing only**, deux options :
  - **JobSpy** avec proxies résidentiels rotatifs (rate-limit ~10 pages/IP), volume faible et humain.
  - Mieux : utiliser LinkedIn comme **trigger manuel** — tu sauvegardes des URLs d'offres, le système suit l'URL jusqu'à l'ATS sous-jacent (Greenhouse/Lever/Workday) et applique via celui-ci. LinkedIn devient une "vitrine", pas une source scrapée.

### 1.4. Librairies OSS — scoring

| Outil | Stack | Couverture | Maintenance | Verdict |
|---|---|---|---|---|
| **JobSpy** ([speedyapply/JobSpy](https://github.com/speedyapply/JobSpy)) | Python, pandas | LinkedIn, Indeed, Glassdoor, Google, ZipRecruiter, Bayt, Naukri | Active, 2.5k DL/sem | **Référence pour multi-board sourcing.** TS port `ts-jobspy` existe mais moins maintenu. |
| **JobFunnel** | Python | LinkedIn, Indeed, Monster | Stable, moins active | Vieillissant. |
| **AIHawk / Jobs_Applier_AI_Agent** ([feder-cr/Jobs_Applier_AI_Agent_AIHawk](https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk)) | Python + Selenium + OpenAI | LinkedIn Easy Apply principalement | Active mais polémique | Couvre sourcing **et** apply. Risque ban élevé. À étudier pour les *patterns* d'agent, pas à utiliser tel quel. |

➡️ **Choix** : pour la couche sourcing, **JobSpy + connecteurs ATS officiels maison** (Greenhouse/Lever/Workday/France Travail) + **Algolia HN**. JobSpy seulement pour Indeed/Glassdoor/LinkedIn fallback, derrière proxies.

---

## 2. État de l'art — submission (envoyer la candidature)

### 2.1. ATS avec API d'application

| ATS | Endpoint apply | Auth | Pratique ? |
|---|---|---|---|
| **Greenhouse Job Board** | `POST https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{id}` (multipart) | Aucune côté candidat | **Oui** — submit propre, CV en pièce jointe, custom fields normalisés. |
| **Lever** | Apply via redirection sur leur formulaire hosted. Pas d'endpoint candidat documenté. | — | Non — passer par browser auto. |
| **Workday** | Création de compte candidat obligatoire + flow multi-étapes. Pas d'API publique. | — | Non — agent browser only. |
| **Ashby** | Quelques jobs exposent un endpoint apply, mais inconsistant. | — | Partiel. |

➡️ **Greenhouse = couloir privilégié**. Soumission API-native, idempotente, traçable.

### 2.2. Agents browser pour les formulaires non-API

Pour Workday, Lever hosted, formulaires custom, etc. : pas le choix, il faut **piloter un navigateur**. Trois écoles :

| Approche | Outil | Avantages | Inconvénients |
|---|---|---|---|
| **Playwright pur + sélecteurs codés** | `playwright` | Rapide, déterministe, déjà utilisé dans cv-generator (`playwright.config.ts`) | Casse à chaque refonte de formulaire. Maintenance N×ATS. |
| **Agent LLM browser** | **Stagehand v3** ([browserbase/stagehand](https://github.com/browserbase/stagehand)) | `act()`/`extract()`/`observe()` en langage naturel, **cache d'actions** (replay <100ms sans appel LLM), TypeScript natif | Coût LLM par flow nouveau ; nécessite Browserbase ou navigateur local. |
| **Agent spécialisé form-filling** | Skyvern 2.0 | Meilleur sur WebVoyager pour "WRITE" tasks (85.85%) | Python, plus lourd. |

➡️ **Recommandation** : **Stagehand** en TS (homogène avec la stack Next.js), cache actions par "famille" d'ATS (Workday vX, Lever hosted, etc.). Première candidature sur un ATS = découverte LLM coûteuse ; les suivantes = replay quasi-gratuit.

### 2.3. Auto-fill côté navigateur — extensions

État de l'art produit 2026 : **Simplify** (gratuit, autofill Workday/Greenhouse/Lever/Ashby + LinkedIn Easy Apply, mais CV unique), **NeuraClick**, **JobPilotX**. Modèle commun : extension Chrome qui lit le DOM et remplit.

Pas pertinent pour ton cas (tu veux du full-auto serveur, pas un assistant manuel), **mais** : étudier leur mapping `champ formulaire → champ CV` est utile — c'est le même travail à faire côté serveur.

### 2.4. Email-only fallback

Pour les offres qui n'exposent qu'un email RH (PME, cabinets de recrutement) : SMTP via `nodemailer` (déjà dans `package.json`), templating lettre + CV PDF attaché. Très fiable, zéro risque de ban.

---

## 3. Personnalisation LLM par employeur

Tu as déjà tout côté CV : `lib/ai/` avec Anthropic SDK + agent tool-calling + retarget. Le pipeline candidature exploite ça :

1. **Extraction structurée de l'offre** : title, company, JD complète, requirements (tools Claude existants sur l'OCR — pattern identique).
2. **Scoring fit** : LLM compare la JD à `CvData` → score 0-100 + bullet-points "ce qui matche" / "gap".
3. **Retarget CV** : appel à la chaîne existante `agent loop` avec un prompt "adapte le CV à cette JD, garde A4 single-page". Snapshot créé automatiquement.
4. **Génération lettre** : nouveau template `lib/cover/` (similaire à `lib/pdf/`), prend `CvData` + JobDescription, sort un PDF.
5. **Mapping formulaire ATS** : Claude prend le snapshot DOM (via Stagehand `observe()`) + `CvData` et produit un mapping champ→valeur. Cache par signature DOM.

Coût Claude par candidature : ~$0.05-0.15 selon longueur JD (avec cache prompt sur le template système). Avec **prompt caching** activé (cache du système et du `CvData`), divisé par ~5 sur le 2e job d'une même session.

---

## 3bis. Pipeline candidature spontanée en masse (cold outreach)

Les ATS publient seulement ce qu'ils recrutent activement. Tu veux **aussi** taper toutes les entreprises *susceptibles* d'avoir besoin d'un profil comme le tien — y compris celles qui n'ont aucune offre publiée. C'est de la candidature spontanée à l'échelle.

### 3bis.1. Sources de découverte d'entreprises (pas d'offres, juste des sociétés)

| Source | Couverture | Données | Coût |
|---|---|---|---|
| **Google Maps / Places** via [Apify Google Maps Scraper](https://apify.com/compass/crawler-google-places) | Mondiale, search par ville + keyword ("software company", "AI startup", "SaaS") | nom, addr, site, tel, catégorie, reviews | ~$0.016/résultat, 5k gratuits/mois sur free tier |
| **Google Places API** (officielle) | Mondiale | Idem mais plus pauvre que le scraper | $32 / 1000 nearby search — cher |
| **INSEE Sirene** (open data FR) | Toutes entreprises FR | SIREN, NAF, effectif, adresse | Gratuit, API officielle |
| **Pappers API** | FR + augmenté (bilans, dirigeants) | Recherche par activité NAF (62.01Z, 62.02A, 63.11Z pour tech), filtres effectif/CA | Freemium, ~50€/mois pour usage sérieux |
| **Companies House API** (UK) | Toutes entreprises UK | Officers, accounts, SIC codes | Gratuit |
| **Crunchbase / Dealroom / F6S / Station F** | Startups tech mondial | Funding, stack, taille, fondateurs | Crunchbase API $99+/mo ; Dealroom partenariat ; F6S/StationF scraping HTML |
| **TheirStack** | 100M+ jobs scrapés + entreprises tech | Détecte le stack technique (utile pour matching profil) | Freemium |
| **Wellfound / LinkedIn pages Entreprise** | Tech mondial | Taille, secteur, recrutement actif | Scraping prudent (cf. risques LinkedIn) |
| **GitHub org + jobs.txt convention** | Open-source first companies | Repos, langages, tech stack | API GitHub officielle, gratuite |

➡️ **Stratégie** : combiner Sirene/Pappers pour la base FR + Apify Google Maps par ville × catégorie pour le reste EU/US + Crunchbase pour les startups financées. Dédup par domaine web (`example.com`) qui devient la **clé canonique d'une entreprise**.

### 3bis.2. Enrichissement contacts (trouver l'email recruteur)

| Outil | Couverture | RGPD | Budget |
|---|---|---|---|
| **Dropcontact** | 94% FR, 62% US | **Audité CNIL, 100% RGPD-compliant** (génération en temps réel, pas de base) | ~99€/mois pour ~1000 enrichissements |
| **Hunter.io** | 100M+ emails, fort US | Base scrapée, RGPD plus discutable | $34-$104/mois |
| **Apollo.io** | 275M contacts, fort US/EN | Base scrapée, opt-out reverse-lookup nécessaire | $49+/mois (banni de LinkedIn 2025) |
| **Snov.io / FindThatLead** | Multi-source | Variable | Moins cher, moins fiable |

➡️ **Recommandation** : **Dropcontact en primaire** (FR principalement + couverture EU correcte + sécurité légale), **Hunter en secondaire** pour les domaines US/UK où Dropcontact est plus faible. Cibler **les emails génériques** (`careers@`, `jobs@`, `hello@`, `contact@`) **et** un contact nominatif (CTO, Head of Engineering, Talent) selon la taille de la boîte.

### 3bis.3. Infrastructure d'envoi (deliverability sérieuse)

**Position officielle Resend** (sources : [resend.com/legal/acceptable-use](https://resend.com/legal/acceptable-use)) :
- Cold email **autorisé** s'il est : personnalisé, B2B (adresse pro), avec disclosure du motif, unsubscribe fonctionnel honoré sous 7j, valeur perçue.
- Cold email **interdit** s'il est : mass non-personnalisé, sans opt-out, vers adresses perso scrapées.

➡️ **Tu peux rester sur Resend Pro** si chaque envoi est **vraiment personnalisé par LLM** (différent à chaque destinataire — pas du templating avec variables) et inclut une mention "Vous recevez ce message parce que [raison liée à l'entreprise]" + lien désabonnement. C'est ce que produit le pipeline LLM de toute façon, donc c'est compatible.

**Architecture mail recommandée** :
- **Domaine dédié** (ex. `mail.yourname.dev`) ou sous-domaine, séparé du domaine principal — protège ta réputation principale en cas de plainte.
- **SPF + DKIM + DMARC** (Resend les configure automatiquement) avec policy `p=quarantine` initialement.
- **Warmup** progressif : 10 mails/jour la 1ère semaine, +10/jour ensuite, plafond 200/jour/mailbox pour rester sous le radar des FAI.
- **Plusieurs mailboxes** rotation (Resend Pro permet plusieurs domaines vérifiés) → 3-5 sous-domaines × 50/jour = 150-250 envois/jour de qualité.
- **Tracking** : Resend gère bounces, complaints, unsubscribes — exposer ces signaux dans le pipeline pour blacklister auto.
- **Suivi (follow-up)** : 1 relance max à J+5, formuler différemment, jamais 3 relances.

**Si tu veux vraiment >1000 cold mails/sem** : sortir de Resend (qui finira par t'auditer) vers **Smartlead** ou **Instantly** (10-20 mailboxes Google Workspace + Outlook warmées, $39-99/mo). Mais à ce volume, la conversion s'effondre — quality > quantity reste la règle.

### 3bis.4. Filtrage multi-villes / remote-first / bilingue

Filtre `lib/jobs/matching.ts` étendu :
- **Localisation acceptable** : `["Remote", "Remote EU", "Remote Worldwide", "Hybrid"]` ∪ ville ∈ liste cible (Paris, Lyon, Marseille, Bordeaux, Londres, Berlin, Amsterdam, Barcelone, Dublin, Lisbonne, Stockholm, NYC, SF, Austin, Boston, Remote US).
- **Détection langue de l'entreprise** : page d'accueil → Claude classe `lang ∈ {fr, en, both}`. Si entreprise FR avec site EN-only → email en EN par défaut.
- **Génération bilingue** : Claude produit lettre + email dans la langue détectée, signature uniforme. Cache la version "base" en FR et EN, retarget juste la partie sur l'entreprise.
- **Tag fit_remote** : Boolean inferé du site/JD (chercher "remote-friendly", "distributed team", "anywhere", "EMEA", "GMT±X").

### 3bis.5. Légal — RGPD / GDPR / CAN-SPAM

- **Base légale RGPD** : intérêt légitime (Art. 6.1.f) pour prospection B2B vers adresses pro (`careers@`, `jobs@`, ou contact nominatif lié à la fonction). Pas d'opt-in préalable requis, mais opt-out doit être **immédiat** et **respecté à vie**.
- **Adresses pro uniquement** — jamais d'adresses perso, jamais de domaines gratuits (gmail, outlook.com) sauf si la personne se présente officiellement avec.
- **CAN-SPAM (US)** : sender identification, adresse physique en footer, mécanisme désabonnement clair, honoré sous 10 jours.
- **CASL (Canada)** : strict — opt-in préalable requis. Exclure Canada du pipeline auto par défaut.
- **Registre des envois** : table `outreach_messages` avec `recipient_email`, `unsubscribed_at`, contrainte "ne jamais réenvoyer à un opted-out".
- **DPA** : signer un DPA avec Dropcontact (fourni standard) et Resend (dans leurs ToS).

---

## 4. Architecture — recommandation

Tu as demandé qu'on tranche entre **monorepo intégré** et **service séparé**. Voici la recommandation argumentée :

### Recommandation : **module dans le monorepo cv-generator**, structure isolée

```
lib/
  cv/          (existant — domaine CV pur)
  pdf/         (existant — rendu PDF)
  ai/          (existant — Claude + agent)
  cover/       NEW — template lettre, render PDF, miroir de lib/pdf/
  jobs/        NEW — domaine candidature (offres publiées + cold outreach)
    schema.ts          Zod (JobPosting, Company, Contact, JobApplication, ApplyResult)
    sources/           Connecteurs sourcing offres (un fichier par source)
      greenhouse.ts
      lever.ts
      workday.ts
      france-travail.ts
      hn-algolia.ts
      jobspy-bridge.ts   (process Python via spawn, ou ts-jobspy)
    companies/         Connecteurs découverte entreprises (cold outreach)
      apify-gmaps.ts   Google Maps via Apify actor
      sirene.ts        INSEE Sirene (FR)
      pappers.ts       Pappers (FR enrichi)
      companies-house.ts (UK)
      crunchbase.ts    Startups financées
      github-orgs.ts   Tech first
    enrich/
      dropcontact.ts   Enrichissement email RGPD-compliant (primaire FR/EU)
      hunter.ts        Enrichissement email (secondaire US/UK)
    submit/            Soumetteurs (un fichier par stratégie)
      greenhouse-api.ts
      browser-stagehand.ts   Workday + Lever hosted + formulaires "Contact"
      email-resend.ts        Cold outreach via Resend Pro (personnalisé LLM)
    matching.ts        Scoring fit JD/Entreprise ↔ CvData (Claude, multi-lang)
    lang-detect.ts     Détection FR/EN par site entreprise
    deliverability.ts  Rotation mailboxes, warmup, blacklist opt-outs
    pipeline.ts        Orchestration découverte → match → tailor → submit
app/
  api/jobs/
    sources/route.ts       POST: déclenche un crawl
    [id]/route.ts          GET: détail offre
    [id]/apply/route.ts    POST: lance le pipeline d'apply
  (dashboard)/jobs/        Nouvelle section UI (liste, kanban, détail)
workers/
  poll-sources.ts          Cron (Node, déclenché par GH Actions ou nodecron interne)
  apply-runner.ts          Job d'apply (queue Postgres, exécuté en background)
drizzle/
  0xxx_jobs.sql            Migration : tables jobs
```

**Justification** :
- **Réutilise auth, DB, `lib/cv/`, `lib/pdf/`, `lib/ai/`, secrets SOPS, Docker, Caddy** — zéro plomberie inter-services.
- Le domaine `jobs/` est **isolé du domaine `cv/`** (pas de dépendance inverse). `lib/cv/` reste pur, `lib/jobs/` consomme `CvData` en lecture seule + appelle `lib/pdf/` pour rendre les variantes.
- **Worker séparé** (process Node distinct) pour le polling cron et l'apply browser : ça évite de bloquer Next.js et permet de scaler horizontalement sans toucher au front.
- **Stagehand TS** s'intègre nativement, pas de bridge Python.
- Tu peux **sortir** en service séparé plus tard si tu veux open-sourcer le scraper indépendamment — l'isolation `lib/jobs/` te le permet sans refonte.

Le service séparé serait justifié uniquement si tu prévoyais :
- Multi-tenant SaaS avec rate-limiting fin par client.
- Stack non-TS pour le scraper (Python lourd, Scrapy).
- Déploiement scraper sur infra dédiée (IPs résidentielles, browser farm).

Aucun de ces critères n'est avéré aujourd'hui → monorepo gagne.

### Schéma DB additionnel (Drizzle)

```ts
// drizzle/schema/jobs.ts
export const jobSources = pgTable("job_sources", {
  id: text("id").primaryKey(),                // 'greenhouse:airbnb', 'france-travail', 'hn-2026-05'
  kind: text("kind").$type<"ats"|"board"|"hn"|"custom">().notNull(),
  config: jsonb("config").notNull(),          // { company, board_token, query, location }
  enabled: boolean("enabled").default(true),
  lastPolledAt: timestamp("last_polled_at"),
  userId: text("user_id").references(() => user.id).notNull(),
});

export const jobPostings = pgTable("job_postings", {
  id: text("id").primaryKey(),                // nanoid
  sourceId: text("source_id").references(() => jobSources.id).notNull(),
  externalId: text("external_id").notNull(),  // unique per source
  url: text("url").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  description: text("description").notNull(),
  raw: jsonb("raw").notNull(),                // payload brut source
  fetchedAt: timestamp("fetched_at").defaultNow(),
}, t => ({ uniq: unique().on(t.sourceId, t.externalId) }));

export const jobApplications = pgTable("job_applications", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id).notNull(),
  postingId: text("posting_id").references(() => jobPostings.id).notNull(),
  cvSnapshotId: text("cv_snapshot_id").notNull(), // CV variant utilisé
  coverLetterText: text("cover_letter_text"),
  status: text("status").$type<"queued"|"running"|"submitted"|"failed"|"skipped">().notNull(),
  fitScore: integer("fit_score"),
  submitStrategy: text("submit_strategy").$type<"greenhouse-api"|"stagehand"|"email"|"manual">(),
  submittedAt: timestamp("submitted_at"),
  error: text("error"),
  logs: jsonb("logs"),                        // trace agent + screenshots
});

// Cold outreach (candidature spontanée)
export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  domain: text("domain").notNull().unique(),    // clé canonique
  name: text("name").notNull(),
  country: text("country"),                     // ISO2
  city: text("city"),
  industry: text("industry"),                   // NAF / SIC / catégorie GMaps
  size: text("size"),                           // "1-10", "11-50", "51-200"...
  websiteLang: text("website_lang").$type<"fr"|"en"|"both">(),
  remoteFriendly: boolean("remote_friendly"),
  techStack: jsonb("tech_stack"),               // ["typescript","postgres","aws"]
  fitScore: integer("fit_score"),               // précomputé
  discoveredFrom: text("discovered_from"),      // 'apify-gmaps', 'sirene', 'crunchbase'
  raw: jsonb("raw").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  companyId: text("company_id").references(() => companies.id).notNull(),
  email: text("email").notNull(),
  emailKind: text("email_kind").$type<"generic"|"nominative">().notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  title: text("title"),
  source: text("source"),                       // 'dropcontact', 'hunter', 'manual'
  verified: boolean("verified").default(false),
  unsubscribedAt: timestamp("unsubscribed_at"), // RGPD — bloquer tout renvoi
  bouncedAt: timestamp("bounced_at"),
  complainedAt: timestamp("complained_at"),
}, t => ({ uniq: unique().on(t.companyId, t.email) }));

export const outreachMessages = pgTable("outreach_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id).notNull(),
  contactId: text("contact_id").references(() => contacts.id).notNull(),
  cvSnapshotId: text("cv_snapshot_id").notNull(),
  lang: text("lang").$type<"fr"|"en">().notNull(),
  subject: text("subject").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  fromAddress: text("from_address").notNull(), // pour rotation mailboxes
  resendMessageId: text("resend_message_id"),
  status: text("status").$type<"queued"|"sent"|"bounced"|"complained"|"replied"|"unsubscribed">().notNull(),
  sentAt: timestamp("sent_at"),
  followUpOf: text("follow_up_of"),             // référence message précédent
});

export const atsActionCache = pgTable("ats_action_cache", {
  id: text("id").primaryKey(),
  domSignature: text("dom_signature").notNull().unique(), // hash structure formulaire
  atsKind: text("ats_kind").notNull(),
  actions: jsonb("actions").notNull(),        // Stagehand replay
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

## 5. Plan d'intégration (MVP en 4 jalons)

### Jalon 1 — Sourcing read-only (1-2 j)

- Migrations `job_sources`, `job_postings`.
- 3 connecteurs : Greenhouse, Lever, France Travail (gratuit, JSON propre, ROI immédiat).
- Cron worker (`workers/poll-sources.ts`) toutes les 6h, dédup sur `(source_id, external_id)`.
- Page UI `/dashboard/jobs` : liste paginée filtrable (search, location, source).
- **Pas encore d'apply.** Tu valides le sourcing en regardant la liste.

### Jalon 2 — Matching + CV tailoring (1-2 j)

- `lib/jobs/matching.ts` : Claude prend `CvData` + JD → `{score, summary, gaps, suggestedKeywords}`. Prompt caching activé.
- Bouton "Tailor CV for this job" dans l'UI → réutilise l'agent `lib/ai/` existant pour produire un snapshot. Diff review obligatoire (déjà géré par le code actuel).
- Template lettre : `lib/cover/` avec 2-3 tons (formel, startup, exécutif), Claude génère la version courte (250 mots max).

### Jalon 3 — Submit Greenhouse API (1 j)

- `lib/jobs/submit/greenhouse-api.ts` : `POST` multipart avec `first_name`, `last_name`, `email`, `resume`, `cover_letter`, custom fields. Mapping basique depuis `CvData`.
- `app/api/jobs/[id]/apply` : POST → crée `job_applications` row en `queued`, push sur queue (table Postgres + LISTEN/NOTIFY ou Trigger.dev si tu préfères).
- Worker `apply-runner.ts` consomme la queue, exécute, log, met à jour status.
- **Premier vrai apply auto sur une vraie offre.**

### Jalon 4 — Submit Stagehand pour Workday + Lever hosted (2-3 j)

- `lib/jobs/submit/browser-stagehand.ts`.
- Mapping `CvData` ↔ champs DOM via Claude (one-shot par signature DOM), cache dans `ats_action_cache`.
- Sandbox via Browserbase (sessions isolées, screenshots) ou Playwright local headless en dev.
- Failure modes loggés dans `job_applications.logs` avec screenshots → reprise manuelle facile.

### Jalon 5 — Cold outreach mass spontané (3-4 j)

- Connecteurs `companies/` : Sirene (FR, gratuit) + Apify Google Maps (Paris, Lyon, Marseille, Bordeaux, Londres, Berlin, Amsterdam, Barcelone × keywords "software", "AI", "SaaS", "data") + Crunchbase (startups Series A-C tech).
- Enrichissement via Dropcontact (FR/EU) + Hunter (US/UK). Stocker un seul email pertinent par boîte (priorité : `careers@` > `jobs@` > nominatif Talent/CTO > `hello@`).
- `lang-detect.ts` : fetch homepage → Claude classe en `fr`/`en`/`both`.
- Filtre profil : `fit_remote === true` OR `city ∈ liste cible`, taille 11-500 (filtre out micro et trop gros).
- Génération message via Claude avec prompt caching (système + `CvData` + variants FR/EN) :
  - Subject + body 80-120 mots, mention spécifique société (tech stack, news, projet), CTA = "ouvert à un échange 15 min" + CV PDF en attachement.
  - Footer : raison du contact + unsubscribe (URL `/u/{token}` qui set `contacts.unsubscribed_at`).
- `deliverability.ts` : 3 sous-domaines Resend dédiés, rotation, warmup automatique (10→200/jour sur 4 semaines), respect `bounce/complaint` (>2% → pause).
- `submit/email-resend.ts` : envoi via `@resend/node`, capture `messageId`, webhook `/api/webhooks/resend` pour bounces/complaints/unsubscribes.
- Worker `cold-outreach-runner.ts` : consomme la queue, respecte quotas par mailbox, espace les envois (1 mail / 30-60s par mailbox).
- UI : tableau "Companies" (kanban : Discovered → Enriched → Contacted → Replied → Interview), réponses Resend (forward vers ta vraie inbox via filtre Gmail/Fastmail).

### Hors scope MVP

- LinkedIn Easy Apply auto (risque ban → fallback manuel ou semi-auto avec extension Simplify).
- Indeed/Glassdoor (passage à JobSpy + proxies à itérer plus tard).
- Multi-utilisateur : tu es seul utilisateur pour l'instant.

---

## 6. Verification end-to-end

Une fois implémenté :

1. **Sourcing** : `curl POST /api/jobs/sources/refresh` → `select count(*) from job_postings` augmente.
2. **Matching** : ouvrir une offre dans l'UI → "Tailor" → diff review → snapshot créé visible dans l'historique CV.
3. **Apply Greenhouse** : créer une `job_sources` pointant sur une offre de test (`vercel.greenhouse.io` ou un ATS sandbox), lancer apply → vérifier email de confirmation Greenhouse + row `submitted`.
4. **Apply Stagehand** : sur une offre Workday non-critique → screenshots dans logs, statut final OK.
5. **E2E Playwright** : test `tests/e2e/apply-flow.spec.ts` qui mock un endpoint ATS et vérifie le flow UI complet.
6. **Cold outreach** : trigger Sirene + Apify Gmaps sur Paris/Lyon → row companies remplie → enrichissement Dropcontact → `select count(*) from contacts where verified=true` > 0 → dry-run génération message en FR/EN (Claude) → preview UI → envoi réel sur 5 entreprises pilotes → vérifier delivery sur resend.com dashboard, bounce/complaint < 2%.
7. **RGPD opt-out** : appeler `/u/{token}` → vérifier `contacts.unsubscribed_at` set + le runner skip ce contact à la prochaine tentative.

---

## 7. Risques et garde-fous

- **LinkedIn** : pas d'automation côté compte personnel. Sourcing via JobSpy uniquement avec proxies, et seulement si Greenhouse/Lever/FT ne couvrent pas l'offre. Préférer suivre les redirections vers l'ATS sous-jacent.
- **Quotas API** : France Travail OAuth → respecter rate-limits documentés. Greenhouse/Lever : pas de quota officiel mais éviter le polling agressif (toutes les 6h max).
- **Qualité personnalisation** : un mauvais retarget pollue le pipeline et peut nuire à ton image. Le diff review obligatoire avant snapshot reste un garde-fou — ne pas le supprimer en full-auto sans une vérif programmatique (longueur, mots-clés, single-page).
- **Coût Claude** : prompt caching sur le système + `CvData`. Budget mensuel à monitorer dans `lib/ai/` (déjà instrumenté ?).
- **Idempotence apply** : clé `(user_id, posting_id)` unique → jamais postuler deux fois à la même offre.
- **Cold outreach — risque réputation domaine** : envoyer 1000+ cold mails depuis ton domaine principal peut le brûler à vie. Toujours passer par sous-domaine dédié (`outbound.yourname.dev`), warmup mandatory, blacklist agressive sur les rebonds.
- **Cold outreach — Resend ToS** : la policy autorise le cold **personnalisé** (cf. §3bis.3). Si tu génères 500 mails identiques avec juste `{{nom_entreprise}}` substitué, Resend te coupera. Le pipeline LLM doit produire des bodies **vraiment** différents — c'est le cas avec Claude par entreprise, mais c'est une discipline à tenir.
- **RGPD — opt-out à vie** : un seul `unsubscribed_at` rempli doit bloquer définitivement toute future relance. Test automatisé requis.
- **Spam traps** : Sirene contient des sociétés mortes/zombie qui ont des emails captés par les FAI comme spam traps. Filtrer sur `effectif > 0` et `date_dernier_traitement < 2 ans`.

---

## 8. Fichiers critiques à lire avant impl

- `lib/cv/` (schemas Zod, repository) — base de `CvData` pour matching.
- `lib/pdf/` — pattern pour répliquer `lib/cover/`.
- `lib/ai/` — agent loop + tool-calling, à étendre pour matching/retarget.
- `drizzle/` — convention migrations.
- `app/api/cv/import/route.ts` — pattern OCR multimodal réutilisable pour extraction JD.
- `app/api/cv/[id]/chat/route.ts` — pattern streaming NDJSON pour les logs d'apply temps réel.

---

## Sources

- [JobSpy — speedyapply/JobSpy](https://github.com/speedyapply/JobSpy)
- [AIHawk — feder-cr/Jobs_Applier_AI_Agent_AIHawk](https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk)
- [Stagehand v3 — browserbase/stagehand](https://github.com/browserbase/stagehand)
- [Greenhouse Job Board API](https://developers.greenhouse.io/job-board.html)
- [France Travail — API Offres d'emploi (data.gouv.fr)](https://www.data.gouv.fr/dataservices/api-offres-demploi)
- [6 ATS Platforms with Public Job Posting APIs — fantastic.jobs](https://fantastic.jobs/article/ats-with-api)
- [LinkedIn automation safety guide 2026 — GetSales](https://getsales.io/blog/linkedin-automation-safety-guide-2026/)
- [Stagehand vs Browser Use vs Playwright 2026 — NxCode](https://www.nxcode.io/resources/news/stagehand-vs-browser-use-vs-playwright-ai-browser-automation-2026)
- [Workday Scraper API — jobo.world](https://jobo.world/ats/workday)
- [Simplify Jobs / NeuraClick / LazyApply comparatif 2026](https://neuracv.com/blog/best-free-lazyapply-alternatives)
- [Resend Acceptable Use Policy](https://resend.com/legal/acceptable-use)
- [Apify Google Maps Scraper](https://apify.com/compass/crawler-google-places)
- [Dropcontact — review GDPR-compliant FR enrichment](https://salesdorado.com/en/automation/review-dropcontact/)
- [Hunter.io vs Apollo vs Dropcontact 2026](https://prospeo.io/s/dropcontact-vs-hunter)
- [Spamhaus on cold emailing](https://www.spamhaus.org/resource-hub/spam/spamhaus-take-on-cold-emailing-aka-spam/)
- [QuickMail — CAN-SPAM & GDPR compliance](https://quickmail.com/cold-email-compliance-and-laws)
- [INSEE Sirene API](https://api.insee.fr/catalogue/site/themes/wso2/subthemes/insee/pages/item-info.jag?name=Sirene&version=V3.11&provider=insee)
- [Pappers API](https://www.pappers.fr/api)
- [Companies House API (UK)](https://developer.company-information.service.gov.uk/)
