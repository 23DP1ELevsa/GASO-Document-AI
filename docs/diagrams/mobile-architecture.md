# Mobilās lietotnes arhitektūra — 1. posms

Pašreizējā lietotne ir patstāvīgs Vue 3 interfeiss ar JavaScript un Composition API. Tā nolasīšanai un lietošanai nav nepieciešams backend. Šis dokuments papildina iepriekšējo [dokumentu apstrādes arhitektūru](document-processing-architecture.md); tas nemaina agrākās OCR izpētes secinājumus.

## Realizētā struktūra

```text
frontend/
├── src/
│   ├── main.js                   # Vue, Vuetify, Router, platformas inicializācija
│   ├── App.vue                   # Adaptīvs navigācijas karkass
│   ├── views/                    # Četri atsevišķi slinki ielādēti ekrāni
│   ├── components/               # Ikonas, virsraksti, tukšie stāvokļi, lokālā režīma ziņa
│   ├── composables/              # Izskata preference, PWA instalēšana/atjauninājumi
│   ├── plugins/vuetify.js         # Reģistrētās komponentes un tēmu paletes
│   ├── router/index.js           # Hash maršruti un fokusa pārvietošana
│   ├── platform/android.js       # Native atpakaļpoga un splash aizvēršana
│   ├── locales/                  # Tulkojumu vārdnīcas un t(key)
│   └── styles/                   # Dizaina vērtības un adaptīvs izkārtojums
├── public/                       # Neitrālās prototipa ikonas, bez lietotāju datiem
├── scripts/                      # Atkārtojama ikonu ģenerēšana, Gradle palaišana
├── tests/                        # Pārlūka uzvedības un piekļūstamības testi
├── android/                      # Capacitor Android projekts un Gradle wrapper
├── vite.config.js                # Web/native būvējumi un PWA keša robeža
└── capacitor.config.json         # Native lietotnes identitāte un spraudņu iestatījumi
```

## Pašreizējās robežas

- **Ekrāni** attēlo saskarni un navigē; tajos nav dokumentu, fiktīvu API vai biznesa loģikas imitācijas.
- **Komponentes** veido vienotu vizuālo valodu; Vuetify nodrošina pogu, kartīšu un brīdinājumu pamatus, Lucide — SVG ikonas.
- **Izskata preference** ir vienīgais lietotnes saglabātais iestatījums (`gaso-document-ai:theme` lokālajā glabātuvē). Dokumentu krātuve vēl neeksistē.
- **Lokalizācija** izmanto semantiskas atslēgas, piemēram, `scan.camera`. Jaunai valodai pievieno vārdnīcu un paplašina `locales/index.js`; valodas izvēle vēl nav realizēta. Android/PWA nosaukums un identifikators paliek platformas konfigurācijā.
- **Platforma** tiek noteikta ar Capacitor. Native spraudņi tiek izmantoti tikai Android vidē; pārlūkam nav nepieciešams ne SDK, ne atļaujas kamerai.
- **Drošās zonas** izmanto Capacitor `--safe-area-inset-*` vērtības ar pārlūka `env(safe-area-inset-*)` rezerves vērtībām. Sistēmas ikonas pielāgojas lietotnes tēmai. Fiziskas ierīces pārbaude vēl nepieciešama.
- **PWA** kešo tikai piegādātos interfeisa failus. Maršruti ir URL fragmentā. Native būvējums neģenerē un nereģistrē service worker.
- **Ārējie savienojumi** nav daļa no lietotnes darbības. GitHub atveras tikai pēc lietotāja izvēles atsevišķā cilnē. Atkarību instalēšanai un Android rīku lejupielādei nepieciešams internets.

## Paplašināšana turpmākajos posmos

Moduļus pievieno kopā ar pirmo īsto funkcionalitāti un tās testiem; iepriekš neveido tukšus servisus vai imitētus rezultātus.

| Modulis | Atbildība un paredzētā robeža |
| --- | --- |
| Kamera/galerija | Platformas adapteris: native kamera un pārlūka iespējas, atļaujas, atteikums un atcelšana; rezultāts — lokālu lapu atsauces |
| Attēlu apstrāde | Orientācija, apgriešana, perspektīva, resursu limiti; neatkarīga no ekrāniem un MI |
| Skenēšanas sesija | Lapu secība un priekšskatījumi; grupēšana atsevišķi no kameras ievades |
| Lokālais OCR | Dzinēja adapteris ar progresu/atcelšanu; teksta rezultāts ar lapu un koordinātu saistēm |
| PDF | PDF no oriģinālajiem lapu attēliem pareizajā secībā; OCR teksts neaizvieto vizuālo dokumentu |
| Lokālā krātuve | Vienots repozitorija interfeiss; Android privāti faili un pārlūka piemērota krātuve, dzīves cikls/dzēšana |
| Korporatīvais MI | Atsevišķs saskaņots adapteris; shēmas validācija un lietotāja pārbaude; bez automātiskas pārsūtīšanas citiem pakalpojumiem |
| Serveris/MongoDB | Atsevišķa servera integrācija pēc infrastruktūras lēmumiem; datubāzes piekļuves dati nekad neatrodas frontend |

Sākumā pietiek ar Vue reaktivitāti komponenšu/composable līmenī. Kopīgu sesijas stāvokļa risinājumu izvēlas tad, kad reāla vairāku ekrānu datu plūsma to prasa.

Python OCR rīki ir eksperimentu vide; tos nevar uzskatīt par mobilā OCR realizāciju. Dzinēja izvēle Android un pārlūkam prasīs atsevišķu licences, veiktspējas, modeļu izmēra un latviešu valodas kvalitātes pārbaudi.

## Android identitāte

`lv.gaso.documentai.prototype` ir pagaidu identifikators, kas pirms publicēšanas jāsaskaņo. Pagaidu ikona ir projekta dokumenta/skenēšanas simbols; oficiālais GASO logotips nav izmantots. Android versija un tīmekļa `package.json` versija šobrīd ir `0.1.0`; nākamajā laidienā jāatjaunina abas un Android `versionCode`.
