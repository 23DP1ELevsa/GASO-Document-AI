# GASO Document AI

## Projekta apraksts

GASO Document AI ir topošā Android mobilā lietotne un progresīvā tīmekļa lietotne (PWA) drukātu dokumentu fotografēšanai, digitalizēšanai, automātiskai klasificēšanai, datu iegūšanai un arhivēšanai. Abas platformas izmanto kopīgu Vue koda bāzi. Ar telefona kameru lietotājs vienā sesijā varēs secīgi fotografēt dažādu dokumentu lapas, piemēram, rēķinus, līgumus un iesniegumus.

Projekta uzdevumi tiek pārvaldīti [GASO Document AI Trello dēlī](https://trello.com/b/J6ecDlQE/gaso-document-ai-projekta-izstrade).

## Projekta mērķis

Samazināt manuālu dokumentu reģistrēšanu un datu pārrakstīšanu, atvieglojot drukātu dokumentu digitalizāciju. Lietotājam būs iespēja pārbaudīt un labot gan dokumentu grupējumu, gan iegūtos datus pirms reģistrēšanas un arhivēšanas.

## Galvenās funkcijas

Turpmāk aprakstīta plānotā pilnā dokumentu apstrāde. Pašlaik `frontend/` ir realizēts 1. un 2. posms: četri navigācijas ekrāni, gaišais/tumšais režīms, PWA pamats, Capacitor Android projekts un funkcionējošas pārlūka skenēšanas sesijas. Var pievienot attēlus, pārvaldīt lapas un saglabāt melnrakstus IndexedDB. Fotografēšana izmanto pārlūka failu/kameras izvēli; tieša Capacitor Camera integrācija nav ieviesta. OCR, PDF un reģistrēšana vēl nav realizēta. Atsevišķi saglabātais OCR komandrindas prototips nav pieslēgts mobilajai lietotnei.

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
| Lietotāja saskarne | Vue 3, Composition API, JavaScript, Vuetify 3, Vue Router 4, Vite |
| Servera puse | PHP, Laravel 12 |
| Datubāze | MongoDB |
| Mākslīgais intelekts | GASO saskaņotais korporatīvais MI API; detaļas tiks precizētas |
| Attēlu apstrāde | PHP bibliotēkas; nepieciešamības gadījumā OpenCV |
| PDF ģenerēšana | Piemērota PDF izveides bibliotēka; izvēle vēl jāveic |
| Mobilā lietotne | Capacitor 8 Android un PWA ar kopīgu Vue koda bāzi |
| Autorizācija | Laravel Sanctum |
| Izvietošana | Railway, ja izvietojums tiks saskaņots |
| Versiju kontrole | Git un GitHub |

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
│       └── scanning-sessions.md
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

| Rīks | Prasība |
| --- | --- |
| Node.js | Vismaz 22.12; ieteicama Node.js 24 LTS. Izstrādē pārbaudīta 24.15.0 |
| npm | Kopā ar Node.js; atkarību reproducēšanai izmantot `npm ci` un saglabāto `package-lock.json` |
| Pārlūks | Aktuāls Chrome, Edge vai cits mūsdienīgs pārlūks; automatizētie testi izmanto instalētu Chrome |
| Android Studio | Otter 2025.2.1 vai jaunāks, nepieciešams tikai Android palaišanai |
| Android SDK | Platform 36, Build Tools 36.0.0, Platform Tools; emulators pēc vajadzības |
| Java Android būvēšanai | JDK 21; Android Studio iestatījumos izvēlēties saderīgu Gradle JDK. Šajā vidē atrastā Java 27 nav validēta ar projekta Gradle |
| Android ierīce | Android 7.0 / API 24 vai jaunāka; ieteicams testēt arī API 35/36 un aktuālu Android System WebView |

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
- Android atpakaļpogas apstrāde: iepriekšējais lietotnes maršruts; tieši atvērtā sadaļā — sākums; sākumā — lietotnes aizvēršana. Drošās zonas un sistēmas joslu stils pielāgoti Capacitor.
- Lietotnes versija, lokālā režīma un plānotā MI skaidrojums, GitHub saite.
- Atsevišķa latviešu tulkojumu vārdnīca; angļu un krievu valoda vēl nav tulkota.

### PWA

[`vite-plugin-pwa` konfigurācija](https://vite-pwa-org.netlify.app/guide/) ģenerē manifestu, service worker un interfeisa bezsaistes kešu tikai tīmekļa produkcijas būvējumam. Kešā ir būvējumā iekļautie JS/CSS, sākuma HTML, manifests un ikonas, arī vēl neatvērto ekrānu koda faili. Nav dokumentu, attēlu augšupielāžu vai API atbilžu runtime kešošanas. Lietotne neielādē ārējus fontus un neizmanto analītiku.

Pēc sākotnējās tiešsaistes ielādes un service worker aktivizācijas interfeiss ir atverams bez interneta. Chrome/Edge piedāvā instalēšanu no pārlūka izvēlnes; ja pārlūks dod instalēšanas notikumu, poga parādās arī iestatījumos. Šis piedāvājums atkarīgs no pārlūka un ierīces. Atjauninājumiem ir apstiprināma poga, nevis automātiska lapas pārlāde darba laikā. Izstrādes režīmā service worker nav ieslēgts. Android native būvējumā tas ir izslēgts, jo interfeiss jau tiek piegādāts APK.

PWA interfeisa kešs nav dokumentu krātuve. 2. posma melnraksti un attēlu Blob tiek glabāti atsevišķā IndexedDB datubāzē; tie netiek ievietoti service worker kešā. Privātuma, glabāšanas termiņu un piekļuves kontroles prasības reāliem uzņēmuma dokumentiem joprojām jāprecizē pirms produkcijas lietošanas.

### 2. posms: attēli un skenēšanas sesijas pārlūkā

Atveriet projekta mapi VS Code un **Terminal → New Terminal**. Ja atkarības jau instalētas, pietiek ar:

```powershell
cd frontend
npm.cmd run dev
```

Atveriet `http://localhost:5173` un sadaļu **Skenēt**. Android Studio šīm darbībām nav vajadzīga.

1. **Fotografēt** izmanto `input type="file"`, `accept="image/*"` un `capture="environment"`. Mobilais pārlūks var piedāvāt aizmugurējo kameru; konkrēto izvēli nosaka pārlūks un ierīce. Datorā vai bez kameras atbalsta var izvēlēties failu. Ja tālrunis izveido HEIC attēlu, to vispirms jāeksportē JPEG/PNG formātā.
2. **Pievienot no galerijas** ļauj izvēlēties vienu vai vairākus JPEG, PNG vai WebP attēlus. Atkārtota pievienošana saglabā iepriekšējās lapas. Atcelta failu izvēle nemaina sesiju; to pašu failu drīkst pievienot atkārtoti.
3. Zem katra numurēta priekšskatījuma ir pārvietošanas pogas. Nospiežot attēlu, atveras lielais oriģināla priekšskatījums. Trīs punktu izvēlnē var aizstāt attēlu vai dzēst lapu. Aizstāšana saglabā lapas pozīciju.
4. **Saglabāt melnrakstu** ieraksta visu sesiju lokālajā krātuvē. Veiksmes paziņojums parādās tikai pēc IndexedDB transakcijas pabeigšanas. Lapu secība, aizstāšana un dzēšana jāsaglabā ar šo pogu. Līdz tam saglabātā versija paliek neskarta.
5. **Dokumenti** rāda melnrakstu pirmās lapas priekšskatījumu, izveidošanas/rediģēšanas laiku un lapu skaitu. **Turpināt** atver sesiju. Dzēšana prasa apstiprinājumu un izdzēš arī sesijas attēlus.
6. **Jauna sesija** sāk tukšu sesiju; ja ir nesaglabātas izmaiņas, tās pirms atmešanas jāapstiprina. Esošais saglabātais melnraksts netiek dzēsts. Atvērta sesija saglabājas atmiņā, pārejot starp lietotnes sadaļām.

Ja sesija saglabāta, tās adrese satur melnraksta ID; pēc pārlādes melnraksts atjaunojas. Pēdējā saglabātā melnraksta ID tiek glabāts arī cilnes `sessionStorage`, lai to atvērtu, atgriežoties skenēšanas sadaļā pēc pārlādes. **Nesaglabātas izmaiņas pēc pārlādes zūd**; pārlūks, ja atbalsta, brīdina par aiziešanu no lapas. Automātiska saglabāšana nav ieslēgta. No jauna tukšu sesiju nevar saglabāt; jau saglabātā melnrakstā drīkst izdzēst visas lapas un saglabāt tukšo sesiju turpmākai papildināšanai.

#### Failu un sesijas ierobežojumi

| Ierobežojums | Vērtība |
| --- | --- |
| Formāti | JPEG, PNG, WebP, kuru saturs un deklarētais MIME tips atbilst un kurus pārlūks spēj dekodēt |
| Faila izmērs | 1 baits līdz 25 MiB katram attēlam |
| Izšķirtspēja | Līdz 40 megapikseļiem un 16 000 px jebkurā malā |
| Sesijas apjoms | Līdz 20 lapām un 200 MiB oriģinālu kopā |
| Mazais priekšskatījums | Līdz 480 px garākajā malā, JPEG; oriģināla kvalitāti tas nemaina |
| Neatbalstīts | PDF, HEIC/HEIF, SVG, GIF, bojāti un pārlūkā neatverami attēli |

Faila saturs un attēla galvenes izmēri tiek pārbaudīti pirms rastra dekodēšanas. Attēli tiek apstrādāti secīgi; vienlaikus netiek dekodēti visi oriģināli. Saglabājas sākotnējie attēla baiti bez pārkodēšanas, samazināšanas vai EXIF metadatu noņemšanas. Priekšskatījumu orientācijai izmanto pārlūka EXIF atbalstu; liels priekšskatījums ielādē tikai izvēlēto oriģinālu. Animētu attēlu plūsma nav paredzēta skenēšanas funkcija.

#### Lokālās krātuves darbība un robežas

`frontend/src/features/scanning/draftRepository.js` veido atsevišķu glabāšanas moduli. IndexedDB datubāzē `gaso-document-ai` ir trīs krātuves:

- `drafts` — ID, izveidošanas/rediģēšanas laiks, statuss `draft`, revīzija, sakārtots lapu ID saraksts un mazs vāka priekšskatījums;
- `pages` — lapu ID, attēla nosaukums, tips, izmēri un priekšskatījuma Blob/metadati;
- `images` — oriģinālu Blob pēc lapas ID.

Saglabāšana un dzēšana ir atomāras transakcijas visās trīs krātuvēs. Dzēstas vai aizstātas lapas pēc saglabāšanas vairs neatstāj neizmantotus attēlus. Ja trūkst vietas vai IndexedDB nav pieejama, lietotne parāda kļūdu, saglabā pašreizējās izmaiņas atmiņā un ļauj mēģināt vēlreiz. Vecāka citā cilnē atvērta versija nevar klusām pārrakstīt jaunāku saglabājumu. Pārskatīšanai izveidotie Object URL tiek atbrīvoti pēc attēla maiņas vai komponentes aizvēršanas.

Melnraksti ir pieejami **tikai tajā pašā pārlūka profilā un origin**: `localhost:5173`, `127.0.0.1:5173` un `localhost:4173` ir atšķirīgas krātuves. Tie nav sinhronizēti vai automātiski dublēti. Pārlūka datu dzēšana, privātā režīma aizvēršana vai pārlūka veikta krātuves atbrīvošana var izdzēst melnrakstus. Krātuve nav atsevišķi šifrēta vai aizsargāta ar lietotnes autentifikāciju. Attēlu saturs un failu nosaukumi netiek sūtīti uz serveri vai rakstīti konsolē. Neizmantojiet šo prototipu kā vienīgo svarīgu dokumentu kopiju.

Failu izvēle, attēlu sagatavošana, sesijas stāvoklis un glabāšana ir nodalīti. Vēlāk Capacitor Camera/Filesystem adapteri varēs pievienot, saglabājot lapu datu struktūru un lietotāja saskarni. Šajā posmā Android atļaujas, spraudņi un projekta struktūra nav mainīti; native kamera un APK nav pārbaudīti.

Pamatā izmantotas pārlūka API: [IndexedDB transakcijas](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [attēlu dekodēšana un orientācija](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [kameras capture atribūts](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture) un [Object URL atbrīvošana](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static).

### Pārbaudes un nākamais posms

```powershell
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run format:check
# Pēc android:sync — atsevišķa native konfigurācijas pārbaude:
npm.cmd run android:check
```

Testiem nepieciešams datorā instalēts Google Chrome. Playwright pats startē produkcijas priekšskatījumu portā 4173; tam jābūt brīvam. Vispirms jāizpilda tīmekļa `build`, jo `android:sync` tajā pašā `dist/` mapē sagatavo native versiju bez PWA. Rezultāti un ekrānattēli ir lokālajās `frontend/test-results/` un `frontend/playwright-report/` mapēs. [2. posma testu pārskats](docs/testing/scanning-sessions.md); [1. posma vēsturiskais pārskats](docs/testing/mobile-foundation.md). Testi izmanto tikai atmiņā ģenerētus sintētiskus attēlus un izolētus pārlūka profilus.

Nākamajos posmos jārealizē attēlu apgriešana, dokumenta robežu noteikšana un perspektīvas korekcija, pēc tam lokāls OCR, dokumentu grupēšana un PDF ģenerēšana. Atsevišķi jāpielāgo un jāpārbauda native Camera/Filesystem integrācija, meklēšana/filtri un pēc infrastruktūras saskaņošanas — korporatīvā MI adapteris un servera/MongoDB integrācija. Šajā posmā nav Laravel, MongoDB, ārēju MI pieprasījumu, dokumentu augšupielāžu vai maksas pakalpojumu.

[Mobilās lietotnes arhitektūra un paplašināšanas robežas](docs/diagrams/mobile-architecture.md). Iepriekšējā dokumentācija un `tools/ocr-evaluation/` saglabāta; OCR CLI netiek automātiski palaists pārlūkā vai Android lietotnē.

## Licence

Projektam ir spēkā [MIT licence](LICENSE). Autortiesību norāde: Copyright (c) 2026 Eduards Levša.
