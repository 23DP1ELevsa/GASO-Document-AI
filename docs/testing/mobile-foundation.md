# Mobilās lietotnes 1. posma pārbaudes

Datums: 2026-11-10. Pārbaudīta lokālā `frontend/` realizācija Windows vidē. Git komandas nav izpildītas. Esošā dokumentācija, backend sagatave un OCR izpētes rīki nav pārveidoti.

## Izpildvide un versijas

Node.js 24.15.0, npm 11.12.1. Instalētās tiešās atkarības ir saderīgas (`npm ls --depth=0` bez atkarību konflikta):

| Komponente | Versija |
| --- | --- |
| Vue / Vue Router | 3.5.45 / 4.6.4 |
| Vuetify | 3.13.7 |
| Vite / Vue spraudnis | 8.3.7 / 6.0.10 |
| Capacitor core, CLI, Android | 8.6.0 |
| Capacitor App / Splash Screen | 8.1.2 / 8.0.2 |
| Lucide Vue | `@lucide/vue` 1.71.0 |
| Vite PWA | 2.0.0 |
| Playwright / axe-core Playwright | 1.65.0 / 4.14.0 |

Izmantots datorā instalētais Google Chrome (`channel: chrome`), nevis Android WebView. Precīzās tranzitīvās atkarības fiksē `frontend/package-lock.json`.

## Faktiski izpildītās pārbaudes

| Pārbaude | Rezultāts |
| --- | --- |
| `npm.cmd install` | Atkarības instalētas; sagatavots lock fails |
| `npm.cmd run dev` | Vite startējās portā 5173; Chrome 360 px platumā atvēra sākumu un pārgāja uz skenēšanu bez JavaScript kļūdām |
| `npm.cmd run build` | Sekmīgs tīmekļa produkcijas būvējums, manifests un service worker; interfeisa precache ap 653 KiB |
| `npm.cmd run test:e2e` | **27 no 27 testiem sekmīgi**, gala pilnais izpildījums 47,8 sekundēs |
| `npm.cmd run assets` | Ģenerētas PWA/Android ikonas un splash resursi; avots `public/icon.svg` |
| `cap add android` | Android projekts reāli ģenerēts ar Capacitor CLI |
| `npm.cmd run android:sync` | Native būvējums sekmīgs; faili un divi spraudņi sinhronizēti Android projektā |
| `npm.cmd run android:check` | App ID/nosaukums, webDir, konfigurācijas kopija, SDK mērķis, Gradle wrapper, MainActivity, adaptīvās ikonas, spraudņi un native interfeisa faili pārbaudīti; native kopijā nav `sw.js` |
| Android resursu XML parsēšana | Resursu XML faili nolasīti ar PowerShell XML parseri; tā nav AAPT resursu kompilācija |
| `npm.cmd run format:check` | Visi jaunās frontend lietotnes pārbaudāmie avota faili atbilst Prettier konfigurācijai |

Android `drawable-v24` ikonas resurss ģenerēts identisks pamatresursam, lai Android neizvēlētos Capacitor šablona ikonu. No ģenerētā projekta izņemti sākotnējie paraugtesti, tostarp instruments ar neatbilstošu šablona pakotnes identifikatoru; Android testi šajā posmā nav izpildīti.

## Pārlūka scenāriji

Katrs no deviņiem scenārijiem izpildīts trīs projektos: **360 × 800**, **412 × 915**, **1440 × 1000**. Mobilie projekti izmanto arī pieskārienu un mobilo viewport režīmu.

