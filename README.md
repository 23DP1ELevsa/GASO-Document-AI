# GASO Document AI

GASO Document AI ir dokumentu fotografēšanas, AI analīzes un PDF izveides lietotne ar:

- `backend/` — Laravel 12 API, OpenAI attēlu analīzi un MongoDB dokumentu glabāšanu.
- `frontend/` — Vue 3 + Vuetify 3 saskarni, PWA un Capacitor Android projektu.
- `docs/` — datu shēmām, testiem un MongoDB iestatīšanas instrukciju.

Pēc pieslēgšanās lietotājs pievieno dokumenta fotogrāfijas, pārskata AI atrastos datus un apstiprina dokumentu. Savus dokumentus var apvienot komplektos un eksportēt PDF. Katram kontam ir sava darba kopija IndexedDB. Ieslēdzot sinhronizāciju, dokumenti un komplekti saglabājas MongoDB un fotoattēli MongoDB GridFS. Dokumenta apskate neveic AI pieprasījumus.

## Prasības

- PHP 8.2+ ar Argon2id un MongoDB paplašinājumu, Composer 2+.
- Node.js 22.13+ un npm.
- Pieejama MongoDB datubāze lietotāju kontiem un sesiju pārbaudei. Dokumentu sinhronizāciju var ieslēgt katram kontam.
- OpenAI API atslēga AI analīzei; manuāla ievade un PDF darbojas arī bez tās.

[MongoDB iestatīšana Windows un VS Code](docs/mongodb-windows.md)

## Palaišana no VS Code

Atver projekta sakni Windows VS Code logā. Uzdevums izmanto WSL2 distribūciju `Ubuntu` ar PHP un Composer, kā arī Windows Node.js un npm. Pirmajai palaišanai sagatavo atkarības un `backend/.env`, izmantojot zemāk norādītās komandas.

1. Atver komandu paleti ar `Ctrl+Shift+P` un izvēlies **Tasks: Run Task** → **Start GASO Document AI**.
2. Kad Laravel un Vue ir gatavi, atver **http://127.0.0.1:5173** un reģistrējies ar `vards.uzvards@gaso.lv`. Ja vēlāk migrēsi veco IndexedDB glabātuvi, izmanto sākotnējo adresi un pārlūka profilu.
3. Serveru apturēšanai izmanto **Tasks: Terminate Task** → **All running tasks** vai apturi katru serveri tā terminālī ar `Ctrl+C`.

Ja portu `8000` vai `5173` jau izmanto iepriekš palaists GASO serveris, apturi to pirms kopīgā uzdevuma palaišanas. Laravel izmanto esošo `backend/.env`, tostarp MongoDB un OpenAI iestatījumus.

## Lokālā sagatavošana un manuāla palaišana

Laravel sagatavo Ubuntu WSL2 terminālī, sākot no projekta saknes:

```bash
cd backend
composer install
if [ ! -f .env ]; then
    cp .env.example .env
    php artisan key:generate
fi
```

Esošai konfigurācijai ģenerē lietotnes atslēgu tikai tad, ja `APP_KEY` ir tukša. Norādi `MONGODB_URI` un `MONGODB_DATABASE=gaso_document_ai`. Ieslēdz `DOCUMENT_STORAGE_ENABLED=true`, lai būtu pieejama dokumentu sinhronizācija, un izpildi `php artisan document-storage:check --indexes`, kas izveido kontu, sesiju un dokumentu indeksus.

Failā `backend/.env` norādi:

```dotenv
DOCUMENT_AI_PROVIDER=openai
DOCUMENT_AI_ENABLED=true
OPENAI_API_KEY=ievieto_savu_API_atslēgu
OPENAI_MODEL=gpt-6-luna
```

API atslēga glabājas tikai servera `.env` failā. Neievieto to frontend kodā un nepublicē. AI analīze izmanto maksas API un tiek sākta tikai pēc lietotāja piekrišanas.

Lai palaistu Laravel manuāli no `backend/` mapes Ubuntu terminālī:

```bash
PHP_CLI_SERVER_WORKERS=4 php artisan serve --host=127.0.0.1 --port=8000 --no-reload
```

