# 2. posms — skenēšanas sesijas pārlūkā

Datums: 2026-11-10. Turpināta esošā Vue 3 / Vuetify 3 lietotne. Android Studio, emulators un fiziska Android kamera šajā posmā nav izmantoti. Git komandas nav izpildītas; OCR izpētes rīki un iepriekšējie pārskati nav mainīti.

## Realizētā darbība

- Fotografēšanas poga atver pārlūka faila/kameras izvēli ar `capture="environment"`; galerijas poga atbalsta vairāku attēlu pievienošanu. Datora alternatīva ir failu izvēle.
- Sesijā var pievienot lapas atkārtoti, mainīt secību ar pogām, apskatīt oriģinālu, aizstāt attēlu un dzēst lapu. Numerācija vienmēr atbilst pašreizējai secībai.
- Ir jaunas sesijas izveide, manuāla saglabāšana, atjaunošana pēc pārlādes un turpināšana dokumentu sadaļā. Jaunas sesijas sākšanai ar nesaglabātām izmaiņām un visas sesijas dzēšanai nepieciešams apstiprinājums.
- Dokumentu sadaļā attēloti tikai īsti lokāli melnraksti ar vāku, izveidošanas un rediģēšanas laiku, lapu skaitu un atvēršanas/dzēšanas darbībām. Arī sākums rāda faktisko melnrakstu skaitu.
- Izmaiņas atvērtā sesijā saglabājas lietotnes atmiņā, navigējot starp sadaļām. Pārlādei saglabā tikai ar “Saglabāt melnrakstu” ierakstītos datus.

## Moduļi un datu robežas

| Fails vai mape `frontend/src/` | Atbildība |
| --- | --- |
| `features/scanning/imageImport.js` | Faila satura/izmēra validācija, orientēta attēla dekodēšana, mazā priekšskatījuma izveide; oriģināls paliek nemainīts |
| `features/scanning/draftRepository.js` | IndexedDB atvēršana, saraksts, lasīšana, atomāra saglabāšana/dzēšana; revīziju pārbaude pret konkurējošu pārrakstīšanu |
| `features/scanning/useScanSession.js` | Kopīgais aktīvās sesijas stāvoklis, lapu darbības, saglabāšanas/atvēršanas operāciju secība |
| `features/scanning/useDraftList.js` | Metadatu saraksts, kļūdas, atkārtota ielāde un izvēles paziņojumi citām cilnēm |
| `composables/useBlobUrl.js` | Object URL izveide un atbrīvošana |
| `components/ScanPageCard.vue` | Numurēts mazais priekšskatījums, secības pogas un darbību izvēlne |
| `components/ImagePreviewDialog.vue` | Viena oriģināla ielāde pēc pieprasījuma, aizverams priekšskatījums |
| `components/DraftCard.vue`, `components/BlobImage.vue` | Melnraksta attēlošana un lokāla Blob attēla dzīves cikls |
| `views/ScanView.vue`, `views/DocumentsView.vue` | Skenēšanas un melnrakstu darba plūsma |
| `styles/scanning.css`, `locales/` | Esošajai dizaina sistēmai pieskaņots adaptīvs noformējums un latviski teksti |

Krātuves `drafts`, `pages` un `images` atdala saraksta metadatus/priekšskatījumus no oriģinālu Blob. Sarakstam un lapu režģim netiek nolasīti vai dekodēti visi oriģināli. Saglabājot aizstāšanu vai dzēšanu, tajā pašā transakcijā tiek izņemti nevajadzīgie lapu un oriģinālu ieraksti. Dzēšot visu melnrakstu, tiek dzēsti visi tā attēli. Ja saglabātā sesijā izdzēš visas lapas, to var saglabāt ar nulles lapu skaitu.

Pamatlimiti: 25 MiB vienam failam, 40 MP un 16 000 px vienā malā, 20 lapas / 200 MiB sesijā. Priekšskatījuma garākā mala ir līdz 480 px; oriģināls netiek pārkodēts. JPEG izmēru galveni meklē pirmajos 512 KiB; neparasts fails ar vēl lielākiem pirmsrastra metadatiem var tikt noraidīts kā neatverams.

Melnraksti nav reģistrēti dokumenti, PDF vai OCR rezultāti. Nav ārēju API, augšupielāžu, MI vai backend savienojumu. PWA konfigurācija saglabāta: attēli atrodas IndexedDB, nevis service worker kešā. Android manifestam un spraudņu konfigurācijai nekas nav pievienots.

## Pārbaužu saturs

`tests/app.spec.js` saglabā 1. posma navigācijas, tēmu, izkārtojuma, PWA, kļūdu un piekļūstamības pārbaudes; kameras neaktīvās sagataves tests aizstāts ar funkcionālo failu ievades pārbaudi.

`tests/scanning.spec.js` ģenerē sintētiskus JPEG, PNG, WebP un JPEG ar EXIF orientāciju **atmiņā**, izmantojot Sharp. Reāli dokumenti netiek izmantoti vai pievienoti repozitorijam. Playwright izmanto īstu Chrome failu izvēles notikumu un izolētu pārlūka IndexedDB; nav imitēta lietotnes repozitorija vai saglabāšanas veiksmes rezultātu.

Katrs scenārijs darbojas projektos **360 × 800**, **412 × 915** un **1440 × 1000**:

