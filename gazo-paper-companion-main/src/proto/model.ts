// Prototype data model (design-only; the real app keeps its own IndexedDB model).
export type DocType = "Rēķins" | "Līgums" | "Iesniegums" | "Pavadzīme" | "Cits";
export const DOC_TYPES: DocType[] = ["Rēķins", "Līgums", "Iesniegums", "Pavadzīme", "Cits"];
export type FieldKey = "number" | "sender" | "recipient" | "date" | "due" | "amount" | "currency";
export type FieldStatus = "check" | "missing" | "ok";
export type Field = { value: string; status: FieldStatus; source?: string };
export type DocData = {
  recognized: boolean;
  skipped: boolean;
  confirmed: boolean;
  demoFromPhoto: boolean;
  type: DocType;
  fields: Record<FieldKey, Field>;
};
export type Page = { id: string; demo?: number; src?: string; rotation: number; cropped: boolean };
export type Stage = "capture" | "pages" | "fields" | "pdf" | "done";
export type Draft = {
  id: string;
  createdAt: number;
  updatedAt: number;
  pages: Page[];
  splitMode: boolean;
  splits: string[];
  singleConfirmed: boolean;
  data: Record<string, DocData>;
  stage: Stage;
  activeDoc: number;
  exported: boolean;
  exportedNames: string[];
};

export const FIELD_SETS: Record<DocType, { key: FieldKey; label: string }[]> = {
  Rēķins: [
    { key: "number", label: "Rēķina numurs" },
    { key: "sender", label: "Nosūtītājs" },
    { key: "recipient", label: "Saņēmējs" },
    { key: "date", label: "Datums" },
    { key: "due", label: "Apmaksas termiņš" },
    { key: "amount", label: "Summa" },
    { key: "currency", label: "Valūta" },
  ],
  Pavadzīme: [
    { key: "number", label: "Pavadzīmes numurs" },
    { key: "sender", label: "Nosūtītājs" },
    { key: "recipient", label: "Saņēmējs" },
    { key: "date", label: "Datums" },
    { key: "amount", label: "Summa" },
    { key: "currency", label: "Valūta" },
  ],
  Līgums: [
    { key: "number", label: "Līguma numurs" },
    { key: "sender", label: "Puse 1" },
    { key: "recipient", label: "Puse 2" },
    { key: "date", label: "Noslēgšanas datums" },
  ],
  Iesniegums: [
    { key: "sender", label: "Iesniedzējs" },
    { key: "recipient", label: "Adresāts" },
    { key: "date", label: "Datums" },
  ],
  Cits: [
    { key: "number", label: "Numurs" },
    { key: "sender", label: "Nosūtītājs" },
    { key: "date", label: "Datums" },
  ],
};

const emptyField = (): Field => ({ value: "", status: "missing" });
export const emptyFields = (): Record<FieldKey, Field> => ({
  number: emptyField(), sender: emptyField(), recipient: emptyField(), date: emptyField(),
  due: emptyField(), amount: emptyField(), currency: emptyField(),
});
export const emptyData = (): DocData => ({
  recognized: false, skipped: false, confirmed: false, demoFromPhoto: false, type: "Rēķins", fields: emptyFields(),
});

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newDraft(): Draft {
  const now = Date.now();
  return {
    id: uid(), createdAt: now, updatedAt: now, pages: [], splitMode: false, splits: [],
    singleConfirmed: false, data: {}, stage: "capture", activeDoc: 0, exported: false, exportedNames: [],
  };
}

export function splitDocs(d: Draft): Page[][] {
  const out: Page[][] = [];
  d.pages.forEach((p, i) => {
    if (i === 0 || (d.splitMode && d.splits.includes(p.id))) out.push([p]);
    else out[out.length - 1]!.push(p);
  });
  return out;
}
export const dataFor = (d: Draft, doc: Page[]) => (doc[0] && d.data[doc[0].id]) || emptyData();

export function needsSingleConfirm(d: Draft) {
  return d.pages.length > 1 && !d.splitMode && !d.singleConfirmed;
}

/** Synthetic demo results — NEVER produced from a user's photo. */
export function demoRecognition(firstPage: Page): DocData {
  const f = emptyFields();
  if (firstPage.demo === undefined) {
    return { ...emptyData(), recognized: true, demoFromPhoto: true, type: "Cits", fields: f };
  }
  if (firstPage.demo === 3) {
    f.number = { value: "LĪG-2026/32", status: "check", source: "Lapa 1 · „Līgums Nr. LĪG-2026/32”" };
    f.sender = { value: "SIA Rīgas Remontdarbi (demo)", status: "check", source: "Lapa 1 · „Izpildītājs: SIA Rīgas Remontdarbi”" };
    f.recipient = { value: "Jānis Bērziņš", status: "check", source: "Lapa 1 · „Pasūtītājs: Jānis Bērziņš”" };
    f.date = { value: "28.10.2026", status: "check", source: "Lapa 1 · „Rīgā, 2026. gada 28. oktobrī”" };
    return { ...emptyData(), recognized: true, type: "Līgums", fields: f };
  }
  f.number = { value: "GD-2026/0147", status: "check", source: "Lapa 1 · „Rēķins Nr. GD-2026/0147”" };
  f.sender = { value: "SIA Ziemeļu Siltums (demo)", status: "check", source: "Lapa 1 · augšējā kreisā daļa" };
  f.recipient = { value: "Jānis Bērziņš", status: "check", source: "Lapa 1 · „Maksātājs: Jānis Bērziņš”" };
  f.date = { value: "03.11.2026", status: "check", source: "Lapa 1 · „Datums: 03.11.2026”" };
  f.due = { value: "", status: "missing", source: "Lapa 1 · teksts ir izplūdis, nav salasāms" };
  f.amount = { value: "128,40", status: "check", source: "Lapa 2 · „Kopā apmaksai: 128,40 EUR”" };
  f.currency = { value: "EUR", status: "check", source: "Lapa 2 · „EUR”" };
  return { ...emptyData(), recognized: true, type: "Rēķins", fields: f };
}

export function countChecks(data: DocData) {
  const keys = FIELD_SETS[data.type].map((x) => x.key);
  return {
    check: keys.filter((k) => data.fields[k].status === "check").length,
    missing: keys.filter((k) => data.fields[k].status === "missing" && !data.fields[k].value).length,
    ok: keys.filter((k) => data.fields[k].status === "ok").length,
    total: keys.length,
  };
}

export type DraftStatus = { label: string; tone: "success" | "primary" | "warning" | "muted" };
export function draftStatus(d: Draft): DraftStatus {
  if (d.exported) return { label: "Lejupielādēts", tone: "success" };
  if (!d.pages.length) return { label: "Nav lapu", tone: "muted" };
  if (d.stage === "pdf" || d.stage === "done") return { label: "Gatavs eksportam", tone: "primary" };
  if (d.stage === "fields") return { label: "Jāpārbauda dati", tone: "warning" };
  return { label: "Jāpārbauda lapas", tone: "warning" };
}

export function draftTitle(d: Draft) {
  const docs = splitDocs(d);
  if (!docs.length) return "Jauns dokuments";
  const data = dataFor(d, docs[0]!);
  const base = data.recognized && !data.skipped ? `${data.type}${data.fields.number.value ? " " + data.fields.number.value : ""}` : "Skenēts dokuments";
  return docs.length > 1 ? `${base} + vēl ${docs.length - 1}` : base;
}

export function relTime(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "tikko";
  if (m < 60) return `pirms ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `pirms ${h} h`;
  return new Date(ts).toLocaleDateString("lv-LV");
}