Vue atkarības sagatavo Windows PowerShell terminālī, sākot no projekta saknes:

```powershell
cd frontend
npm.cmd ci
```

Manuālai palaišanai tajā pašā Windows terminālī izpildi `npm.cmd run dev`.

Atver **http://127.0.0.1:5173**. Vite pārsūta `/api` pieprasījumus uz Laravel **http://127.0.0.1:8000**. Kontiem, sinhronizācijai un AI izmanto lokālo adresi tajā pašā datorā.

Ja AI neatbild, pārbaudi API serveri, atslēgu un OpenAI projekta kredītus. Pēc `.env` izmaiņām izpildi `php artisan config:clear` un pārstartē API serveri.

## Būvējums un testi

Mapē `frontend/`:

```powershell
npm.cmd run build       # Produkcijas būvējums un PWA
npm.cmd run preview     # Priekšskatījums: http://127.0.0.1:4173
npm.cmd run test:unit   # Vienību testi
npm.cmd run test:e2e    # Playwright testi, pirms tiem izveido būvējumu
```

Playwright testiem nepieciešams Google Chrome un brīvs ports 4173. Testi imitē kontu, glabāšanas un AI API un pārbauda īsto pārlūka IndexedDB un PDF ģenerēšanu. Sīkdatņu un CSRF pārbaudi pret īstu Laravel ieslēdz ar `GASO_E2E_REAL_AUTH=1` tikai tad, kad portā 8000 darbojas atsevišķs testa backend ar sintētisku MongoDB datubāzi un izslēgtu OpenAI.

Mapē `backend/` WSL terminālī:

```bash
DOCUMENT_STORAGE_TEST_URI='mongodb://127.0.0.1:27017/?replicaSet=gasoTest' php artisan test
```

Pielāgo URI savam atsevišķajam lokālajam MongoDB. Testi veido nejauši nosauktas īslaicīgas datubāzes un pieņem tikai loopback testa URI. Replica set nepieciešams mantojuma piešķiršanas transakcijas pārbaudei. AI atbildes testos ir imitētas.

## Lietotāju konti

Reģistrācija paredzēta tikai prototipa testēšanai un nepārbauda faktisko piederību GASO. Backend normalizē e-pastu un piemēro `AUTH_EMAIL_DOMAIN` un `AUTH_EMAIL_LOCAL_PATTERN`. Parolē vajag vismaz 12 rakstzīmes, un MongoDB glabā Argon2id jaucējvērtību. `email_verified_at` paliek `null`.

Pēc reģistrācijas vai pieslēgšanās Sanctum izmanto Laravel HttpOnly sesijas sīkdatni un CSRF aizsardzību. Sesijas sīkdatne darbojas pārlūka sesijas laikā, servera pieprasījumu neaktivitātes limits pēc noklusējuma ir 120 minūtes un absolūtais limits ir astoņas stundas. Izrakstīšanās atsauc pašreizējo sesiju. Paroles maiņa un darbība **Atsaukt pārējās sesijas** saglabā šo pārlūka sesiju un atsauc iepriekšējās. Deaktivizēti konti saņem HTTP 401.

