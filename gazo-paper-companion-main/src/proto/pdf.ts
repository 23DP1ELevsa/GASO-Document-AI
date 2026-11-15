// Real, fully local PDF generation for the prototype (pdf-lib). No network.
import { PDFDocument } from "pdf-lib";
import { FIELD_SETS, type DocData, type Page } from "./model";
import { pageSrc } from "./demo-pages";

export type PdfOptions = { withInfo: boolean; size: "A4" | "Letter" | "fit"; quality: "standard" | "high" };
const SIZES = { A4: [595.28, 841.89], Letter: [612, 792] } as const;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
const toBytes = (c: HTMLCanvasElement, type: string) =>
  new Promise<Uint8Array>((res, rej) =>
    c.toBlob((b) => (b ? b.arrayBuffer().then((a) => res(new Uint8Array(a))) : rej(new Error("blob"))), type, 0.86),
  );

async function rasterize(p: Page, quality: PdfOptions["quality"]) {
  const img = await loadImage(pageSrc(p));
  const inset = p.cropped ? 0.04 : 0;
  const sw = img.naturalWidth * (1 - inset * 2), sh = img.naturalHeight * (1 - inset * 2);
  const max = quality === "high" ? 2200 : 1400;
  const scale = Math.min(1.6, max / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const rot = ((p.rotation % 360) + 360) % 360;
  const c = document.createElement("canvas");
  c.width = rot % 180 ? h : w;
  c.height = rot % 180 ? w : h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, img.naturalWidth * inset, img.naturalHeight * inset, sw, sh, -w / 2, -h / 2, w, h);
  return { bytes: await toBytes(c, "image/jpeg"), w: c.width, h: c.height };
}

async function summaryPage(data: DocData) {
  const c = document.createElement("canvas");
  c.width = 1240; c.height = 1754;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#1d4ed8"; x.fillRect(0, 0, c.width, 14);
  x.fillStyle = "#1f2a3d"; x.font = "700 56px Arial"; x.fillText("Dokumenta kopsavilkums", 110, 190);
  x.fillStyle = "#6b7486"; x.font = "28px Arial";
  x.fillText("Prototips · lauku vērtības ievadītas vai apstiprinātas lietotāja ierīcē.", 110, 245);
  let y = 350;
  const rows: [string, string, string][] = [["Dokumenta veids", data.type, "Pārbaudīts"]];
  for (const f of FIELD_SETS[data.type]) {
    const v = data.fields[f.key];
    rows.push([f.label, v.value || "—", v.status === "ok" ? "Pārbaudīts" : v.value ? "Nav pārbaudīts" : "Nav atrasts"]);
  }
  for (const [label, value, st] of rows) {
    x.fillStyle = "#6b7486"; x.font = "26px Arial"; x.fillText(label, 110, y);
    x.fillStyle = "#1f2a3d"; x.font = "700 38px Arial"; x.fillText(value.slice(0, 42), 110, y + 50);
    x.fillStyle = st === "Pārbaudīts" ? "#15803d" : "#a16207"; x.font = "600 24px Arial";
    x.fillText(st, 1130 - x.measureText(st).width, y + 48);
    x.fillStyle = "#e3e7ee"; x.fillRect(110, y + 84, 1020, 2);
    y += 140;
  }
  x.fillStyle = "#8a93a4"; x.font = "24px Arial";
  x.fillText("Sekojošās lapas: oriģinālais skenējums.", 110, 1660);
  return { bytes: await toBytes(c, "image/png"), w: c.width, h: c.height, png: true };
}

export async function buildPdf(pages: Page[], data: DocData, opt: PdfOptions): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(data.recognized && !data.skipped ? `${data.type} ${data.fields.number.value}`.trim() : "Skenēts dokuments");
  pdf.setProducer("GASO Document AI — dizaina prototips");
  const imgs: { bytes: Uint8Array; w: number; h: number; png?: boolean }[] = [];
  if (opt.withInfo && data.recognized && !data.skipped) imgs.push(await summaryPage(data));
  for (const p of pages) imgs.push(await rasterize(p, opt.quality));
  for (const im of imgs) {
    const emb = im.png ? await pdf.embedPng(im.bytes) : await pdf.embedJpg(im.bytes);
    let pw: number, ph: number;
    if (opt.size === "fit") { pw = im.w * 0.5; ph = im.h * 0.5; }
    else { [pw, ph] = SIZES[opt.size]; if (im.w > im.h) [pw, ph] = [ph, pw]; }
    const page = pdf.addPage([pw, ph]);
    const s = Math.min(pw / im.w, ph / im.h);
    page.drawImage(emb, { x: (pw - im.w * s) / 2, y: (ph - im.h * s) / 2, width: im.w * s, height: im.h * s });
  }
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export function pdfName(data: DocData, i: number) {
  const base = data.recognized && !data.skipped
    ? `${data.type}-${data.fields.number.value || data.fields.date.value || "dokuments"}`
    : `Skenejums-${new Date().toISOString().slice(0, 10)}`;
  return `${base}${i ? "-" + (i + 1) : ""}`.replace(/[\\/:*?"<>|\s]+/g, "-") + ".pdf";
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
