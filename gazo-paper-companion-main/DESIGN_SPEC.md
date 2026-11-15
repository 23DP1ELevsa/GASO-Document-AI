# GASO Document AI — mobilā UX dizaina specifikācija

> **Tikai dizaina koncepts.** Šis prototips NEAIZSTĀJ esošo datu modeli (IndexedDB), attēlu apstrādi, Tesseract.js atpazīšanu vai pdf-lib eksporta dzinēju Vue/Capacitor projektā. Pārnesiet tikai izkārtojumu, plūsmu, tekstus un stāvokļus. Prototipa kamera un atpazīšana ir simulēta ar sintētiskiem demonstrācijas datiem.

## 1. Principi

- Viena dominējoša darbība katrā ekrānā (apakšējā fiksētā pogā).
- Galvenā plūsma: **Sākums → Foto → Lapas → Dati → PDF → Gatavs** (4 numurēti soļi).
- Nekad neattēlot terminus: OCR, IndexedDB, JSON, worker, shēma, grupas ID, AI.
- Dati, kas nav atrasti, paliek tukši — nekad neizdomāti.
- Vienmēr iespējams izlaist datus un saglabāt „Tikai skenējums”.
- Vairāku dokumentu sadalīšana tikai pēc lietotāja pieprasījuma.

## 2. Dizaina žetoni (tokens)

| Žetons | Gaišs (oklch) | Lietojums |
|---|---|---|
| background | 0.982 0.005 240 | Ekrāna fons (pelēcīgi balts) |
| card | 1 0 0 | Kartītes, apakšējā josla |
| foreground | 0.23 0.03 255 | Pamatteksts |
| muted-foreground | 0.49 0.025 255 | Palīgteksts |
| primary | 0.52 0.16 252 | Galvenā darbība, aktīvie stāvokļi |
| primary-soft | 0.945 0.03 250 | Izceltas zonas, „Pārbaudiet” |
| success / success-soft | 0.52 0.12 155 / 0.95 0.045 155 | „Pārbaudīts”, „Gatavs!” |
| warning / warning-soft | 0.52 0.12 65 / 0.96 0.06 85 | „Demonstrācijas dati”, „Jāpārbauda” |
| destructive | 0.56 0.2 25 | Dzēšana |
| viewfinder | 0.17 0.02 255 | Kameras fons |

- Rādiuss: bāze 14px; kartītes 16–24px; galvenā poga 16px; čipi pilnībā noapaļoti.
- Ēnas: `card` (maiga, 1+4px), `float` (apakšējai joslai, uz augšu), `cta` (zilgana zem galvenās pogas).
- Tumšais režīms: tie paši žetoni ar `.dark` klasi (sk. `src/styles.css`).

## 3. Tipogrāfija un atstarpes

- Fonts: **Manrope** (atbalsta ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž).
- Skala: Virsraksts 28/1.12 extrabold · Ekrāna nosaukums 17 bold · Kartītes virsraksts 18 bold · Pamatteksts 15 · Lauka vērtība 17 semibold · Palīgteksts 13–14 · Čips 12 semibold · Mikroteksts 11.
- Atstarpes: 4px režģis; ekrāna malas 16px (sākumā 20px); starp kartītēm 12px; sekcijas 24–32px.
- Skārienu mērķi ≥ 44px; galvenā poga 56px; kameras slēdzis 76px.
- Mērķa ekrāni: 360×780 un 390×844; maks. platums 430px, platākā pārlūkā centrēts.
- Drošās zonas: `env(safe-area-inset-top/bottom)` galvenē un apakšējā joslā.

## 4. Ekrānu karte

```
Sākums ──► Kamera ──► (Lapas rediģēšana)
  │           │
  │           ▼
  │        Lapas ──► [Sadalīt] ──► Dati (katram dokumentam) ──► PDF ──► Gatavs!
  │                                   └── Izlaist ─────────────────┘
  ├──► Dokumenti ──► Turpināt (atver pēdējo soli)
  └──► Iestatījumi
```

Android „Atpakaļ” atgriežas iepriekšējā ekrānā; melnraksts tiek saglabāts automātiski katrā solī.

