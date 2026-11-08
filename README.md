# GASO Document AI

## Projekta apraksts

GASO Document AI ir plānota progresīvā tīmekļa lietotne (PWA) drukātu dokumentu fotografēšanai, digitalizēšanai, automātiskai klasificēšanai, datu iegūšanai un arhivēšanai. Ar telefona kameru lietotājs vienā sesijā varēs secīgi fotografēt dažādu dokumentu lapas, piemēram, rēķinus, līgumus un iesniegumus.

Projekta uzdevumi tiek pārvaldīti [GASO Document AI Trello dēlī](https://trello.com/b/J6ecDlQE/gaso-document-ai-projekta-izstrade).

## Projekta mērķis

Samazināt manuālu dokumentu reģistrēšanu un datu pārrakstīšanu, atvieglojot drukātu dokumentu digitalizāciju. Lietotājam būs iespēja pārbaudīt un labot gan dokumentu grupējumu, gan iegūtos datus pirms reģistrēšanas un arhivēšanas.

## Galvenās funkcijas

Visas turpmāk aprakstītās funkcijas ir plānotas.

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
│   └── .gitkeep
├── frontend/
│   └── .gitkeep
├── docs/
│   ├── requirements/
│   │   └── .gitkeep
│   ├── diagrams/
│   │   └── .gitkeep
│   └── testing/
│       └── .gitkeep
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

## Licence

Projektam ir spēkā [MIT licence](LICENSE). Autortiesību norāde: Copyright (c) 2026 Eduards Levša.