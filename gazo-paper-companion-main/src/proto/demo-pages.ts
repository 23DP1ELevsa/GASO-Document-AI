// Synthetic Latvian demo pages drawn as SVG. All names and numbers are fictional.
const W = 600, H = 848;
const t = (x: number, y: number, s: string, size = 14, weight = 400, fill = "#1f2a3d") =>
  `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${s}</text>`;
const lines = (y: number, n: number, w = 460) =>
  Array.from({ length: n }, (_, i) => `<rect x="60" y="${y + i * 18}" width="${w - (i % 3) * 60}" height="7" rx="3" fill="#d9dee7"/>`).join("");
const stamp = `<rect x="400" y="20" width="170" height="22" rx="4" fill="#fff4d6"/>${t(410, 36, "DEMONSTRĀCIJAS PARAUGS", 11, 700, "#9a6b00")}`;

const pages: string[] = [
  // 0 invoice page 1
  `${t(60, 80, "SIA Ziemeļu Siltums (demo)", 18, 700)}${t(60, 102, "Reģ. Nr. 40000000000 · Brīvības iela 1, Rīga", 11, 400, "#6b7486")}
   ${t(60, 160, "RĒĶINS Nr. GD-2026/0147", 24, 700, "#1d4ed8")}
   ${t(60, 195, "Datums: 03.11.2026", 13)}${t(60, 215, "Apmaksāt līdz:", 13)}
   <rect x="160" y="203" width="90" height="16" rx="3" fill="#c9ced8" opacity="0.9"/>
   ${t(330, 195, "Maksātājs: Jānis Bērziņš", 13, 700)}${t(330, 215, "Klienta Nr. 000123", 12, 400, "#6b7486")}
   <rect x="60" y="250" width="480" height="30" fill="#eef2f8"/>${t(70, 270, "Pakalpojums", 12, 700)}${t(440, 270, "Summa, EUR", 12, 700)}
   ${["Siltumenerģija, oktobris", "Karstā ūdens uzsilde", "Apkures sistēmas apkope", "Skaitītāja nolasīšana"].map((s, i) => `${t(70, 305 + i * 30, s, 13)}${t(460, 305 + i * 30, ["86,20", "24,10", "12,00", "6,10"][i]!, 13)}<rect x="60" y="${314 + i * 30}" width="480" height="1" fill="#e3e7ee"/>`).join("")}
   ${lines(460, 8)}${t(60, 800, "1. lapa no 3", 11, 400, "#8a93a4")}`,
  // 1 invoice page 2
  `${t(60, 80, "Rēķins Nr. GD-2026/0147 — turpinājums", 14, 700)}
   ${lines(110, 10)}
   <rect x="300" y="330" width="240" height="110" rx="8" fill="#eef2f8"/>
   ${t(320, 360, "Starpsumma: 106,12", 13)}${t(320, 382, "PVN 21%: 22,28", 13)}
   ${t(320, 418, "Kopā apmaksai: 128,40 EUR", 15, 700, "#1d4ed8")}
   ${lines(480, 9)}${t(60, 800, "2. lapa no 3", 11, 400, "#8a93a4")}`,
  // 2 invoice page 3
  `${t(60, 80, "Maksājuma informācija", 16, 700)}
   ${t(60, 115, "Saņēmējs: SIA Ziemeļu Siltums (demo)", 13)}${t(60, 137, "Konts: LV00 DEMO 0000 0000 0000 0", 13)}
   ${t(60, 159, "Mērķis: Rēķins GD-2026/0147", 13)}
   <rect x="60" y="190" width="120" height="120" fill="#fff" stroke="#1f2a3d" stroke-width="2"/>
   <path d="M75 205h30v30h-30zM135 205h30v30h-30zM75 265h30v30h-30zM120 250h15v15h-15zM145 270h15v20h-15z" fill="#1f2a3d"/>
   ${lines(350, 14)}${t(60, 800, "3. lapa no 3", 11, 400, "#8a93a4")}`,
  // 3 contract
  `${t(60, 90, "LĪGUMS Nr. LĪG-2026/32", 22, 700, "#1d4ed8")}${t(60, 118, "par dzīvokļa remontdarbiem", 14, 400, "#4b5568")}
   ${t(60, 160, "Rīgā, 2026. gada 28. oktobrī", 13)}
   ${t(60, 200, "Izpildītājs: SIA Rīgas Remontdarbi (demo)", 13, 700)}${t(60, 222, "Pasūtītājs: Jānis Bērziņš", 13, 700)}
   ${t(60, 270, "1. Līguma priekšmets", 14, 700)}${lines(285, 6)}
   ${t(60, 420, "2. Izpildes termiņš", 14, 700)}${lines(435, 5)}
   ${t(60, 560, "3. Samaksas kārtība", 14, 700)}${lines(575, 5)}
   <path d="M80 760c20-25 40 10 60-10s30 15 50 0" stroke="#1d4ed8" stroke-width="2" fill="none"/>
   <path d="M360 760c15-20 35 12 55-6s25 12 50-2" stroke="#1d4ed8" stroke-width="2" fill="none"/>
   ${t(60, 800, "1. lapa no 1", 11, 400, "#8a93a4")}`,
];

export const DEMO_PAGE_COUNT = pages.length;
const cache = new Map<number, string>();
export function demoPageUrl(i: number) {
  const k = i % pages.length;
  if (!cache.has(k)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fdfdfb"/>${stamp}${pages[k]}</svg>`;
    cache.set(k, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  }
  return cache.get(k)!;
}
export const pageSrc = (p: { demo?: number; src?: string }) => p.src ?? demoPageUrl(p.demo ?? 0);
