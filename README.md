# GASO Document AI

## Projekta apraksts

GASO Document AI ir plānota progresīvā tīmekļa lietotne (PWA) drukātu dokumentu fotografēšanai, digitalizēšanai, automātiskai klasificēšanai, datu iegūšanai un arhivēšanai. Ar telefona kameru lietotājs vienā sesijā varēs secīgi fotografēt dažādu dokumentu lapas, piemēram, rēķinus, līgumus un iesniegumus.

Projekta uzdevumi tiek pārvaldīti [GASO Document AI Trello dēlī](https://trello.com/b/J6ecDlQE/gaso-document-ai-projekta-izstrade).

## Projekta mērķis

Samazināt manuālu dokumentu reģistrēšanu un datu pārrakstīšanu, atvieglojot drukātu dokumentu digitalizāciju. Lietotājam būs iespēja pārbaudīt un labot gan dokumentu grupējumu, gan iegūtos datus pirms reģistrēšanas un arhivēšanas.

## Galvenās funkcijas

Turpmāk aprakstīta plānotā lietotne. Pašlaik atsevišķi ir pieejams lokāls OCR komandrindas prototips un tehniskās sagatavošanas dokumentācija; PWA un arhivēšana vēl nav realizēta.

1. Pieņemt vienu vai vairākas dokumentu fotogrāfijas, tostarp vairāku dokumentu lapas vienā fotografēšanas sesijā.
2. Automātiski noteikt lapu robežas, koriģēt perspektīvu un uzlabot attēlu salasāmību.
3. Ar mākslīgā intelekta (MI) palīdzību noteikt dokumentu sākumu un beigas un automātiski grupēt lapas atsevišķos dokumentos.
4. Ļaut lietotājam manuāli labot grupējumu: pārvietot lapas starp dokumentiem, apvienot un sadalīt grupas, mainīt lapu secību.
5. Katram dokumentam ģenerēt atsevišķu vairāku lapu PDF failu pareizajā lapu secībā. PDF jāsaglabā fotografēto lapu vizuālais saturs; to nedrīkst aizstāt tikai ar MI ģenerētu tekstu.
6. Automātiski noteikt dokumenta veidu, piemēram, rēķinu, līgumu vai iesniegumu.
7. Izvilkt galvenos atribūtus: dokumenta numuru, datumu, summu, valūtu, nosūtītāju un saņēmēju, kā arī dokumenta tipam raksturīgos laukus.
8. Normalizēt atribūtu nosaukumus un vērtības: vienādas nozīmes atribūtiem izmantot vienotus nosaukumus, saglabājot elastīgu datu struktūru dažādiem dokumentu tipiem.
9. Ļaut lietotājam pārbaudīt, labot un apstiprināt dokumenta tipu, atribūtus un sagatavoto PDF pirms reģistrēšanas.
10. Reģistrēt dokumentu MongoDB datubāzē, piešķirt unikālu identifikatoru un saglabāt PDF failu, sasaistot to ar datubāzes ierakstu.

## Mākslīgā intelekta izmantošana

Dokumentu grupēšanai, klasificēšanai un atribūtu iegūšanai paredzēts izmantot GASO saskaņoto korporatīvo MI API. API vēl nav integrēts. Pakalpojuma tehniskās detaļas, piekļuves nosacījumi un autentifikācijas parametri tiks precizēti ar uzņēmuma atbildīgo speciālistu.

API adreses, modeļi un autentifikācijas parametri šobrīd nav noteikti. Personīgo OpenAI API nav paredzēts izmantot reālu GASO dokumentu apstrādei.

## Plānotās tehnoloģijas

| Joma | Tehnoloģija vai risinājums |
| --- | --- |
| Lietotāja saskarne | Vue 3, JavaScript, Vuetify |
| Servera puse | PHP, Laravel 12 |
| Datubāze | MongoDB |
| Mākslīgais intelekts | GASO saskaņotais korporatīvais MI API; detaļas tiks precizētas |
| Attēlu apstrāde | PHP bibliotēkas; nepieciešamības gadījumā OpenCV |
| PDF ģenerēšana | Piemērota PDF izveides bibliotēka; izvēle vēl jāveic |
| Mobilā lietotne | Progresīvā tīmekļa lietotne (PWA) |
| Autorizācija | Laravel Sanctum |
| Izvietošana | Railway, ja izvietojums tiks saskaņots |
| Versiju kontrole | Git un GitHub |

## Projekta struktūra

```text
GASO-Document-AI/
├── backend/
│   └── .env.example
├── frontend/
│   └── .gitkeep
├── docs/
│   ├── requirements/
│   │   ├── corporate-ai-api.md
│   │   ├── document-types.md
│   │   ├── document-attributes.md
│   │   └── document-analysis.schema.json
│   ├── diagrams/
│   │   └── document-processing-architecture.md
│   └── testing/
│       ├── test-dataset-plan.md
│       ├── ocr-comparison.md
│       └── preparation-summary.md
├── tools/
│   └── ocr-evaluation/
│       ├── README.md
│       ├── ocr_demo.py
│       ├── analysis.py
│       ├── engines.py
│       ├── benchmark.py
│       ├── generate_synthetic.py
│       ├── evaluate_text.py
│       ├── requirements.txt
│       └── tests/
├── .gitignore
├── .editorconfig
├── LICENSE
└── README.md
```

- `backend/` — vieta servera puses lietotnei un datu apstrādei.
- `frontend/` — vieta lietotāja saskarnei un PWA funkcionalitātei.
- `docs/requirements/` — projekta prasības un lietošanas scenāriji.
- `docs/diagrams/` — arhitektūras, datu un procesu diagrammas.
- `docs/testing/` — testēšanas plāni, scenāriji un rezultāti.

Tukšās mapes saglabā `.gitkeep` faili. `.gitignore` nosaka izslēdzamos lokālos un ģenerētos failus, bet `.editorconfig` — vienotu teksta failu formatējumu.

## Datu drošība

Reāli GASO dokumenti var saturēt personas datus un komercnoslēpumus. Tos drīkst apstrādāt tikai uzņēmumā saskaņotā vidē un atbilstoši noteiktajām datu aizsardzības un piekļuves prasībām. Izstrādes pārbaudēm jāizmanto sintētiski vai izmantošanai atļauti testa dokumenti.

Piekļuves datus, API atslēgas, lietotāju augšupielādes, privātos PDF un datubāzes kopijas nedrīkst pievienot repozitorijam. `.gitignore` paredzēti atbilstoši izņēmumi, taču pirms failu publicēšanas to saturs jāpārbauda. Lietotnes drošības mehānismi vēl nav ieviesti.

## Tehniskā sagatavošana: #04, #05, #06

- [Korporatīvā MI API jautājumi, konfigurācija un saskaņojamie nosacījumi](docs/requirements/corporate-ai-api.md).
- [Dokumentu tipi](docs/requirements/document-types.md), [atribūtu katalogs](docs/requirements/document-attributes.md) un [paplašināmā rezultāta JSON shēma](docs/requirements/document-analysis.schema.json).
- [Testdatu plāns un 11 piemēru struktūras izpēte](docs/testing/test-dataset-plan.md).
- [OCR, attēlu un PDF bibliotēku salīdzinājums un faktiskie mērījumi](docs/testing/ocr-comparison.md).
- [Dokumentu apstrādes arhitektūra](docs/diagrams/document-processing-architecture.md).
- [Lokālā OCR prototipa uzstādīšana un palaišana](tools/ocr-evaluation/README.md).
- [Paveiktā pārskats un atlikušie priekšnoteikumi](docs/testing/preparation-summary.md).

Tesseract lokāli izmēģināts ar 11 atļautajiem PDF (13 lapas) un trim sintētiskiem LV/EN/RU attēliem. OCR teksts un atribūtu semantika ir atsevišķas darbības. Prototips neizmanto uzņēmumu veidnes vai fiksētas lauku koordinātas; tā ierobežotie apzīmējumu noteikumi vēl nenodrošina universālu dokumentu izpratni. Neskaidras vērtības ir `null`, rezultāti vienmēr jāpārbauda lietotājam.

PaddleOCR un Docling atpazīšanas rezultāti vēl nav iegūti; to priekšnoteikumi ir dokumentēti. Korporatīvā API adapteris paliek slēgts līdz specifikācijas un atļaujas saņemšanai. Privātie dokumenti, rastri, rezultāti, modeļi un lokālās izpildvides ir izslēgtas ar `.gitignore`.

## Licence

Projektam ir spēkā [MIT licence](LICENSE). Autortiesību norāde: Copyright (c) 2026 Eduards Levša.
