# GASO Document AI

GASO Document AI ir dokumentu fotografēšanas, AI analīzes un PDF izveides lietotne ar:

- `backend/` — Laravel 12 API, OpenAI attēlu analīzi un MongoDB dokumentu glabāšanu.
- `frontend/` — Vue 3 + Vuetify 3 saskarni, PWA un Capacitor Android projektu.
- `docs/` — datu shēmām, testiem un MongoDB iestatīšanas instrukciju.

Lietotājs pievieno dokumenta fotogrāfijas, pārskata un labo AI atrastos datus un apstiprina dokumentu ar vienu pogu. Saglabātos dokumentus var apskatīt, apvienot komplektos un eksportēt PDF. IndexedDB glabā darba kopiju bezsaistes režīmam. Ieslēdzot servera glabāšanu, dokumentus un komplektus saglabā MongoDB, bet fotoattēlus — MongoDB GridFS. Dokumenta apskate neveic AI pieprasījumus. Lokālais OCR lietotnes saskarnē ir atslēgts.

## Prasības

- PHP 8.2+ un Composer 2+.
- Node.js 22.13+ un npm.
- OpenAI API atslēga AI analīzei; manuāla ievade un PDF darbojas arī bez tās.

MongoDB glabāšana ir izvēles funkcija. Tai vajag MongoDB PHP paplašinājumu un pieejamu MongoDB serveri. [MongoDB iestatīšana Windows un VS Code](docs/mongodb-windows.md).

## Palaišana no VS Code

Atver projekta sakni Windows VS Code logā. Uzdevums izmanto WSL2 distribūciju `Ubuntu` ar PHP un Composer, kā arī Windows Node.js un npm. Pirmajai palaišanai sagatavo atkarības un `backend/.env`, izmantojot zemāk norādītās komandas.

1. Atver komandu paleti ar `Ctrl+Shift+P` un izvēlies **Tasks: Run Task** → **Start GASO Document AI**.
2. Laravel un Vue startē paralēli atsevišķos integrētajos termināļos. Kad abi serveri ir gatavi, atver **http://127.0.0.1:5173** vai turpini lietot līdzšinējo lokālo adresi, lai piekļūtu tajā pašā pārlūkā saglabātajiem dokumentiem.
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

Ja vēlies darbināt Laravel bez MongoDB PHP paplašinājuma, lieto `composer install --ignore-platform-req=ext-mongodb` un atstāj servera glabāšanu izslēgtu. Esošai konfigurācijai ģenerē lietotnes atslēgu tikai tad, ja `APP_KEY` ir tukša.

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

Atver **http://127.0.0.1:5173**. API darbojas **http://127.0.0.1:8000**; Vite pārsūta `/api` pieprasījumus uz backend. Lokālajai AI analīzei lietotni atver tajā pašā datorā ar šo adresi.

Ja AI neatbild, pārbaudi API serveri, atslēgu un OpenAI projekta kredītus. Pēc `.env` izmaiņām izpildi `php artisan config:clear` un pārstartē API serveri.

## Būvējums un testi

Mapē `frontend/`:

```powershell
npm.cmd run build       # Produkcijas būvējums un PWA
npm.cmd run preview     # Priekšskatījums: http://127.0.0.1:4173
npm.cmd run test:unit   # Vienību testi
npm.cmd run test:e2e    # Playwright testi, pirms tiem izveido būvējumu
```

Playwright testiem nepieciešams Google Chrome; `npm run test:e2e` pats palaiž priekšskatījuma serveri, tāpēc portam 4173 jābūt brīvam. PWA instalēšanu un bezsaistes režīmu pārbaudi produkcijas priekšskatījumā.

Mapē `backend/`:

```powershell
php artisan test
```

Automatizētajos AI testos izmanto imitētas atbildes, neveicot maksas API pieprasījumus.

## Darbība un datu modelis

- Fotogrāfijas var kārtot, pagriezt, apgriezt un sadalīt vairākos dokumentos. Saglabājas oriģināli.
- OpenAI analizē izvēlētā dokumenta attēlus vienā pieprasījumā; Laravel pārbauda atbildes struktūru. Manuāli labotās vērtības saglabājas arī pēc atkārtotas analīzes.
- Atribūtu tabulā rediģē tikai vajadzīgos laukus; var pievienot, pārdēvēt un dzēst pielāgotus atribūtus. Datumi glabājas `YYYY-MM-DD`, summas — decimālvirknēs, valūta — trīs burtu kodā. Nenoteiktas vērtības ir `null`.
- Viena poga **Apstiprināt dokumentu** pārbauda visus aktīvos atribūtus un saglabā momentuzņēmumu. Nederīgi dati netiek apstiprināti. Vēlāki datu vai lapu labojumi padara apstiprinājumu neaktuālu.
- Dokumentu kartītes atver tikai lasāmu apskati ar visām lapām un atribūtiem. **Uz sākumu** vispirms saglabā izmaiņas; saglabāšanas kļūdas gadījumā darbs paliek atvērts.
- IndexedDB v3 pievieno `storageSync` rindu esošajām `drafts`, `pages`, `images`, `collections` un `savedDocuments` glabātuvēm. Komplektā ir neatkarīgs dokumenta momentuzņēmums, kas paliek pieejams arī pēc avota labošanas vai dzēšanas.
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
| `DOCUMENT_AI_TEST_REQUEST_LIMIT` | 20 |

Klients sagatavo AI attēla kopiju līdz 2800 px / 8 MP, nemainot oriģinālu. PDF eksporta robežas: 20 skenētas lapas, 128 PDF lapas un 80 MiB gala fails.

Serveris attēlus pastāvīgi neglabā. Izmanto tikai dokumentus, kuru nosūtīšana OpenAI ir atļauta. Mēģinājumu limiti negarantē konkrētu naudas slieksni; tēriņus kontrolē arī OpenAI projektā. Klienta atcelšana negarantē serverī jau sāktas analīzes apturēšanu. Produkcijas AI piekļuve ir bloķēta līdz autentifikācijas un lietotāju kvotu ieviešanai; korporatīvais GASO API nav pieslēgts.

Pārlūka datu dzēšana izdzēš lokālos dokumentus un komplektus. Svarīgos PDF lejupielādē; lietotne neglabā lejupielādētā PDF arhīvu.

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

Pēdējā mobilās UX pārbaudē (2026-11-17) izturēti **68/68 frontend vienību testi** un **234/234 Playwright pārbaudes**; produkcijas būvējums veiksmīgs. Pārbaudīti 360 px, 390 px un darbvirsmas ekrāni, abas tēmas, bezsaistes režīms, validācija, vecie melnraksti, komplekti un PDF. AI atbildes testos ir imitētas.

Android atpakaļpogas notikumu loģika pārbaudīta pārlūkā. Fiziskas ierīces pārbaude, APK būvēšana un korporatīvās API integrācija paredzēta nākamajiem posmiem.