Sanctum 4.5 un MongoDB Laravel 5.12 saderība pārbaudīta WSL2 ar PHP 8.5. Ierīču tokeni izmanto MongoDB pielāgoto Sanctum modeli. [Laravel Sanctum](https://laravel.com/docs/12.x/sanctum) · [MongoDB Laravel autentifikācija](https://www.mongodb.com/docs/drivers/php/laravel-mongodb/current/integrations/user-authentication/)

| Metode un ceļš | Darbība |
| --- | --- |
| `GET /api/auth/csrf-cookie` | Iegūt CSRF sīkdatni. |
| `POST /api/auth/register` | Izveidot kontu un sesiju. |
| `POST /api/auth/login` | Pieslēgties ar darba e-pastu un paroli. |
| `GET /api/auth/me` | Pārbaudīt sesiju un iegūt profilu. |
| `GET /api/auth/stats` | Iegūt konta serverī publicēto dokumentu un komplektu skaitu. |
| `PUT /api/auth/password` | Mainīt paroli, norādot pašreizējo paroli. |
| `POST /api/auth/sessions/revoke` | Atsaukt pārējās sesijas un ierīču tokenus. |
| `POST /api/auth/logout` | Atsaukt pašreizējo pārlūka sesiju. |

Lietotnes API klienti sūta `X-GASO-Account` ar pašreizējā konta ID un rakstīšanas pieprasījumos izmanto `X-XSRF-TOKEN`. Serveris pārbauda, ka konta ID atbilst sesijai, un nosaka īpašnieku no autentificētā lietotāja.

[Datu modelis, īpašumtiesību indeksi un migrācijas instrukcija](docs/mongodb-windows.md#8-datu-modelis-un-api)

## Darbība un datu modelis

- Fotogrāfijas var kārtot, pagriezt, apgriezt un sadalīt vairākos dokumentos. Saglabājas oriģināli.
- OpenAI analizē izvēlētā dokumenta attēlus vienā pieprasījumā; Laravel pārbauda atbildes struktūru. Manuāli labotās vērtības saglabājas arī pēc atkārtotas analīzes.
- Atribūtu tabulā rediģē tikai vajadzīgos laukus; var pievienot, pārdēvēt un dzēst pielāgotus atribūtus. Datumi glabājas `YYYY-MM-DD`, summas — decimālvirknēs, valūta — trīs burtu kodā. Nenoteiktas vērtības ir `null`.
- Viena poga **Apstiprināt dokumentu** pārbauda visus aktīvos atribūtus un saglabā momentuzņēmumu. Nederīgi dati netiek apstiprināti. Vēlāki datu vai lapu labojumi padara apstiprinājumu neaktuālu.
- Dokumentu kartītes atver tikai lasāmu apskati ar visām lapām un atribūtiem. **Uz sākumu** vispirms saglabā izmaiņas; saglabāšanas kļūdas gadījumā darbs paliek atvērts.
- IndexedDB v4 atver glabātuvi `gaso-document-ai:account:<id>` tikai pēc sesijas pārbaudes. Melnraksti, attēli, komplekti, rezerves kopiju atjaunošana, sinhronizācijas rinda, pauze un iestatījumi ir piesaistīti šim kontam. Konta maiņa atceļ aktīvos pieprasījumus un pārlādē lietotni.
- Komplektā ir neatkarīgs dokumenta momentuzņēmums. Publicējot jaunu momentuzņēmumu, serveris pārbauda, vai avota dokuments un attēli pieder pašreizējam kontam. Iepriekš publicētie momentuzņēmumi saglabājas pēc avota labošanas vai dzēšanas.
- PDF ģenerē lokāli ar pdf-lib Worker un iegultu Noto Sans fontu. Neapstiprinātiem dokumentiem eksportē tikai skenējumu. PDF izveide ir atsevišķa darbība pēc apstiprināšanas, un failu var ģenerēt vēlāk.

Attēlu analīzes līgums: `POST /api/document-analysis` ar `consent=true` un sakārtotām `pages=[{id,number,image}]`, kur `image` ir JPEG/PNG/WebP base64 data URL. [Aktuālā attēlu analīzes shēma](docs/requirements/document-vision.schema.json); [atsevišķā OCR prototipa shēma](docs/requirements/document-analysis.schema.json).

## Limiti un privātums

Noklusējumi ir konfigurējami `backend/.env`:

| Iestatījums | Vērtība |
| --- | --- |
| `OPENAI_TIMEOUT` | 60 sekundes |
| `DOCUMENT_AI_MAX_OUTPUT_TOKENS` | 4000 |
| `DOCUMENT_AI_MAX_PAGES` | 20 |
| `DOCUMENT_AI_MAX_IMAGE_BYTES` | 4 000 000 baiti |
| `DOCUMENT_AI_MAX_IMAGE_TOTAL_BYTES` | 16 000 000 baiti |
| `DOCUMENT_AI_MAX_BODY_BYTES` | 22 000 000 baiti |
| `DOCUMENT_AI_REQUESTS_PER_MINUTE` | 3 |
| `DOCUMENT_AI_USER_REQUESTS_PER_MINUTE` | 3 vienam kontam |
| `DOCUMENT_AI_TEST_REQUEST_LIMIT` | 20 |

Klients sagatavo AI attēla kopiju līdz 2800 px / 8 MP, nemainot oriģinālu. PDF eksporta robežas: 20 skenētas lapas, 128 PDF lapas un 80 MiB gala fails.

AI analīzei vajag aktīvu kontu un lietotāja piekrišanu. Piemēro gan konta, gan kopējo minūtes limitu un kopējo prototipa budžetu. Jau nosūtīts pieprasījums var pabeigties arī pēc klienta atcelšanas.

Lietotne ar zaudētu savienojumu aizver piekļuvi dokumentiem līdz atkārtotai sesijas pārbaudei. IndexedDB, lokālie rezerves faili un lejupielādētie PDF satur nešifrētus datus. Pārlūka profila vai ierīces failu līmeņa piekļuve var atklāt šo saturu. Android tokeniem sagatavots Sanctum modelis ar darbības jomu, atsaukšanu un derīguma termiņu. Android pieslēgšanās un Keystore, lokālā dokumentu šifrēšana, darba e-pasta pārbaude un GASO SSO paliek nākamajiem posmiem.

## Atsevišķais OCR eksperiments

`tools/ocr-evaluation/` ir neatkarīgs Python komandrindas prototips, kas nav pieslēgts lietotnes aktīvajai plūsmai. Tam nepieciešams Python 3.11+ un atsevišķi instalēts Tesseract ar `lav`, `eng`, `rus` valodu datiem.

No projekta saknes PowerShell:

```powershell
python -m venv tools/ocr-evaluation/.venv
& tools/ocr-evaluation/.venv/Scripts/python.exe -m pip install -r tools/ocr-evaluation/requirements.txt
& tools/ocr-evaluation/.venv/Scripts/python.exe tools/ocr-evaluation/ocr_demo.py 'C:/dokumenti/piemers.pdf' --tesseract 'C:/Tesseract-OCR/tesseract.exe' --output tools/ocr-evaluation/private/result.json
& tools/ocr-evaluation/.venv/Scripts/python.exe -m unittest discover -s tools/ocr-evaluation/tests -v
```

Aizstāj piemēra ceļus ar saviem. Atbalstīti JPEG, PNG, vienkadru TIFF, WebP un PDF; robežas ir 25 MiB failam, 40 MP lapai un 20 PDF lapas. Pilnie OCR rezultāti var saturēt personas datus, tāpēc glabā tos privāti. PaddleOCR adapteris ir eksperimentāls un nav validēts; Docling integrācija nav ieviesta.

## Fonti un licences

Saskarne izmanto lokālu Manrope, PDF — Noto Sans; fontu CDN nav nepieciešams. Saglabāti fontu faili, avotu metadati un licences:

- [Manrope oficiālais avots](https://github.com/google/fonts/tree/main/ofl/manrope) un [SIL OFL licence](frontend/src/assets/fonts/Manrope-OFL.txt).
- [Noto Sans avota versija un SHA-256](frontend/src/assets/fonts/source.json) un [SIL OFL licence](frontend/public/licenses/NotoSans-OFL.txt).
- Pārējo piegādāto resursu licences: `frontend/public/licenses/`.

## Pārbaudes un pašreizējais statuss

Kontu pārbaudes aptver reģistrāciju, sesiju, paroles maiņu un atsaukšanu, divu kontu MongoDB un GridFS izolāciju, IndexedDB un rindas izolāciju pārlūkā un mantojuma migrācijas dry-run. PDF un AI regresijas pārbauda esošās darba plūsmas.

2026-11-24 pārbaudē izturēti 60 Laravel testi ar atsevišķu lokālo MongoDB replica set, 72 frontend vienību testi un 99 Playwright pārbaudes. Playwright rezultātā ietilpst 94 darbvirsmas un adaptīvā izkārtojuma pārbaudes, četras kontu pārbaudes 360 un 390 pikseļu skatā un viena atsevišķa Laravel sīkdatņu un CSRF pārbaude. Vite būvējums ir veiksmīgs. AI atbildes testos imitētas.

Android atpakaļpogas notikumu loģika pārbaudīta pārlūkā. Fiziskas ierīces pārbaude, APK būvēšana un korporatīvās API integrācija paredzēta nākamajiem posmiem.