1. Visi četri ekrāni atveras; nav horizontālas pārplūdes, JavaScript izņēmumu vai pieprasījumu ārējiem domēniem. Redzamajā navigācijā ir četras saites ar vismaz 44 × 44 px pieskāriena laukumu.
2. Galvenā skenēšanas poga un dokumentu navigācija maina Vue maršrutu; pārlūka atpakaļpoga atgriežas iepriekšējā ekrānā. Pārbaudes marķieris lapā saglabājas, apliecinot navigāciju bez pilnas pārlādes.
3. Tumšā režīma izvēle saglabājas pēc pārlādes un ir spēkā visos ekrānos; pārslēgšanās uz gaišo režīmu arī saglabājas.
4. Kameras un galerijas pogas ir atspējotas, redzams “Drīzumā pieejams”; nav kameras video vai faila ievades; arhīvs ir tukšs ar dokumentu skaitu 0.
5. Pēc pirmās ielādes un service worker aktivizācijas sākums pārlādējas bez interneta; bezsaistē atveras arī sākumā neapmeklētie maršruti. Manifests un PNG ikonas pieejamas, ir maskable ikona. Keša URL satur tikai piegādātos interfeisa resursus.
6. Ar bloķētu `localStorage` saskarne startējas, režīmu var pārslēgt un parādās saprotams paziņojums par saglabāšanas ierobežojumu.
7. Nezināms maršruts atgriežas sākumā; GitHub saitei ir pareizā adrese un `noopener noreferrer`.
8. Visi ekrāni abos režīmos iziet axe automatizētās WCAG 2 A/AA un 2.1 AA pārbaudes bez atrastiem pārkāpumiem. Pārbaude sagaida navigācijas animācijas beigas.
9. Tastatūras saite “Pāriet uz saturu” pārnes fokusu uz galveno saturu, nemainot maršrutu. Mobilajos projektos injicētās augšējās/apakšējās drošās zonas tiek ņemtas vērā izkārtojumā.

Automatizētās piekļūstamības pārbaudes neaizstāj manuālu ekrānlasītāja, palielināta teksta un reālas ierīces pārbaudi. Pārlūka drošo zonu simulācija neaizstāj fiziska Android ekrāna izgriezumu un sistēmas žestu pārbaudi.

Testi saglabā katra ekrāna gaišā/tumšā režīma pilna augstuma ekrānattēlus `frontend/test-results/`. Papildus vizuāli apskatīti gaišā un tumšā režīma mobilo un darbvirsmas ekrānu attēli. HTML pārskats ir `frontend/playwright-report/index.html`; kļūmēm konfigurēta Playwright trace saglabāšana. Šie lokāli ģenerētie faili netiek paredzēti publicēšanai repozitorijā.

## Android statuss un vēl neizpildītās pārbaudes

Sākotnējā pārbaudē Android rīki nebija atrasti. Atkārtotā pārbaudē darba beigās atrasts Android Studio **2026.2.2** un SDK mape `%LOCALAPPDATA%\Android\Sdk`, kurā ir emulatora/sistēmas attēlu instalācijas materiāli un **`build-tools/36.0.0`**, bet vēl nav **`platforms/android-36`**. Android rīku instalācijas saturs darba gaitā mainījās; šis ir pēdējā pārbaudē konstatētais stāvoklis. Komandrindas Java ir **27**, Studio JBR — **25**; projekta Gradle/Capacitor konfigurācijai dokumentēts **JDK 21**.

**APK nav būvēts.** `assembleDebug` un Android Studio Run nav izpildīti. Nav pārbaudīta instalācija tālrunī/emulatorā, native splash, sistēmas joslas, Android atpakaļpoga vai fiziskas ierīces drošās zonas. Capacitor ģenerēšana, native web būvējums un sinhronizācija nenozīmē, ka APK ir kompilēts vai palaists.

Lai turpinātu, SDK Manager jāuzstāda Platform 36, Build Tools 36.0.0 un Platform Tools un Gradle jānorāda JDK 21. Pēc tam no `frontend/` izpilda `npm.cmd run android:sync`, `npm.cmd run android:open` un palaidiet `app` izvēlētajā ierīcē. Komandrindas debug būvējums: `npm.cmd run android:build`.

PWA faktiskā instalēšana no pārlūka izvēlnes un jaunas publicētas versijas atjauninājuma plūsma nav manuāli izmēģināta. Pārbaudīts manifests, ikonas, service worker reģistrācija un bezsaistes darbība; instalēšanas piedāvājums ir atkarīgs no pārlūka un ierīces.

Kamera, attēlu apstrāde, OCR, PDF, dokumentu krātuve, MI un servera integrācija nav realizēti un nav testēti kā strādājošas funkcijas. Iepriekšējie Python OCR rezultāti nav šīs mobilās lietotnes testu rezultāti.
