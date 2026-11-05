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
│   ├── app/                  # Attēlu apstrāde, atpazīšana, API
│   ├── bootstrap/
│   ├── config/
│   ├── public/
│   ├── routes/
│   ├── storage/              # Tikai īslaicīga infrastruktūra un lokāli testa paraugi
│   ├── tests/
│   ├── tools/
│   ├── .env.example
│   ├── composer.json
│   ├── composer.lock
│   └── serve.ps1
├── frontend/
│   ├── src/                  # Vue testēšanas saskarne
│   ├── e2e/
│   ├── tests/
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
├── docs/
│   ├── requirements/
│   │   └── .gitkeep
│   ├── diagrams/
│   │   └── .gitkeep
│   └── testing/
│       └── prototype-report.lv.md
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

Tukšajās mapēs sākotnēji ievietoti `.gitkeep` faili, lai saglabātu struktūru versiju kontrolē. Kopīgā projekta informācija un uzstādīšanas un palaišanas instrukcijas uzturētas šajā `README.md`; detalizētais prototipa izstrādes un testēšanas pārskats atrodas `docs/testing/`.

## Uzstādīšana un palaišana

Realizēts lokāls Trello #07 un #08 prototips: Laravel 12 API un minimāla Vue 3 testēšanas saskarne. MySQL, autorizācija, Vuetify un PWA šajā posmā nav nepieciešami.

Prasības: PHP 8.3+ ar GD (JPEG/PNG/WebP atbalsts), EXIF, cURL, mbstring, XML un Composer 2; Node.js 22.14+ un npm. Attēlu apstrādei paredzēti 512 MB PHP atmiņas. Pārbaudīts Windows ar PHP 8.5.2, Node 22.14.0 un Chrome.

PowerShell, no repozitorija saknes:

```powershell
cd backend
# Ja gd/exif jau ieslēgti php.ini, izlaidiet atbilstošos -d argumentus.
$env:COMPOSER_ROOT_VERSION = '1.0.0'
php -d extension=gd -d extension=exif C:\ProgramData\ComposerSetup\bin\composer.phar install --no-interaction --prefer-dist
Copy-Item .env.example .env
php artisan key:generate
```

Composer ceļš piemērā atbilst šai Windows videi. Ja moduļi ieslēgti `php.ini`, citās vidēs var izmantot parasto `composer install`. `COMPOSER_ROOT_VERSION` ļauj Composer noteikt projekta versiju bez Git pārbaudes. Esošu `.env` nepārrakstiet.

Atveriet **tikai** `backend/.env` un ierakstiet savu `OPENAI_API_KEY`. `OPENAI_MODEL` maina modeli bez koda izmaiņām; noklusējums ir `gpt-4.1-mini`. Izvēlieties modeli, kas atbalsta attēlu ievadi un strukturētu JSON izvadi Responses API. Nepievienojiet API atslēgu frontend konfigurācijai. Bez atslēgas darbojas augšupielāde, apgriešana, optimizācija un visi automatizētie testi; atpazīšana atgriež saprotamu konfigurācijas kļūdu.

Ja vēlaties aprēķināt izmaksas, iestatiet `OPENAI_INPUT_PRICE`, `OPENAI_CACHED_INPUT_PRICE` un `OPENAI_OUTPUT_PRICE`: USD par miljonu tokenu **izvēlētajam modelim**. Pēc modeļa maiņas pārbaudiet un nomainiet arī cenas. Tukšas cenas nozīmē nezināmas izmaksas, nevis bezmaksas pieprasījumu. `OPENAI_TIMEOUT` nosaka API gaidīšanas laiku sekundēs. Pēc `.env` maiņas pārstartējiet backend; neizmantojiet novecojušu konfigurācijas kešu.

Pirmajā terminālī:

```powershell
cd backend
.\serve.ps1
```

Skripts ieslēdz trūkstošos GD/EXIF moduļus tikai servera procesam un nosaka 20 MB faila, 24 MB pieprasījuma un 512 MB atmiņas limitus. Tas nemaina sistēmas PHP konfigurāciju. Ja PowerShell skriptu izpilde nav atļauta, izmantojiet ekvivalentu komandu no `backend` mapes:

```powershell
php -d extension=gd -d extension=exif -d memory_limit=512M -d upload_max_filesize=20M -d post_max_size=24M -d max_execution_time=90 -S 127.0.0.1:8000 -t public public/index.php
```

Otrajā terminālī:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Atveriet `http://127.0.0.1:5173`. Vite pārsūta `/api` pieprasījumus uz `127.0.0.1:8000`; API atslēga paliek Laravel pusē. Izmantojiet tikai savus vai izmantošanai atļautus attēlus. Pirms atpazīšanas sagatavojiet fragmentu un apstipriniet, ka tajā nav personas datu vai nevajadzīgas informācijas. Katrs atpazīšanas pogas spiediens veic vienu maksas API pieprasījumu; sešu optimizācijas variantu salīdzināšana OpenAI neizmanto.

### Automatizētie testi

No `backend` mapes:

```powershell
php -d extension=gd -d extension=exif -d memory_limit=512M vendor/phpunit/phpunit/phpunit
php -d extension=gd -d memory_limit=512M tools/generate-fixtures.php
php -d extension=gd tools/compare-variants.php
```

No `frontend` mapes:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Pārlūka testiem jābūt instalētam Chrome; portiem 8000 un 5173 jābūt brīviem. Playwright pats palaiž un aptur abus serverus. Ja lietojat citu pārlūku vai PHP konfigurāciju ar jau ieslēgtiem moduļiem, pielāgojiet `frontend/playwright.config.js`. Testi neizsauc īsto OpenAI API: backend izmanto `Http::fake()` un aizliedz neimitētus pieprasījumus, pārlūka testi pārtver atpazīšanas maršrutu.

Ģenerētie sintētiskie paraugi un sešu variantu attēli/CSV atrodas `backend/storage/app/test-fixtures/`, ko ignorē Git. Tie ir paredzēti tikai lokāliem eksperimentiem, netiek ģenerēti augšupielādes laikā un nepierāda precizitāti īstām skaitītāju fotogrāfijām. Testēšanas scenāriji, arhitektūra, failu saraksts, rezultāti un ierobežojumi: [izstrādes pārskats](docs/testing/prototype-report.lv.md).

## Pašreizējais izstrādes statuss

**Darbojas tikai rādījumu atpazīšanas un attēlu optimizācijas prototips.** Iepriekš aprakstītā reģistrācija, klientu datubāze, QR kodi, administrators, vēsture, Railway un pilna PWA paliek nākamajiem uzdevumiem.