## 5. Ekrāni, teksti un stāvokļi

### 5.1 Sākums
- Virsraksts: „Dokuments gatavs dažos soļos” · „Nofotografējiet, pārbaudiet un saglabājiet PDF.”
- Galvenā kartīte: „Skenēt dokumentu” / „Rēķins, līgums vai iesniegums”.
- Sekundāri: „Pievienot no galerijas”.
- „Turpināt iesākto” — tikai ja ir neeksportēti melnraksti (maks. 2).
- Tukšs stāvoklis: „Nav dokumenta pie rokas? Izmēģiniet ar demonstrācijas rēķinu”.
- Privātums: „Dokumenti tiek apstrādāti tikai šajā ierīcē”.
- Apakšējā navigācija: „Sākums”, „Dokumenti”. Iestatījumi — zobrata ikona galvenē.

### 5.2 Kamera (solis 1)
- Rāmis ar stūriem, „Novietojiet visu lapu rāmī”.
- Apakšā: galerija · slēdzis · „Turpināt (n)”. Sīktēli ar numuriem; pieskāriens atver rediģēšanu.
- Prototipā: „Demonstrācijas kamera” čips un skaidrojums.

### 5.3 Lapas rediģēšana
- Galvene „Lapa 2 no 3”, dzēšanas ikona (apstiprinājums „Dzēst šo lapu?”).
- Rīki: „Pagriezt”, „Apgriezt malas”, „Uz priekšu”, „Uz aizmuguri”. Poga „Gatavs”.

### 5.4 Lapas (solis 2)
- 2 kolonnu režģis, numura emblēma, ← → pārvietošana, „Pievienot vēl”.
- Ja >1 lapa: „Vai visas lapas ir viens dokuments?” → „Jā, viens” / „Nē, sadalīt”. CTA bloķēta līdz atbildei (palīgteksts „Vispirms atbildiet uz jautājumu augšā”).
- Izvēlne ⋮: „Pievienot lapu”, „Pievienot no galerijas”, „Sadalīt vairākos dokumentos” / „Apvienot vienā dokumentā”.
- Sadalīšanas režīms: starp lapām „Sākt jaunu dokumentu šeit” → „Šeit sākas jauns dokuments”; virsraksti „Dokuments 1 · 2 lp.”.
- CTA: „Turpināt uz datiem”.

### 5.5 Dati (solis 3)
- Augšā lapu priekšskatījums (pieskāriens — palielināts skats).
- Sākumstāvoklis: „Atrast svarīgos datus” + CTA „Atpazīt dokumentu” + saite „Izlaist — saglabāt tikai skenējumu”.
- Ielāde: „Nolasa lapas”, „Meklē numuru un datumus”, „Meklē summu”, „Gandrīz gatavs”.
- Rezultāts: čipi „Demonstrācijas dati”, „n jāpārbauda”, „n nav atrasti”.
- „Dokumenta veids”: Rēķins / Līgums / Iesniegums / Pavadzīme / Cits — nosaka redzamos laukus.
- Lauka statusi: **Pārbaudiet** (atrasts, jāapstiprina; poga „Pareizi”) · **Nav atrasts** (tukšs) · **Pārbaudīts** (apstiprināts vai labots).
- „Datu avots” — izvēršams teksts (lapa + fragments).
- CTA „Apstiprināt un turpināt”. Ja ir nepārbaudīti lauki — lapa „Daži lauki nav pārbaudīti” → „Pārbaudīt laukus” / „Turpināt tāpat”.

| Veids | Lauki |
|---|---|
| Rēķins | Rēķina numurs, Nosūtītājs, Saņēmējs, Datums, Apmaksas termiņš, Summa, Valūta |
| Pavadzīme | Pavadzīmes numurs, Nosūtītājs, Saņēmējs, Datums, Summa, Valūta |
| Līgums | Līguma numurs, Puse 1, Puse 2, Noslēgšanas datums |
| Iesniegums | Iesniedzējs, Adresāts, Datums |
| Cits | Numurs, Nosūtītājs, Datums |

