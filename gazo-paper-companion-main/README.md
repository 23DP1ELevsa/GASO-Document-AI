# Gazo Paper Companion

Build a COMPLETE, exceptionally intuitive, high-quality, MOBILE-ONLY UX/UI redesign prototype for "GASO Document AI". This is a phone application, NOT a desktop dashboard or website. The user is a Latvian field worker or nontechnical person who needs to photograph paper invoices/contracts/applications, recognize important fields, review them and save a PDF. Our current real application already exists: https://github.com/23DP1ELevsa/GASO-Document-AI (Vue 3 + Vuetify 3 + Capacitor Android, IndexedDB, local image correction, local Tesseract.js OCR, document grouping, structured field cards, PDF export using pdf-lib). THIS LOVABLE PROJECT IS AN INDEPENDENT DESIGN PROTOTYPE: do not connect to or modify that GitHub repository, do not introduce a server/backend/database/OpenAI calls or ask for API keys, do not pretend mock data is real AI results. The eventual implementation will be ported into the Vue/Capacitor project via Codex. Build a fully clickable interactive prototype with polished visual design and thoughtful UX; use synthetic Latvian mock invoice data explicitly identified as demo data and optional local file selection. Do not use users' real private documents or transmit any files to any remote service.

CRITICAL UX OBJECTIVE: A FIRST-TIME, NONTECHNICAL USER should confidently complete the core job in as few actions as possible: START -> TAKE PHOTO/UPLOAD -> REVIEW PAGES -> REVIEW IMPORTANT FIELDS -> DOWNLOAD PDF. Eliminate cognitive load. Don't expose terms OCR, IndexedDB, JSON, worker, schemas, group IDs or AI jargon. Users should understand one primary action on every screen. Use short, natural, precise LATVIAN interface copy. The interface must be gorgeous, genuinely mobile-native feeling, not a generic SaaS/dashboard, not busy, not giant hero sections and marketing, no desktop sidebar. Target 360x780 and 390x844 Android phones, safe area insets, reachable thumbs, Android back behavior, touch targets >= 44px, accessible type and contrast, sticky bottom CTA above bottom nav and gesture bar; responsive up to 430px, wider browser just centers a realistic phone-width surface. Primary light theme: fresh clean off-white / pale slate, restrained GASO-adjacent blue (do not copy protected company logos), modern typography, smooth animations, soft but restrained cards, beautiful iconography, clear hierarchy. Optional dark theme.

Design the following COMPLETE user journey and all screens with ACTUAL CLICKABLE navigation and meaningful state, not static unrelated pictures:

1. START SCREEN ("Sākums"): a friendly short headline "Dokuments gatavs dažu soļu laikā" or better copy; prominent camera-focused "Skenēt dokumentu" action; secondary "Pievienot no galerijas"; recent draft(s) section "Turpināt iesākto" only if drafts exist; concise privacy note "Dokumenti tiek apstrādāti ierīcē" (for prototype). No competing workflow description hero.

2. CAPTURE / IMPORT: highly usable camera capture/import interface (in prototype a clear simulated camera screen with explicit demo mode plus actual local image picker if feasible, no false claim about native camera; never upload file). Selected photo thumbnails and count, obvious "Pievienot vēl" and "Turpināt". Allow a single invoice with 1-3 pages with zero manual "create a group" actions. Edit page via a simple focused screen: rotate, crop (prototype can represent operations, don't pretend processing is real unless implemented), delete, reorder. Optional "Sadalīt vairākos dokumentos" in a subtle overflow/secondary action, with visual page boundaries and simple "Šeit sākas jauns dokuments"; no dropdown group management.

3. REVIEW PAGES: visually delightful large page thumbnails with number badges, clear reorder/move/edit controls, one CTA "Turpināt uz datiem". Default all pages are one document only once user confirms this; never silently blend different documents.

4. DOCUMENT UNDERSTANDING / STRUCTURED FIELDS: one actionable "Atpazīt dokumentu" button (runs demo animation + populates SYNTHETIC EXAMPLE invoice fields; labeled "Demonstrācijas dati" not actual AI). Put preview/photo at top, then EDITABLE important fields only: "Dokumenta veids" (Rēķins / Līgums / Iesniegums / Pavadzīme / Cits), "Numurs", "Nosūtītājs", "Saņēmējs", "Datums", "Apmaksas termiņš", "Summa", "Valūta". Demo recipient may be "Jānis Bērziņš" (synthetic). Distinguish status ("Pārbaudiet", "Nav atrasts", "Pārbaudīts") without complicated three-column tables. Be honest about uncertainty; missing items blank rather than invented. Reveal only document-type appropriate fields. Show compact "Datu avots" for advanced users, not 3-column OCR table. Make keyboard/input use smooth and work with mobile scrolling. One primary CTA "Apstiprināt un turpināt". Allow skipping recognition and exporting scan-only PDF without forced field editing.

5. PDF READY: delightful clear summary, scan thumbnails, page count, verification status, simple A/B choice "PDF ar informāciju" vs "Tikai skenējums" with sensible defaults and explicit explanation of confirmed info; big CTA "Lejupielādēt PDF", secondary "Priekšskatīt". If PDF generation isn't wired in demo, mark it explicitly as prototype (a real generated downloadable sample PDF using current mock data is a plus, but no lying). Advanced PDF page sizes/quality tucked behind "Papildu iestatījumi". Success state with "Gatavs!" and next action.

6. DOCUMENTS / DRAFTS: light simple document cards, last updated, document type, progress ("Jāpārbauda dati", "Gatavs eksportam"), "Turpināt" and overflow menu. Don't mislabel exported files as cloud-stored archive. A minimal settings screen via icon.

7. OPTIONAL MULTIDOCUMENT mode: visually divide several pages into two documents using intuitive separators and document cards; then review each as its own flow; users shouldn't see complex grouping until explicitly requested.

Design interaction principles:
- Persistent sticky next-action footer with current step "1 no 4", back navigation, autosave status (if actually saved in prototype) and 1 dominant CTA.
- Smart progressive disclosure. Remove extraneous technical settings, dense tables, multiple competing buttons and redundant dialogs.
- No fictitious working scanner, AI or document-processing engine. Prototype/mock content explicitly labeled. Buttons must perform sensible prototype interactions rather than inert stubs. All demo data synthetic.
- Appropriate empty, loading, error, unsaved, completed states.
- Mobile gestures and accessible focus; correct LV text.
- The flow must allow quick skip to scanned-pages-only PDF for non-AI users.
- All screen content should be easy to understand without training.

IMPORTANT FOR TRANSFER TO EXISTING REAL PROJECT: include a visible accessible "Dizaina specifikācija" / developer guide or a concise design implementation spec in the project with design tokens, spacing, type scale, navigation/screen map, component inventory, exact Latvian labels and state transitions, and a clear mapping to the existing Vue components: HomeView.vue, ScanView.vue, DocumentGroups.vue, DocumentInformation.vue, ScanPageCard.vue, PdfExportDialog.vue, DocumentsView.vue. Specify that it is a DESIGN ONLY concept and should not replace the existing data/OCR/PDF engine or IndexedDB data model. Keep implementation self-contained. Favor polished experience over feature breadth. Build the full design now.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b9041bec-8b40-47c6-9662-887883cdca3e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
