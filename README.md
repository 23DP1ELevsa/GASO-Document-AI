# GASO Meter AI

GASO Meter AI ir plānota progresīvā tīmekļa lietotne (PWA) gāzes skaitītāju rādījumu nolasīšanai no fotogrāfijām, izmantojot mākslīgo intelektu. Lietotājs varēs pārbaudīt atpazīto rādījumu veselos kubikmetros (m³), vajadzības gadījumā to izlabot un apstiprināt.

Projekts sākotnēji paredzēts kā demonstrācijas prototips ar savu datubāzi, bez tiešas integrācijas ar GASO informācijas sistēmām.

## Projekta mērķis

Vienkāršot gāzes skaitītāju rādījumu ievadi un uzskaiti, samazinot manuālas pārrakstīšanas nepieciešamību un saglabājot lietotājam iespēju pārbaudīt un apstiprināt mākslīgā intelekta noteikto vērtību.

## Plānotās lietotāja funkcijas

- Reģistrācija, pieslēgšanās un piekļuve saviem datiem.
- Viena vai vairāku gāzes skaitītāju pievienošana un pārvaldība.
- Individuāla QR koda ģenerēšana katram skaitītājam un koda skenēšana skaitītāja identificēšanai.
- Skaitītāja fotografēšana un fotoattēla iesniegšana analīzei.
- Rādījuma automātiska atpazīšana veselos kubikmetros (m³).
- Atpazītās vērtības pārbaude, manuāla labošana un apstiprināšana.
- Iesniegto rādījumu vēstures apskate.
- Lietotnes izmantošana mobilajās ierīcēs kā PWA.

## Plānotās administratora funkcijas

- Piekļuve administratora panelim atbilstoši piešķirtajām tiesībām.
- Lietotāju un reģistrēto skaitītāju pārskatīšana un pārvaldība.
- Iesniegto rādījumu un to vēstures pārskatīšana.

Administratora darbību detalizētais apjoms tiks precizēts projekta prasībās.

## Plānotās tehnoloģijas

| Joma | Tehnoloģijas |
| --- | --- |
| Lietotāja saskarne | Vue 3, JavaScript, Vuetify |
| Servera puse un REST API | PHP, Laravel 12 |
| Datubāze | MySQL |
| Autentifikācija un API piekļuve | Laravel Sanctum |
| Mākslīgais intelekts | OpenAI API |
| Attēlu apstrāde | PHP attēlu apstrādes rīki; nepieciešamības gadījumā OpenCV |
| QR kodi | Ģenerēšanas un skenēšanas bibliotēkas; izvēle tiks precizēta izstrādes laikā |
| Mobilā pieredze | PWA (Progressive Web App) |
| Izvietošana | Railway |
| Versiju kontrole | Git, GitHub |

Frontend un backend atradīsies atsevišķās mapēs un sazināsies ar REST API, lai tos varētu izstrādāt un izvietot neatkarīgi.

## Projekta struktūra

```text
GASO-Meter-AI/
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
└── README.md
```

- [backend/](backend/) — paredzēta Laravel lietotnei, REST API, autentifikācijai un piekļuves tiesību pārbaudei, datubāzes migrācijām, fotoattēlu apstrādei, OpenAI integrācijai, QR kodu ģenerēšanai un administratora funkciju servera loģikai.
- [frontend/](frontend/) — paredzēta Vue 3, Vuetify un PWA lietotnei, kas nodrošinās lietotāja un administratora saskarni un sazināsies ar backend REST API.
- [docs/requirements/](docs/requirements/) — funkcionālās un nefunkcionālās prasības, tehniskā specifikācija un pieņemšanas kritēriji.
- [docs/diagrams/](docs/diagrams/) — datubāzes ER diagrammas, lietojuma gadījumu diagrammas un sistēmas arhitektūra.
- [docs/testing/](docs/testing/) — testēšanas plāni, scenāriji un izpildes rezultāti.
- `.gitignore` — sensitīvo datu, atkarību, ģenerēto failu un augšupielāžu izslēgšana no versiju kontroles.
- `.editorconfig` — kopīgi failu kodējuma, atkāpju un rindu beigu iestatījumi.

Tukšajās mapēs ievietoti `.gitkeep` faili, lai saglabātu sākotnējo struktūru versiju kontrolē. Visa kopīgā projekta informācija un uzstādīšanas un palaišanas instrukcijas tiks uzturētas šajā vienīgajā `README.md` failā.

## Uzstādīšana un palaišana

**Lietotni pašlaik vēl nevar palaist:** repozitorijā ir tikai sākotnējā mapju struktūra un dokumentācija. Laravel un Vue projekti, atkarību konfigurācija un palaišanas skripti vēl nav izveidoti.

Pēc backend un frontend projektu inicializēšanas šī sadaļa tiks papildināta ar nepieciešamajām rīku versijām, atkarību instalēšanas komandām, vides mainīgo iestatīšanu, MySQL datubāzes sagatavošanu un abu lietotnes daļu palaišanas komandām.

Sensitīvās konfigurācijas vērtības paredzēts glabāt lokālos `.env` failos; konfigurācijas paraugus — `.env.example` failos ar aizstājējvērtībām. OpenAI API atslēga un citi servera noslēpumi jāglabā backend pusē. Lietotāju fotoattēli un API atslēgas nav ievietojami versiju kontrolē.

## Pašreizējais izstrādes statuss

**Projekts atrodas sākotnējā izstrādes posmā. Visa iepriekš aprakstītā lietotnes funkcionalitāte ir plānota un vēl nav realizēta.**

Sagatavota tikai sākotnējā mapju struktūra, dokumentācija un izstrādes vides kopīgie failu iestatījumi. Laravel un Vue projekti vēl nav ģenerēti, atkarības nav instalētas, datubāze un Railway izvietošana nav konfigurēta. Lietotne šajā posmā vēl nav palaižama.

Turpmākajos uzdevumos paredzēta prasību precizēšana, backend un frontend projektu inicializēšana, datubāzes izveide un pakāpeniska funkcionalitātes ieviešana. Prasības, diagrammas un testēšanas materiāli vēl nav sagatavoti.