### 5.6 PDF (solis 4)
- Kopsavilkuma kartīte katram dokumentam: sīktēli, lapu skaits, „Dati pārbaudīti” / „n nav pārbaudīti” / „Bez datiem”.
- Izvēle: „PDF ar informāciju” (noklusējums, ja dati atpazīti) / „Tikai skenējums”.
- „Papildu iestatījumi”: Lapas izmērs (A4, Letter, Pēc foto), Kvalitāte (Standarta, Augsta).
- „Priekšskatīt” (sekundāri) · „Lejupielādēt PDF” / „Lejupielādēt 2 PDF”.
- Kļūda: „Neizdevās izveidot PDF. Mēģiniet vēlreiz.”

### 5.7 Gatavs
- „Gatavs!” · „PDF saglabāts jūsu ierīces lejupielādēs.” · failu nosaukumi.
- „Skenēt nākamo dokumentu” · „Uz dokumentiem”.

### 5.8 Dokumenti un Iestatījumi
- Kartīte: sīktēls, nosaukums, „n lp. · atjaunots pirms 5 min”, statuss, „Turpināt”, ⋮ („Turpināt”, „Pārbaudīt lapas”, „Dzēst no ierīces”).
- Statusi: „Jāpārbauda lapas”, „Jāpārbauda dati”, „Gatavs eksportam”, „Lejupielādēts”.
- Piezīme: „Lejupielādētie PDF faili atrodas jūsu ierīces mapē „Lejupielādes”.” (Nav mākoņa arhīvs.)
- Iestatījumi: Izskats (Gaišs/Tumšs), Noklusējuma PDF, „Dzēst visus dokumentus”.

## 6. Stāvokļu pārejas

```
draft.stage: capture → pages → fields → pdf → done
pages:   needsSingleConfirm = lapas>1 && !splitMode && !singleConfirmed
fields:  idle → recognizing → recognized → confirmed   | idle/recognized → skipped
field:   missing ⇄ check → ok   (labošana = ok; notīrīšana = missing)
pdf:     idle → generating → downloaded (exported=true) | error → idle
```

## 7. Komponentu inventārs

Btn (primary, secondary, soft, ghost, link, danger, dangerGhost, camera × lg/md/sm/icon) · Header · StepFooter (solis, progress, „Saglabāts ierīcē”) · BottomNav · PageImg · Chip (success, warning, primary, muted, danger) · Sheet (apakšējā lapa) · FieldCard · Choice (radio kartīte) · Segmented · Toast.

## 8. Kartējums uz esošajiem Vue komponentiem

| Prototips | Vue komponents | Piezīmes |
|---|---|---|
| HomeScreen | **HomeView.vue** | Divas darbības + „Turpināt iesākto”; noņemt plūsmas aprakstu. |
| CaptureScreen, EditScreen | **ScanView.vue** | Kamera (Capacitor), sīktēlu josla, „Turpināt (n)”; rediģēšana kā pilnekrāna skats. |
| Lapu kartīte | **ScanPageCard.vue** | Numura emblēma, ← →, rediģēšanas ikona; bez grupu izvēlnes. |
| PagesScreen (sadalīšana) | **DocumentGroups.vue** | Grupas veido atdalītāji „Šeit sākas jauns dokuments”, nevis dropdown. Esošais grupu modelis paliek. |
| FieldsScreen, FieldCard | **DocumentInformation.vue** | Lauki pēc veida, 3 statusi, „Datu avots”; reālo atpazīšanu nodrošina esošais Tesseract dzinējs. |
| PdfScreen | **PdfExportDialog.vue** | Pārveidot no dialoga par pilnu ekrānu; A/B izvēle; papildu iestatījumi sakļauti. Eksportu veic esošais pdf-lib kods. |
| DocsScreen | **DocumentsView.vue** | Vieglas kartītes ar statusu; bez „arhīva” valodas. |

Vuetify ieteikumi: `v-btn` (size="x-large", block) galvenajai darbībai; `v-bottom-sheet` lapām; `v-chip` statusiem; `v-text-field` variant="outlined" ar `inputmode`; `v-bottom-navigation` tikai Sākums/Dokumenti; Android atpakaļ — Capacitor `App.addListener('backButton')`.