1. Kameras failu ievade, vairāku galerijas failu pievienošana un atkārtota papildināšana.
2. Oriģināla priekšskatījuma atvēršana/aizvēršana, fokusa atjaunošana uz atvēršanas pogu un Object URL atbrīvošana pēc priekšskatījuma un ekrāna aizvēršanas.
3. Secības maiņa, saglabāšana, atjaunošana pēc pārlādes, attēla aizstāšana un lapas dzēšana.
4. Saglabāto oriģinālu SHA-256 kontrolsummu sakritība ar sākotnējiem failiem; priekšskatījumu Blob un izmēru pārbaude; neizmantotu ierakstu tīrīšana.
5. JPEG EXIF orientācija 6: 300 × 200 px ievade priekšskatījumā pareizi kļūst par 200 × 300 px, oriģināla baiti paliek nemainīgi.
6. Divu melnrakstu saraksts, atvēršana/turpināšana, atcelta un apstiprināta dzēšana; pēc dzēšanas pārbaudītas visas trīs krātuves.
7. Neatbalstīts formāts, viltots JPEG, bojāts PNG, pārsniegts faila izmērs un attēla dimensijas. Atcelta galerijas/aizstāšanas izvēle nemaina esošās lapas; var pievienot to pašu failu vēlreiz.
8. Otrā oriģināla ieraksta laikā mākslīgi izraisīts `QuotaExceededError`: īstā IndexedDB transakcija atceļ arī iepriekš rindā ieliktos ierakstus. Neparādās veiksmes paziņojums; lapas paliek atmiņā un atkārtota saglabāšana darbojas.
9. Bloķēta IndexedDB: imports atmiņā turpina darboties, saglabāšana un saraksts rāda kļūdu; nav nepatiesa tukšas krātuves vai veiksmes paziņojuma.
10. Visu saglabātā melnraksta lapu izdzēšana, tukšās sesijas saglabāšana un pilnas sesijas dzēšanas apstiprinājums.
11. Divdesmit lapu režģis bez horizontālas pārplūdes, 21. lapas noraidīšana, abas tēmas un atvērta lapas izvēlne. Axe WCAG 2 A/AA un 2.1 AA automatizētās pārbaudes.
12. Jaunas sesijas atcelšana/apstiprināšana un jaukta derīgu/nederīgu failu grupa.
13. Divas cilnes ar vienu melnrakstu: vecā revīzija nevar pārrakstīt jaunāko saglabājumu.
14. Saglabāta sesija pēc pārlādes bez interneta, oriģināla priekšskatījums no IndexedDB, papildu lapas imports un saglabāšana bezsaistē. Service worker kešā pārbaudīti tikai interfeisa failu URL.

## Komandas un rezultāti

```powershell
cd frontend
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run format:check
```

Visas prasītās komandas izpildītas sekmīgi:

| Komanda | Faktiskais rezultāts |
| --- | --- |
| `npm.cmd run build` | Vite produkcijas būvējums sekmīgs; PWA interfeisa precache ap 694 KiB |
| `npm.cmd run test:e2e` | **60 no 60 testiem sekmīgi**, gala pilnais izpildījums ap 1,9 minūtēm |
| `npm.cmd run format:check` | Visi pārbaudāmie frontend faili atbilst Prettier konfigurācijai |

Pārbaudes izpildītas esošajā Node.js 24.15.0, npm 11.12.1 un instalētajā Chrome. Jaunas atkarības nav pievienotas. Starppārbaudē tēmas maiņas animācija ietekmēja axe izmērītās fona krāsas; tests tagad pirms kontrasta mērīšanas sagaida animācijas beigas. Pēdējā pilnajā izpildījumā kļūmju nav.

Testu rezultāti un sintētisko ekrānu attēli ir `frontend/test-results/`; HTML pārskats — `frontend/playwright-report/index.html`. Šie ģenerētie faili ir izslēgti ar esošo `.gitignore`.

## Nepārbaudītais un nākamais posms

- Fiziskas ierīces kamerai pārlūks var izvēlēties citu failu izvēles saskarni; automatizēta failu ievade nav reālas kameras pārbaude. Native Capacitor Camera/Filesystem integrācija nav ieviesta.
- Android būvējums un Android Studio šajā posmā nav izmantoti. Iepriekšējā Android projekta struktūra saglabāta; pirms nākamās native pārbaudes jāveic `android:sync`.
- Galvenā testu pārlūkprogramma ir Chrome. Safari, Firefox, fiziskas ierīces, ekrānlasītājs un ļoti mazas operatīvās atmiņas ierīces nav pārbaudītas.
- Kvotas kļūme izraisīta kontrolēti, nevis piepildot datora disku. Kopējā 200 MiB ierobežojuma robeža nav izmēģināta ar pilnu reālu 200 MiB attēlu kopu.
- IndexedDB nav rezerves kopija vai uzņēmuma arhīvs. Pārlūks var dzēst datus; dažādi pārlūki, profili, adreses un porti izmanto atšķirīgas krātuves.
- Nākamajos posmos nepieciešama attēlu apgriešana/perspektīva, lokāls OCR, lapu grupēšana un PDF ģenerēšana; saskaņotais MI un serveris paliek atsevišķi nākotnes darbi.
