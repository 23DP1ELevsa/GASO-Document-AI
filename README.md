# GASO Document AI

## Projekta apraksts

GASO Document AI ir topošā Android mobilā lietotne un progresīvā tīmekļa lietotne (PWA) drukātu dokumentu fotografēšanai, digitalizēšanai, automātiskai klasificēšanai, datu iegūšanai un arhivēšanai. Abas platformas izmanto kopīgu Vue koda bāzi. Ar telefona kameru lietotājs vienā sesijā varēs secīgi fotografēt dažādu dokumentu lapas, piemēram, rēķinus, līgumus un iesniegumus.

Projekta uzdevumi tiek pārvaldīti [GASO Document AI Trello dēlī](https://trello.com/b/J6ecDlQE/gaso-document-ai-projekta-izstrade).

## Projekta mērķis

Samazināt manuālu dokumentu reģistrēšanu un datu pārrakstīšanu, atvieglojot drukātu dokumentu digitalizāciju. Lietotājam būs iespēja pārbaudīt un labot gan dokumentu grupējumu, gan iegūtos datus pirms reģistrēšanas un arhivēšanas.

## Galvenās funkcijas

Turpmāk aprakstīta plānotā pilnā dokumentu apstrāde. Pašlaik `frontend/` ir realizēts 1.–5. posms: četri navigācijas ekrāni, gaišais/tumšais režīms, PWA, Capacitor Android projekta pamats, skenēšanas sesijas, lokāls attēlu redaktors, Tesseract.js OCR, manuāla dokumentu grupēšana un rediģējamas dokumentu informācijas kartītes. Var pievienot attēlus, meklēt vai manuāli izvēlēties dokumenta stūrus, iztaisnot perspektīvu, pagriezt attēlu, piemērot filtrus, atpazīt latviešu/angļu/krievu tekstu un saglabāt labojamus rezultātus IndexedDB. Lokālie teksta noteikumi piedāvā pārbaudāmus atribūtus; ārēji MI pakalpojumi nav pieslēgti. Fotografēšana izmanto pārlūka failu/kameras izvēli; tieša Capacitor Camera integrācija nav ieviesta. PDF un reģistrēšana vēl nav realizēta. Atsevišķais Python OCR komandrindas prototips nav mainīts un nav pieslēgts mobilajai lietotnei.

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

| Joma                 | Tehnoloģija vai risinājums                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Lietotāja saskarne   | Vue 3, Composition API, JavaScript, Vuetify 3, Vue Router 4, Vite                                                                 |
| Servera puse         | PHP, Laravel 12                                                                                                                   |
| Datubāze             | MongoDB                                                                                                                           |
| Mākslīgais intelekts | GASO saskaņotais korporatīvais MI API; detaļas tiks precizētas                                                                    |
| Attēlu apstrāde      | Pārlūkā: Web Worker, OffscreenCanvas, robežu kandidātu analīze un homogrāfija JavaScript; OpenCV.js izvērtēts, bet nav pievienots |
| Lokāls OCR           | Tesseract.js 7.0.0, WebAssembly/Web Worker, ar lietotni piegādāti `tessdata_fast` 4.1.0 modeļi `lav`, `eng`, `rus`                |
| PDF ģenerēšana       | Piemērota PDF izveides bibliotēka; izvēle vēl jāveic                                                                              |
| Mobilā lietotne      | Capacitor 8 Android un PWA ar kopīgu Vue koda bāzi                                                                                |
| Autorizācija         | Laravel Sanctum                                                                                                                   |
| Izvietošana          | Railway, ja izvietojums tiks saskaņots                                                                                            |
| Versiju kontrole     | Git un GitHub                                                                                                                     |

## Projekta struktūra

```text
GASO-Document-AI/
├── backend/
│   └── .env.example
├── frontend/
│   ├── package.json
│   ├── capacitor.config.json
│   ├── vite.config.js
│   ├── src/                  # Ekrāni, komponentes, navigācija, lokalizācija
│   ├── public/               # Lokālas prototipa ikonas
│   ├── android/              # Capacitor ģenerēts Android projekts
│   ├── scripts/              # Ikonu ģenerēšana un Android būvēšana
│   └── tests/                # Playwright pārlūka pārbaudes
├── docs/
│   ├── requirements/
│   │   ├── corporate-ai-api.md
│   │   ├── document-types.md
│   │   ├── document-attributes.md
│   │   └── document-analysis.schema.json
│   ├── diagrams/
│   │   ├── document-processing-architecture.md
│   │   └── mobile-architecture.md
│   └── testing/
│       ├── test-dataset-plan.md
│       ├── ocr-comparison.md
│       ├── preparation-summary.md
│       ├── mobile-foundation.md
│       ├── scanning-sessions.md
│       └── image-processing.md
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
- `frontend/` — patstāvīgi palaižama Vue mobilā/tīmekļa saskarne, PWA un Android projekts.
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

## Mobilās lietotnes palaišana Windows vidē

Visas frontend komandas izpilda `frontend/` mapē. Backend, Python OCR vide un API atslēgas saskarnes palaišanai nav nepieciešamas.

### Priekšnoteikumi

| Rīks                   | Prasība                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Node.js                | Vismaz 22.12; ieteicama Node.js 24 LTS. Izstrādē pārbaudīta 24.15.0                                                           |
| npm                    | Kopā ar Node.js; atkarību reproducēšanai izmantot `npm ci` un saglabāto `package-lock.json`                                   |
| Pārlūks                | Aktuāls Chrome, Edge vai cits mūsdienīgs pārlūks; automatizētie testi izmanto instalētu Chrome                                |
| Android Studio         | Otter 2025.2.1 vai jaunāks, nepieciešams tikai Android palaišanai                                                             |
| Android SDK            | Platform 36, Build Tools 36.0.0, Platform Tools; emulators pēc vajadzības                                                     |
| Java Android būvēšanai | JDK 21; Android Studio iestatījumos izvēlēties saderīgu Gradle JDK. Šajā vidē atrastā Java 27 nav validēta ar projekta Gradle |
| Android ierīce         | Android 7.0 / API 24 vai jaunāka; ieteicams testēt arī API 35/36 un aktuālu Android System WebView                            |

Prasības pārbaudītas [Capacitor vides dokumentācijā](https://capacitorjs.com/docs/getting-started/environment-setup), [Capacitor 8 Android konfigurācijā](https://capacitorjs.com/docs/updating/8-0) un [Vite dokumentācijā](https://vite.dev/guide/). Izmantots tieši [Vuetify 3](https://v3.vuetifyjs.com/en/getting-started/installation/), kā prasīts uzdevumā. Precīzās instalētās atkarību versijas fiksē `frontend/package-lock.json`.

```powershell
cd C:\Users\eduar\Desktop\GASO-Document-AI\frontend
npm.cmd ci
npm.cmd run dev
```

Atveriet `http://localhost:5173`. `npm.cmd` darbojas arī PowerShell vidē, kur skriptu politika bloķē `npm.ps1`. Izstrādes serveris klausās arī lokālajā tīklā; tālrunī izmantojiet datora LAN adresi. PWA instalēšanai ārpus `localhost` nepieciešams HTTPS. Parasts LAN HTTP savienojums ir piemērots saskarnes apskatei, bet ne PWA instalēšanas pārbaudei.

Pirms atkārtotas `npm.cmd ci` izpildes apturiet šī projekta Vite izstrādes/priekšskatījuma serveri ar **Ctrl+C** tā terminālī. Windows vidē darbojošs Vite process var bloķēt Rolldown `.node` failu un izraisīt `EPERM: operation not permitted, unlink`. Pēc servera apturēšanas atkārtojiet `npm.cmd ci`; administratora režīms šāda faila bloķējuma novēršanai nav nepieciešams.

Produkcijas tīmekļa būvējums un lokāls priekšskatījums:

```powershell
npm.cmd run build
npm.cmd run preview
```

Atveriet `http://localhost:4173`. `dist/` satur izvietošanai paredzēto tīmekļa versiju. Navigācijai izmantots URL fragments (`/#/scan`), tādēļ nav nepieciešami servera maršrutu pārrakstīšanas noteikumi. Pašreizējā PWA bezsaistes navigācijas konfigurācija paredz izvietošanu domēna saknē.

### Android projekta atvēršana un palaišana

`frontend/android/` jau ir pievienots. Atkārtoti palaist `cap add android` nav nepieciešams.

```powershell
npm.cmd run android:sync
npm.cmd run android:open
```

Android Studio var arī izvēlēties **Open** un atvērt `GASO-Document-AI\frontend\android` mapi. Ļaujiet Gradle pabeigt sinhronizāciju. **Tools → SDK Manager** instalējiet Android SDK Platform 36, Build Tools 36.0.0 un Platform Tools; emulatoram arī Emulator un atbilstošu sistēmas attēlu. **Settings → Build, Execution, Deployment → Build Tools → Gradle** izvēlieties JDK 21. SDK atrašanās vietu Android Studio ieraksta lokālajā `android/local.properties`; šo failu nepublicē.

Izveidojiet emulatoru ar **Device Manager** vai pieslēdziet tālruni ar iespējotu USB atkļūdošanu, apstipriniet datora piekļuvi ierīcē un nospiediet **Run** modulim `app`. Alternatīvi:

```powershell
npm.cmd run android:run
```

Atkārtoti izpildiet `android:sync` pēc Vue vai Capacitor konfigurācijas izmaiņām. Tas sagatavo native būvējumu bez service worker un kopē to Android projektā. `android:open` pats nepārbūvē Vue saskarni.

Debug APK no komandrindas, kad SDK un JDK ir uzstādīti:

```powershell
# Ja JAVA_HOME vēl nav iestatīts, norādiet reālo JDK 21 instalācijas ceļu:
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
# Norādiet sava Android SDK atrašanās vietu:
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm.cmd run android:build
```

Rezultāts veiksmīgas būvēšanas gadījumā: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. Tas nav publicēšanai parakstīts release būvējums. Darba beigās šajā datorā ir atrasts Android Studio 2026.2.2 un SDK Build Tools 36.0.0, taču vēl nav `platforms/android-36`. Atrasta Java 27 un Studio JBR 25; šim projektam jāizvēlas JDK 21. APK nav būvēts un darbība Android ierīcē nav pārbaudīta.

Capacitor konfigurācija: nosaukums `GASO Document AI`, `webDir: dist`, pagaidu identifikators **`lv.gaso.documentai.prototype`**. Pirms oficiālas publicēšanas identifikators jāsaskaņo ar GASO. Ikonas un splash izmanto projekta neitrālu dokumenta simbolu, nevis oficiālo GASO logotipu. To avots ir `frontend/public/icon.svg`; pēc izmaiņām izpildiet `npm.cmd run assets` un `npm.cmd run android:sync`.

### Pašreizējās funkcijas

- Četri latviski ekrāni: **Sākums**, **Skenēt**, **Dokumenti**, **Iestatījumi**; Vue Router navigācija bez lapas pārlādes.
- Apakšējā navigācija tālrunī un sānu navigācija darbvirsmā; izkārtojums arī 360 px platumā.
- Gaišais un tumšais režīms ar ierīcē saglabātu izvēli. Ja pārlūks liedz lokālo glabāšanu, saskarne turpina darboties un paskaidro ierobežojumu.
- Pārlūka fotografēšanas/failu izvēle, vienlaicīgs vairāku attēlu imports un mazi lapu priekšskatījumi.
- Lapu pārvietošanas pogas, lielais priekšskatījums, aizstāšana un dzēšana; jaunas sesijas izveide un apstiprināta sesiju dzēšana.
- Lokāli saglabājami IndexedDB melnraksti ar atjaunošanu pēc pārlādes un turpināšanu dokumentu sadaļā. Melnraksti netiek attēloti kā reģistrēti MongoDB dokumenti.
- Lokāls skenējuma redaktors: automātisku robežu kandidātu meklēšana ar manuālu izvēli neskaidrībā, četru stūru pārvietošana, perspektīva, pagriešana un četri filtri. Oriģināls saglabājas atsevišķi no apstrādātā PNG.
- Lokāls OCR vienai vai visām sesijas lapām ar progresu un apturēšanu; vairāku valodu izvēle, sākotnējais un lietotāja labotais teksts, IndexedDB saglabāšana un aktualitātes brīdinājums pēc attēla maiņas.
- Android atpakaļpogas apstrāde: iepriekšējais lietotnes maršruts; tieši atvērtā sadaļā — sākums; sākumā — lietotnes aizvēršana. Drošās zonas un sistēmas joslu stils pielāgoti Capacitor.
- Lietotnes versija, lokālā režīma un plānotā MI skaidrojums, GitHub saite.
- Atsevišķa latviešu tulkojumu vārdnīca; angļu un krievu valoda vēl nav tulkota.

### PWA

[`vite-plugin-pwa` konfigurācija](https://vite-pwa-org.netlify.app/guide/) ģenerē manifestu, service worker un interfeisa bezsaistes kešu tikai tīmekļa produkcijas būvējumam. Kešā ir būvējumā iekļautie JS/CSS, sākuma HTML, manifests un ikonas, arī vēl neatvērto ekrānu koda faili. Publiskie OCR izpildes faili un izvēlēto valodu modeļi tiek kešoti pēc pieprasījuma; tos var iepriekš sagatavot iestatījumos. Nav dokumentu, attēlu augšupielāžu vai API atbilžu runtime kešošanas. Lietotne neielādē ārējus fontus un neizmanto analītiku.

Pēc sākotnējās tiešsaistes ielādes un service worker aktivizācijas interfeiss ir atverams bez interneta. Chrome/Edge piedāvā instalēšanu no pārlūka izvēlnes; ja pārlūks dod instalēšanas notikumu, poga parādās arī iestatījumos. Šis piedāvājums atkarīgs no pārlūka un ierīces. Atjauninājumiem ir apstiprināma poga, nevis automātiska lapas pārlāde darba laikā. Izstrādes režīmā service worker nav ieslēgts. Android native būvējumā tas ir izslēgts, jo interfeiss jau tiek piegādāts APK.

PWA interfeisa kešs nav dokumentu krātuve. Melnraksti, oriģināli un apstrādāto attēlu Blob tiek glabāti atsevišķā IndexedDB datubāzē; tie netiek ievietoti service worker kešā. Lokālā Worker koda fails ietilpst interfeisa kešā, tādēļ arī redaktors darbojas bezsaistē pēc sākotnējās ielādes. Privātuma, glabāšanas termiņu un piekļuves kontroles prasības reāliem uzņēmuma dokumentiem joprojām jāprecizē pirms produkcijas lietošanas.

### 2. posms: attēli un skenēšanas sesijas pārlūkā

Atveriet projekta mapi VS Code un **Terminal → New Terminal**. Ja atkarības jau instalētas, pietiek ar:

```powershell
cd frontend
npm.cmd run dev
```

Atveriet `http://localhost:5173` un sadaļu **Skenēt**. Android Studio šīm darbībām nav vajadzīga.

1. **Fotografēt** izmanto `input type="file"`, `accept="image/*"` un `capture="environment"`. Mobilais pārlūks var piedāvāt aizmugurējo kameru; konkrēto izvēli nosaka pārlūks un ierīce. Datorā vai bez kameras atbalsta var izvēlēties failu. Ja tālrunis izveido HEIC attēlu, to vispirms jāeksportē JPEG/PNG formātā.
2. **Pievienot no galerijas** ļauj izvēlēties vienu vai vairākus JPEG, PNG vai WebP attēlus. Atkārtota pievienošana saglabā iepriekšējās lapas. Atcelta failu izvēle nemaina sesiju; to pašu failu drīkst pievienot atkārtoti.
3. Zem katra numurēta priekšskatījuma ir pārvietošanas pogas. Nospiežot attēlu, atveras apstiprinātās attēla versijas lielais priekšskatījums; oriģināls vienmēr pieejams redaktorā. Trīs punktu izvēlnē ir rediģēšana, aizstāšana un lapas dzēšana. Aizstāšana saglabā lapas pozīciju, bet jaunajam attēlam nav iepriekšējās fotogrāfijas apstrādes parametru.
4. **Saglabāt melnrakstu** ieraksta visu sesiju lokālajā krātuvē. Veiksmes paziņojums parādās tikai pēc IndexedDB transakcijas pabeigšanas. Lapu secība, aizstāšana un dzēšana jāsaglabā ar šo pogu. Līdz tam saglabātā versija paliek neskarta.
5. **Dokumenti** rāda melnrakstu pirmās lapas priekšskatījumu, izveidošanas/rediģēšanas laiku un lapu skaitu. **Turpināt** atver sesiju. Dzēšana prasa apstiprinājumu un izdzēš arī sesijas attēlus.
6. **Jauna sesija** sāk tukšu sesiju; ja ir nesaglabātas izmaiņas, tās pirms atmešanas jāapstiprina. Esošais saglabātais melnraksts netiek dzēsts. Atvērta sesija saglabājas atmiņā, pārejot starp lietotnes sadaļām.

Ja sesija saglabāta, tās adrese satur melnraksta ID; pēc pārlādes melnraksts atjaunojas. Pēdējā saglabātā melnraksta ID tiek glabāts arī cilnes `sessionStorage`, lai to atvērtu, atgriežoties skenēšanas sadaļā pēc pārlādes. **Nesaglabātas izmaiņas pēc pārlādes zūd**; pārlūks, ja atbalsta, brīdina par aiziešanu no lapas. Automātiska saglabāšana nav ieslēgta. No jauna tukšu sesiju nevar saglabāt; jau saglabātā melnrakstā drīkst izdzēst visas lapas un saglabāt tukšo sesiju turpmākai papildināšanai.

#### Failu un sesijas ierobežojumi

| Ierobežojums           | Vērtība                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| Formāti                | JPEG, PNG, WebP, kuru saturs un deklarētais MIME tips atbilst un kurus pārlūks spēj dekodēt |
| Faila izmērs           | 1 baits līdz 25 MiB katram attēlam                                                          |
| Izšķirtspēja           | Līdz 40 megapikseļiem un 16 000 px jebkurā malā                                             |
| Sesijas apjoms         | Līdz 20 lapām un 200 MiB oriģinālu kopā                                                     |
| Mazais priekšskatījums | Līdz 480 px garākajā malā, JPEG; oriģināla kvalitāti tas nemaina                            |
| Neatbalstīts           | PDF, HEIC/HEIF, SVG, GIF, bojāti un pārlūkā neatverami attēli                               |

Faila saturs un attēla galvenes izmēri tiek pārbaudīti pirms rastra dekodēšanas. Attēli tiek apstrādāti secīgi; vienlaikus netiek dekodēti visi oriģināli. Saglabājas sākotnējie attēla baiti bez pārkodēšanas, samazināšanas vai EXIF metadatu noņemšanas. Priekšskatījumu orientācijai izmanto pārlūka EXIF atbalstu; liels priekšskatījums ielādē tikai izvēlēto oriģinālu. Animētu attēlu plūsma nav paredzēta skenēšanas funkcija.

#### Lokālās krātuves darbība un robežas

`frontend/src/features/scanning/draftRepository.js` veido atsevišķu glabāšanas moduli. IndexedDB datubāzē `gaso-document-ai` ir trīs krātuves:

- `drafts` — ID, izveidošanas/rediģēšanas laiks, statuss `draft`, revīzija, sakārtots lapu ID saraksts un mazs vāka priekšskatījums;
- `pages` — lapu ID, attēla nosaukums, sākotnējie izmēri un priekšskatījuma Blob/metadati; apstrādātām lapām arī `processing`, rezultāta izmēri un `modifiedAt`;
- `images` — oriģinālais `blob` pēc lapas ID un neobligāts apstrādātais `processed` Blob tajā pašā ierakstā.

Saglabāšana un dzēšana ir atomāras transakcijas visās trīs krātuvēs. Dzēstas vai aizstātas lapas pēc saglabāšanas vairs neatstāj neizmantotus attēlus. Ja trūkst vietas vai IndexedDB nav pieejama, lietotne parāda kļūdu, saglabā pašreizējās izmaiņas atmiņā un ļauj mēģināt vēlreiz. Vecāka citā cilnē atvērta versija nevar klusām pārrakstīt jaunāku saglabājumu. Pārskatīšanai izveidotie Object URL tiek atbrīvoti pēc attēla maiņas vai komponentes aizvēršanas.

Melnraksti ir pieejami **tikai tajā pašā pārlūka profilā un origin**: `localhost:5173`, `127.0.0.1:5173` un `localhost:4173` ir atšķirīgas krātuves. Tie nav sinhronizēti vai automātiski dublēti. Pārlūka datu dzēšana, privātā režīma aizvēršana vai pārlūka veikta krātuves atbrīvošana var izdzēst melnrakstus. Krātuve nav atsevišķi šifrēta vai aizsargāta ar lietotnes autentifikāciju. Attēlu saturs un failu nosaukumi netiek sūtīti uz serveri vai rakstīti konsolē. Neizmantojiet šo prototipu kā vienīgo svarīgu dokumentu kopiju.

Failu izvēle, attēlu sagatavošana, sesijas stāvoklis un glabāšana ir nodalīti. Vēlāk Capacitor Camera/Filesystem adapteri varēs pievienot, saglabājot lapu datu struktūru un lietotāja saskarni. Šajā posmā Android atļaujas, spraudņi un projekta struktūra nav mainīti; native kamera un APK nav pārbaudīti.

Pamatā izmantotas pārlūka API: [IndexedDB transakcijas](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [attēlu dekodēšana un orientācija](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [kameras capture atribūts](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture) un [Object URL atbrīvošana](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static).

### 3. posms: dokumenta attēla redaktors

Palaidiet `npm.cmd run dev` mapē `frontend/`, atveriet `http://localhost:5173`, pievienojiet attēlu vai atveriet melnrakstu. Lapas trīs punktu izvēlnē izvēlieties **Rediģēt skenējumu**. Atkarības nav papildinātas; aktuālā Chrome/Edge pārlūkā izmanto vietējos Worker, ImageBitmap un OffscreenCanvas API. Android Studio nav vajadzīga.

1. Redaktors parāda oriģinālu ar četriem numurētiem stūriem un atsevišķu rezultāta priekšskatījumu. Vecai, vēl neapstrādātai lapai automātiski tiek meklēts robežu kandidāts. Jau apstrādāta lapa atveras ar saglabātajiem parametriem, tos automātiski nemainot.
2. **Noteikt robežas** atkārto meklēšanu. Ja kandidāts nav pietiekami skaidrs, parādās manuālas izvēles paziņojums. Pilna fotoattēla rāmis ir sākotnējā atlase, nevis atpazīts dokuments.
3. Velciet katru stūri ar peli vai pirkstu. **Pietuvinājums** palielina darba attēlu līdz 300%; palielināto attēlu var ritināt. Koordinātas tiek aprēķinātas no faktiskā attēla novietojuma, arī pietuvinājumā.
4. Ar Tab atlasītam stūrim izmantojiet bulttaustiņus; Shift palielina soli. **Precīzas koordinātas (%)** ļauj ievadīt katra stūra X/Y procentus. Paškrustojoša, apgriezti sakārtota, pārāk maza vai ārpus attēla esoša atlase netiek apstrādāta. **Atiestatīt stūrus** atgriež pilna attēla atlasi.
5. **Priekšskatīt** piemēro īstu četrpunktu perspektīvas pārveidi. Mainot stūrus, iepriekšējais rezultāts ir atzīmēts kā neatjaunināts. Pirms apstiprināšanas tas jāatjauno.
6. Pagriešanas pogas darbojas par 90° pa kreisi/pa labi un par 180°. **Atiestatīt pagriezienu** atgriež sākotnējo importētā attēla orientāciju, saglabājot izvēlēto apgabalu un filtru.
7. Izvēlieties filtru un salīdziniet rezultātu ar oriģinālu. **Atjaunot oriģinālu** atiestata apgriešanu, filtru un pagriezienu. Tas vēl ir tikai redaktora priekšskatījums, līdz izmaiņas apstiprinātas.
8. **Apstiprināt izmaiņas** sagatavo rezultātu no oriģināla pietiekamā izšķirtspējā un nomaina lapas priekšskatījumu aktīvajā sesijā. Pēc tam nospiediet **Saglabāt melnrakstu**, lai dati būtu pieejami pēc pārlādes. **Atcelt rediģēšanu** atstāj lapas iepriekšējo stāvokli; darbojas arī procesa laikā, apturot Worker.

#### Robežu noteikšana un perspektīva

Robežu meklēšana strādā uz kopijas ar ne vairāk kā 900 px garajā malā: pelēktoņi, 3 × 3 Gausa izlīdzināšana, Sobel gradients un gaišu apgabalu maskas vairākos sliekšņos. Saistīto komponentu robežām veido izliektus apvalkus, meklē četrus stūrus un precizē malas ar līniju pielāgošanu. Kandidātus vērtē pēc izliekuma, laukuma, attāluma no attēla malas, katras malas atbalsta un gaišuma atšķirības abās robežas pusēs. Laukums ir tikai viena vērtējuma daļa; lielākais četrstūris netiek automātiski uzskatīts par dokumentu. Līdzīgi ticami kandidāti nozīmē manuālu izvēli.

**Tas ir heiristisks kandidātu meklētājs, nevis garantēta dokumenta atpazīšana.** Spēcīgas ēnas, mazs kontrasts uz gaiša fona, fona faktūra, atspīdumi, vairāki dokumenti, salocīta lapa, neliels dokuments vai malas pie paša kadra var prasīt manuālu izvēli. Pat piedāvātam kandidātam jāpārbauda visi četri stūri. Vērtējums nav statistiska atpazīšanas varbūtība.

Perspektīvai aprēķina homogrāfiju no taisnstūra uz izvēlēto četrstūri un izmanto apgriezto pikseļu kartēšanu ar bilineāru interpolāciju. Rezultāta malu garumus nosaka izvēlētā četrstūra pretējās malas; **A4 proporcija netiek uzspiesta**. Koordinātas glabā `[0, 1]` diapazonā pret EXIF orientācijai pielāgoto oriģinālu. Reālā lapas izmēra/proporciju atjaunošana no viena foto bez kameras kalibrācijas nav garantēta.

OpenCV.js tika izvērtēts pēc [oficiālās ģeometrisko transformāciju dokumentācijas](https://docs.opencv.org/4.x/dd/d52/tutorial_js_geometric_transformations.html). Šim ierobežotajam darbību kopumam izvēlēts neliels lokāls JavaScript modulis bez papildu WASM izpildvides un asinhronas OpenCV inicializācijas. Tas nav apgalvojums par OpenCV.js nesaderību; bibliotēka nav instalēta vai salīdzinoši mērīta. Esošo algoritmu vēlāk var aizstāt, saglabājot normalizēto stūru un filtru parametru formātu.

#### Filtri

| Režīms            | Darbība                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Oriģinālās krāsas | Bez krāsu filtra; izvēlētā perspektīva un pagrieziens joprojām ir spēkā                                 |
| Uzlabots          | Mērena histogrammā balstīta gaišuma/kontrasta korekcija ar ierobežotu pastiprinājumu, saglabājot krāsas |
| Pelēktoņi         | Svērts RGB gaišuma pārveidojums                                                                         |
| Melnbalts         | Adaptīvs lokāls slieksnis, kas seko lēnām apgaismojuma izmaiņām                                         |

Sīkas tabulu līnijas, bāli zīmogi un vāji simboli jāpārbauda priekšskatījumā; īpaši melnbaltais režīms var mainīt to salasāmību. Vienmēr var mainīt filtru vai atjaunot oriģinālu.

#### Oriģināli, saderība un resursi

Redaktors vienmēr sāk ar **oriģinālo Blob**, nevis iepriekš saglabāto rezultātu. Apstiprināto rezultātu glabā PNG, bet oriģināla baiti un EXIF netiek pārrakstīti. JPEG tiek izmantots tikai maziem ekrāna priekšskatījumiem. Saglabājas stūri, algoritma parametru `version: 1`, filtrs, pagrieziens, rezultāta izmēri un pēdējo izmaiņu laiks. Atjaunojot oriģinālu un saglabājot melnrakstu, apstrādātais Blob tiek izņemts.

IndexedDB krātuvju struktūra un datubāzes **versija 1 paliek spēkā**: pievienoti neobligāti ierakstu lauki, neveidojot jaunas krātuves vai indeksus. Nav vajadzīga destruktīva migrācija vai veco attēlu pārrakstīšana. Veciem ierakstiem bez `processing` redaktors izmanto pilnu attēlu, 0° pagriezienu un sākotnējās krāsas. Lapas secības maiņa saglabā parametrus, aizstāšana sāk jaunu neapstrādātu attēlu, dzēšana izņem abus attēlus. Apstiprināta apstrāde un oriģināls tiek saglabāti vienā melnraksta transakcijā; kļūmes gadījumā paliek iepriekšējais saglabājums.

| Apstrādes resurss         | Ierobežojums                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Importa oriģināls         | Iepriekšējie 25 MiB / 40 MP / 16 000 px ierobežojumi                                 |
| Darba rastrs              | Līdz 16 MP un 6000 px vienā malā; lielāks oriģināls paliek neskarts                  |
| Robežu analīze            | Līdz 900 px garākajā malā                                                            |
| Rezultāta priekšskatījums | Līdz 1200 px garākajā malā                                                           |
| Saglabājamais rezultāts   | Līdz 8 MP un 5000 px vienā malā; PNG, bez mākslīgas palielināšanas                   |
| Rezultāta Blob            | Līdz 48 MiB; pārlūka faktiskā IndexedDB kvota var būt mazāka                         |
| Viens Worker darbs        | Līdz 45 sekundēm, atceļams; vienai redaktora instancei vienlaikus ir viena operācija |

Aprēķini notiek [Web Worker ar OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas). Katrā darbā rastri un Blob URL tiek atbrīvoti, Worker pēc darba tiek [apturēts](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate). Kļūme vai atcelšana nemaina oriģinālu. Lielākā apjoma attēlu veiktspēja fiziskos mazatmiņas tālruņos vēl jāpārbauda.

### 4. posms: lokāls OCR pārlūkā

Tiek izmantots **Tesseract.js 7.0.0** ar **`lav`, `eng`, `rus`** modeļiem no oficiālā `tessdata_fast` 4.1.0 laidiena. Noklusējums ir latviešu valoda; iespējama vairāku valodu izvēle. OCR nav vajadzīgs backend, Python, Android Studio vai API atslēgas.

```powershell
cd frontend
npm.cmd ci
npm.cmd run ocr:prepare
npm.cmd run dev
```

`ocr:prepare` kopē worker un sešus WebAssembly kodolus no instalētajām npm pakotnēm, lejupielādē trīs konkrētas versijas valodu modeļus un pārbauda to SHA-256 kontrolsummas. `dev`, `build` un `android:sync` šo sagatavošanu izpilda automātiski. Pirmajai sagatavošanai nepieciešams internets; atkārtoti izmanto jau sagatavotos, pārbaudītos modeļus. Faili `frontend/public/ocr/v7-fast-4-1-0/` un `dist/ocr/` kopā aizņem aptuveni **34,9 MiB**. Tie tiek ģenerēti lokāli; avota kontrolē saglabāts sagatavošanas skripts un versiju/kontrolsummu fails. Licences kopētas `licenses/` apakšmapē.

1. Sadaļā **Skenēt** pievienojiet lapas un vajadzības gadījumā koriģējiet attēlus esošajā redaktorā. OCR izmanto pašreizējo pilna izmēra apstrādāto attēlu; mazais kartītes priekšskatījums netiek izmantots.
2. Izvēlieties **Dokumenta OCR valodas** sesijas sadaļā vai iestatījumos. Izvēle saglabājas pārlūkā. Nevajadzīgie modeļi netiek ielādēti OCR atmiņā.
3. Lapas kartītē spiediet **Atpazīt tekstu** vai sesijas sadaļā **Atpazīt visas lapas**. Lapas apstrādā secīgi vienā atkārtoti lietojamā OCR worker. Redzams progress, lapu skaits un kļūdas; procesu var apturēt.
4. Rezultāta dialogā salīdziniet attēlu un tekstu. Var pārslēgt lapu, rediģēt, kopēt un atkārtot OCR. **Saglabāt tekstu** saglabā laboto tekstu un visu sesiju. Sākotnējais OCR teksts paliek atsevišķi apskatāms.
5. OCR rezultāti tiek automātiski saglabāti pēc katras lapas. Ja saglabāšana neizdodas, kļūda tiek parādīta un rezultāts paliek atmiņā atkārtotai saglabāšanai. Pēc attēla rediģēšanas agrākajam tekstam parādās aktualitātes brīdinājums. Atkārtotai atpazīšanai ar esošu rezultātu vajadzīgs lietotāja apstiprinājums.
6. **Visu lapu teksts sesijas secībā** parāda katras lapas saglabāto tekstu ar lapu atdalījumiem. Sesijas lapas netiek automātiski uzskatītas par vienu dokumentu.

OCR izpildes laikā attēli un teksts netiek nosūtīti ārējiem serveriem. `workerPath`, `corePath` un `langPath` norāda tikai uz lietotnes paša failiem. Modelis tiek ielasīts pēc vajadzības un papildus kešots Tesseract IndexedDB krātuvē.

**Bezsaistes darbam:** izveidojiet tīmekļa būvējumu (`npm.cmd run build`), palaidiet `npm.cmd run preview` un atveriet `http://localhost:4173`. Sagaidiet PWA aktivizāciju. Iestatījumos izvēlieties vajadzīgās valodas un spiediet **Sagatavot OCR bezsaistei**. Poga saglabā un pārbauda worker, trīs LSTM kodola variantus un izvēlētos modeļus (aptuveni 14–22 MiB). Pēc sagatavošanas OCR nav vajadzīgs savienojums pat ar lietotnes serveri; izstrādes `dev` režīmam nav PWA interfeisa keša. Pārlūka datu dzēšana var noņemt gan resursus, gan melnrakstus.

[OCR integrācijas pārskats, datu struktūra, licences un faktiskie pārbaužu rezultāti](docs/testing/local-ocr.md). OCR dod tekstu un dzinēja ticamības vērtējumu; tas vēl neizprot rēķinu rekvizītus vai līguma saturu. Rezultāts jāpārbauda lietotājam.

### 5. posms: dokumentu grupēšana un informācijas kartītes

Sadaļā **Skenēt**, zem lapu priekšskatījumiem, ir **Dokumentu grupas**. Darbs notiek pārlūkā; nav jaunu atkarību vai API atslēgu.

1. Atzīmējiet **Nepiesaistītās lapas**, ievadiet nosaukumu un spiediet **Izveidot dokumentu**. Bez atlases izveidojas tukša grupa.
2. **Rediģēt grupējumu un lapu secību** ļauj pārvietot atlasītas lapas uz citu dokumentu vai nepiesaistīto lapu sarakstu. Bultiņas maina dokumenta lapu secību. **Atdalīt jaunā dokumentā** izveido dokumentu no atlasītās lapu daļas ar jaunu, tukšu kartīti.
3. **Apvienošana un grupas dzēšana** ļauj pievienot grupas lapas cita dokumenta beigās. Pirms apvienošanas jāapstiprina, ka saglabāsies mērķa kartītes dati. **Dzēst grupu, saglabājot lapas** izņem grupu un tās kartīti; attēli un OCR paliek nepiesaistīti.
4. **Dokumenta informācija** rāda rediģējamu tabulu ar kopīgajiem un tipam atbilstošiem laukiem. Var pievienot savu atribūta nosaukumu un vērtību. **Analizēt lokāli** piedāvā vērtības atsevišķā kolonnā ar OCR avota fragmentu un dokumenta lapas numuru. **Izmantot** pārnes vienu ieteikumu rediģējamajā laukā; atkārtota analīze nepārraksta lietotāja datus.
5. **Apstiprināt informāciju** saglabā atsevišķu pārbaudīto vērtību momentuzņēmumu. Pēc lapu, attēlu vai OCR izmaiņām redzams aktualitātes brīdinājums; manuālās vērtības saglabājas. Laukus var labot un apstiprināt atkārtoti.
6. **Saglabāt melnrakstu** atomāri ieraksta grupējumu, kartītes, analīzi un apstiprinājumus. Pēc pārlādes tie atjaunojas. Grupējuma izmaiņām, tāpat kā iepriekšējai lapu pārvaldībai, nav automātiskas saglabāšanas; OCR darbības turpina saglabāt visu sesiju pēc lapas apstrādes.

Lokālā analīze izmanto ierobežotu LV/EN/RU apzīmējumu kopu. Dokumenta tipam vajadzīgs virsraksts un papildu satura pierādījums; nosūtītāju/saņēmēju nosaka tikai pēc skaidras lomas. Kopējo summu, PVN, summu bez PVN, summu ar PVN, samaksāto un atlikumu glabā atsevišķi. Pretrunas vai neskaidrs formāts dod `null`, nenoteikts tips ir `unknown`. Nav uzņēmumu veidņu, koordinātu noteikumu, ārēja MI, valodas noteikšanas vai summu aritmētiskas pārbaudes. Rēķinu robežu ieteikumi balstās uz skaidru virsrakstu lapas sākumā un dokumenta numura maiņu; sadalīšana vienmēr prasa apstiprinājumu.

IndexedDB datubāzes versija **1** un trīs krātuves saglabājas. `drafts` ierakstam pievienoti `schemaVersion: 2` un `documents`; dokumentā glabā sakārtotus lapu ID, tipu/nosaukumu/atribūtus, ieteikumus un atsevišķu apstiprinājumu. Attēli netiek dublēti. Vecie melnraksti atveras ar visām lapām nepiesaistītā stāvoklī, nezaudējot OCR. `documentExportPlan` sagatavo informācijas lapas datus un attēlu ID dokumenta secībā nākamā posma PDF adapterim. PDF ģenerēšana vēl nav ieviesta.

[5. posma datu modelis, analīzes ierobežojumi un faktiskās pārbaudes](docs/testing/document-grouping.md).

5. posma galīgās pārbaudes: **34/34 vienību testi**, **135/135 Playwright testi** (360, 412 un 1440 px), sekmīgs `build` un `format:check`. Ietverta visa iepriekšējā skenēšanas, redaktora un īstā lokālā OCR regresija.

### Pārbaudes un nākamais posms

```powershell
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:e2e
npm.cmd run format:check
# Pēc android:sync — atsevišķa native konfigurācijas pārbaude:
npm.cmd run android:check
```

Testiem nepieciešams datorā instalēts Google Chrome. Playwright pats startē produkcijas priekšskatījumu portā 4173; tam jābūt brīvam. Vispirms jāizpilda tīmekļa `build`, jo `android:sync` tajā pašā `dist/` mapē sagatavo native versiju bez PWA. Rezultāti un ekrānattēli ir lokālajās `frontend/test-results/` un `frontend/playwright-report/` mapēs. [3. posma testu pārskats](docs/testing/image-processing.md), [2. posma pārskats](docs/testing/scanning-sessions.md) un [1. posma pārskats](docs/testing/mobile-foundation.md). Testi izmanto tikai atmiņā ģenerētus sintētiskus attēlus un izolētus pārlūka profilus.

4. posmā sekmīgi izpildīti **18/18 vienību testi**, **117/117 Playwright testi**, produkcijas būvējums un formatējuma pārbaude. Pēc pēdējā kļūdas paziņojuma labojuma atsevišķi izturēti vēl **3/3** regresijas testi. Ar īsto OCR pārbaudītas visas trīs valodas, perspektīvas/pagrieziena/filtra rezultāts, saglabāšana, atcelšana un bezsaistes darbs pēc pārlādes. [Faktiskie OCR mērījumi un ierobežojumi](docs/testing/local-ocr.md).

Nākamajos posmos jārealizē PDF ģenerēšana, jāpaplašina dokumentu robežu un atribūtu noteikšana un reālu, izmantošanai atļautu fotogrāfiju OCR kvalitātes novērtēšana. Atsevišķi jāpielāgo un jāpārbauda native Camera/Filesystem integrācija, OCR fiziskās mazatmiņas ierīcēs, meklēšana/filtri un pēc infrastruktūras saskaņošanas — korporatīvā MI adapteris un servera/MongoDB integrācija. Šajā posmā nav Laravel, MongoDB, ārēju MI pieprasījumu, dokumentu augšupielāžu vai maksas pakalpojumu.

[Mobilās lietotnes arhitektūra un paplašināšanas robežas](docs/diagrams/mobile-architecture.md). Iepriekšējā dokumentācija un `tools/ocr-evaluation/` saglabāta; OCR CLI netiek automātiski palaists pārlūkā vai Android lietotnē.

## Licence

Projektam ir spēkā [MIT licence](LICENSE). Autortiesību norāde: Copyright (c) 2026 Eduards Levša.
