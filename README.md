# GASO Document AI

## Projekta apraksts

GASO Document AI ir topošā Android mobilā lietotne un progresīvā tīmekļa lietotne (PWA) drukātu dokumentu fotografēšanai, digitalizēšanai, automātiskai klasificēšanai, datu iegūšanai un arhivēšanai. Abas platformas izmanto kopīgu Vue koda bāzi. Ar telefona kameru lietotājs vienā sesijā varēs secīgi fotografēt dažādu dokumentu lapas, piemēram, rēķinus, līgumus un iesniegumus.

Projekta uzdevumi tiek pārvaldīti [GASO Document AI Trello dēlī](https://trello.com/b/J6ecDlQE/gaso-document-ai-projekta-izstrade).

## Projekta mērķis

Samazināt manuālu dokumentu reģistrēšanu un datu pārrakstīšanu, atvieglojot drukātu dokumentu digitalizāciju. Lietotājam būs iespēja pārbaudīt un labot gan dokumentu grupējumu, gan iegūtos datus pirms reģistrēšanas un arhivēšanas.

## Galvenās funkcijas

Turpmāk aprakstīta plānotā dokumentu apstrāde. Pašlaik `frontend/` ir realizēts mobilās lietotnes 1. posms: četri navigācijas ekrāni, gaišais/tumšais režīms, PWA pamats un Capacitor Android projekts. Kameras, OCR, PDF un arhivēšanas biznesa funkcijas vēl nav realizētas. Atsevišķi saglabāts lokāls OCR komandrindas prototips un tehniskās sagatavošanas dokumentācija; tas nav pieslēgts mobilajai lietotnei.

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
│       └── mobile-foundation.md
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
- Īsti tukšie dokumentu/lapu stāvokļi; kameras un galerijas darbības ir atspējotas un atzīmētas ar “Drīzumā pieejams”.
- Android atpakaļpogas apstrāde: iepriekšējais lietotnes maršruts; tieši atvērtā sadaļā — sākums; sākumā — lietotnes aizvēršana. Drošās zonas un sistēmas joslu stils pielāgoti Capacitor.
- Lietotnes versija, lokālā režīma un plānotā MI skaidrojums, GitHub saite.
- Atsevišķa latviešu tulkojumu vārdnīca; angļu un krievu valoda vēl nav tulkota.

### PWA

[`vite-plugin-pwa` konfigurācija](https://vite-pwa-org.netlify.app/guide/) ģenerē manifestu, service worker un interfeisa bezsaistes kešu tikai tīmekļa produkcijas būvējumam. Kešā ir būvējumā iekļautie JS/CSS, sākuma HTML, manifests un ikonas, arī vēl neatvērto ekrānu koda faili. Nav dokumentu, attēlu augšupielāžu vai API atbilžu runtime kešošanas. Lietotne neielādē ārējus fontus un neizmanto analītiku.

Pēc sākotnējās tiešsaistes ielādes un service worker aktivizācijas interfeiss ir atverams bez interneta. Chrome/Edge piedāvā instalēšanu no pārlūka izvēlnes; ja pārlūks dod instalēšanas notikumu, poga parādās arī iestatījumos. Šis piedāvājums atkarīgs no pārlūka un ierīces. Atjauninājumiem ir apstiprināma poga, nevis automātiska lapas pārlāde darba laikā. Izstrādes režīmā service worker nav ieslēgts. Android native būvējumā tas ir izslēgts, jo interfeiss jau tiek piegādāts APK.

PWA interfeisa kešs nav dokumentu krātuve. Pievienojot dokumentu saglabāšanu, jāparedz atsevišķa privāta krātuve, datu dzēšana, glabāšanas termiņi un piekļuves kontrole.

### Pārbaudes un nākamais posms

```powershell
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run format:check
# Pēc android:sync — atsevišķa native konfigurācijas pārbaude:
npm.cmd run android:check
```

Testiem nepieciešams datorā instalēts Google Chrome. Playwright pats startē produkcijas priekšskatījumu portā 4173; tam jābūt brīvam. Vispirms jāizpilda tīmekļa `build`, jo `android:sync` tajā pašā `dist/` mapē sagatavo native versiju bez PWA. Rezultāti un ekrānattēli ir lokālajās `frontend/test-results/` un `frontend/playwright-report/` mapēs. [Faktiski izpildīto pārbaužu pārskats un ierobežojumi](docs/testing/mobile-foundation.md).

Nākamajā posmā jārealizē kamera un galerija, vairāku lapu uzņemšana, priekšskatījumi, apgriešana un perspektīvas korekcija. Vēlāk atsevišķi jāpievieno lokāls OCR, lapu grupēšana, PDF ģenerēšana, lokālā dokumentu krātuve, meklēšana/filtri un pēc infrastruktūras saskaņošanas — korporatīvā MI adapteris un servera/MongoDB integrācija. Šajā posmā nav Laravel, MongoDB, ārēju MI pieprasījumu, dokumentu augšupielāžu vai maksas pakalpojumu.

[Mobilās lietotnes arhitektūra un paplašināšanas robežas](docs/diagrams/mobile-architecture.md). Iepriekšējā dokumentācija un `tools/ocr-evaluation/` saglabāta; OCR CLI netiek automātiski palaists pārlūkā vai Android lietotnē.

## Licence

Projektam ir spēkā [MIT licence](LICENSE). Autortiesību norāde: Copyright (c) 2026 Eduards Levša.
