# 4. posms — lokāla OCR integrācija

Datums: 2026-11-10. Vue 3/Vuetify pārlūka lietotnei pievienots īsts lokāls OCR. Python rīks `tools/ocr-evaluation/`, backend un Android projekts nav pārveidoti. Darbs neietver dokumentu grupēšanu, PDF, rekvizītu semantisko noteikšanu vai ārējus MI pakalpojumus.

## Dzinējs un oficiālie avoti

Izmantots **Tesseract.js 7.0.0** un **tesseract.js-core 7.0.0**. Versija pārbaudīta npm reģistrā un [oficiālajā laidienā](https://github.com/naptha/tesseract.js/releases/tag/v7.0.0). Pirms implementācijas pārbaudīta [v7 API dokumentācija](https://github.com/naptha/tesseract.js/blob/v7.0.0/docs/api.md) un [lokālās instalācijas norādes](https://github.com/naptha/tesseract.js/blob/v7.0.0/docs/local-installation.md); vecākie versiju numuri dokumentācijas piemēros nav pārkopēti.

Lietots `await createWorker(languages, OEM.LSTM_ONLY, options)`, `worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })`, `worker.recognize(blob, {}, { text: true })` un `worker.terminate()`. Inicializācija ietver valodu ielādi; novecojušie `loadLanguage()`/`initialize()` izsaukumi netiek izmantoti. Izvadē pieprasīts tikai teksts un izmantots dzinēja `confidence`; lieli bloku, TSV, hOCR un PDF rezultāti netiek ģenerēti vai glabāti. Tukšs teksts ir derīgs tukšs rezultāts, nevis izdomāts saturs.

## Moduļi

| Fails `frontend/`                                             | Atbildība                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/features/ocr/model.js`                                   | Valodu validācija, teksta ierobežojums, rezultāta shēma, aktualitāte un kļūdu kodi                                  |
| `src/features/ocr/input.js`                                   | Pilna izmēra apstrādātais Blob; vajadzības gadījumā atkārtota renderēšana no oriģināla un saglabātajiem parametriem |
| `src/features/ocr/ocr.worker.js`                              | Tesseract API un tā iekšējā OCR worker vadība; lokāli resursu ceļi                                                  |
| `src/features/ocr/ocrService.js`                              | Viena darba limits, worker atkārtota lietošana, progress, atcelšana un taimauts                                     |
| `src/features/ocr/useOcrSession.js`                           | Secīga sesijas apstrāde, kļūdu izolācija un atomāra saglabāšana pēc katras lapas                                    |
| `src/features/ocr/useOcrSettings.js`                          | Saglabājamas valodas un pārbaudāma bezsaistes resursu sagatavošana                                                  |
| `src/components/OcrResultDialog.vue`                          | Attēls, valodas, teksta labošana, oriģinālais teksts, kopēšana, atkārtots OCR un kļūdas                             |
| `src/components/OcrLanguagePicker.vue`, `OcrSettingsCard.vue` | Koplietojama valodu izvēle un bezsaistes sagatavošana iestatījumos                                                  |
| `scripts/prepare-ocr.mjs`, `scripts/ocr-assets.lock.json`     | Atkārtojama publisko failu sagatavošana, fiksētas versijas un SHA-256                                               |
| `src/styles/ocr.css`                                          | Mobilais un darbvirsmas izkārtojums esošajos gaišajā/tumšajā režīmā                                                 |

Paplašināti esošie `ScanView`, `ScanPageCard`, sesijas un melnrakstu repozitorija moduļi. Esošā fotografēšana, importēšana, perspektīva, filtri un saglabāšanas konflikti izmantoti atkārtoti.

## Izpilde un resursu dzīves cikls

Katram atvērtam skenēšanas skatam ir viens OCR serviss. Secīgām lapām ar vienu valodu komplektu tas atkārtoti izmanto to pašu Tesseract instanci. Mainot valodu komplektu, vecais worker tiek atbrīvots, lai atmiņā nekrātos iepriekš ielādētās valodas. Nekad netiek vienlaikus palaists worker katrai sesijas lapai. Ierīces galvenajā UI pavedienā OCR aprēķini nenotiek.

Tesseract `createWorker()` neizsniedz inicializācijas laikā apturamu instanci. Tāpēc tas tiek izsaukts atsevišķā uzraugošā Web Worker, kurš ir Tesseract iekšējā worker īpašnieks. Atcelšana vai trīs minūšu taimauts aptur uzraugošo worker un tā bērnu; UI solījums tiek noraidīts neatkarīgi no Tesseract nepabeigtā iekšējā solījuma. Novēloti rezultāti tiek ignorēti pēc darba ID. Kļūmē izsaukts arī dzinēja `terminate()`. Pēc 60 sekundēm bez darba resursi tiek atbrīvoti; skata aizvēršana tos atbrīvo uzreiz. Bezsaistes sagatavošana un priekšskatījumu renderēšana ir atceļama.

Katras lapas rezultāts tiek atomāri saglabāts kopā ar pašreizējo sesiju un attēliem. Vienas lapas kļūda neizdzēš jau iegūtos tekstus; apstrāde turpinās ar nākamo lapu. Glabāšanas kļūda aptur rindu un saglabā izmaiņas atmiņā atkārtotai saglabāšanai. Atcelšana neizdzēš iepriekšējo tekstu. Ja atkārtots OCR neizdodas, iepriekšējais veiksmīgais rezultāts un labojumi paliek, bet `ocrAttempt` glabā neveiksmīgā mēģinājuma statusu.

## Modeļi, integritāte un licences

Valodas: latviešu `lav` (noklusējums), angļu `eng`, krievu `rus`; atbalstīti arī to komplekti. Valodu izvēle glabājas `localStorage` atslēgā `gaso-document-ai:ocr-languages`. Bojāti iestatījumi atgriežas pie latviešu valodas. Ja glabāšana bloķēta, pēc izvēles maiņas UI paskaidro, ka izvēle darbosies tikai pašreizējā ielādē.

Modeļi ņemti no oficiālā `tesseract-ocr/tessdata_fast` **4.1.0** laidiena, fiksējot tā commit **`65727574dfcd264acbb0c3e07860e4e9e9b22185`**. Tā ir LSTM ātrā modeļu saime, izvēlēta resursu patēriņa dēļ; tā nav apgalvota kā precīzākā saime visiem dokumentiem.

| Fails             |     Baiti | SHA-256                                                            |
| ----------------- | --------: | ------------------------------------------------------------------ |
| `lav.traineddata` | 2 717 247 | `7d9eaf22254b381f18b806cd6cb647862a397a7221adbce3e22cc421793a8847` |
| `eng.traineddata` | 4 113 088 | `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2` |
| `rus.traineddata` | 3 861 738 | `e16e5e036cce1d9ec2b00063cf8b54472625b9e14d893a169e2b0dedeb4df225` |

`npm.cmd run ocr:prepare` sagatavo `public/ocr/v7-fast-4-1-0/`; tas automātiski darbojas arī pirms `dev`/`build` un `android:sync`. npm pakotņu fiksētās versijas un lejupielāžu integritāti nosaka `package-lock.json`; skripts papildus pārbauda instalēto pakotņu versijas. Katram modeļa failam un modeļu licencei kontrolsumma salīdzināta ar saglabāto lock failu. Neatbilstība pārtrauc sagatavošanu. Atkārtoti izmanto derīgus lokālos failus; lejupielāde vajadzīga tikai trūkstošiem/bojātiem modeļiem. Ierobežotai izstrādes videi atbalstīta arī lokāla modeļu kopija `.cache/ocr-bootstrap/`, kurai jāiztur tieši tās pašas pārbaudes.

Piegādātie faili:

```text
ocr/v7-fast-4-1-0/
├── worker.min.js
├── worker.min.js.LICENSE.txt
├── core/
│   ├── tesseract-core.wasm.js
│   ├── tesseract-core-simd.wasm.js
│   ├── tesseract-core-relaxedsimd.wasm.js
│   ├── tesseract-core-lstm.wasm.js
│   ├── tesseract-core-simd-lstm.wasm.js
│   └── tesseract-core-relaxedsimd-lstm.wasm.js
├── lang/{lav,eng,rus}.traineddata
├── licenses/{tesseract.js,tesseract.js-core,tessdata_fast,tesseract-api-notices}.txt
└── manifest.json
```

v7 `.wasm.js` kodolos WebAssembly ir iegults; atsevišķi `.wasm` faili šai ielādes metodei nav vajadzīgi. Piegādāti visi seši bibliotēkas kodola varianti, lai `corePath` norādītu uz pilnu direktoriju. LSTM režīms izpildē izvēlas vienu no trim LSTM variantiem pēc ierīces SIMD/relaxed-SIMD spējām. Visi publiskie OCR faili aizņem ap **34,9 MiB**; pārlūks tos visus automātiski nelejupielādē. Bezsaistes sagatavošana lejupielādē worker, trīs LSTM variantus un tikai izvēlētos modeļus: ap **14–22 MiB**. Native būvējumā visi faili tiek kopēti `dist/`; APK nav būvēts vai testēts.

Tesseract.js, tesseract.js-core un izvēlētie modeļi izplatīti ar **Apache-2.0** licenci. To licences teksti tiek kopēti pie izpildes resursiem kopā ar upstream publicētajām API un worker iekļauto atkarību autortiesību/licenču norādēm (arī MIT un BSD-3-Clause). Projekta paša MIT licence nemaina šo komponentu licences. Oficiālais modeļu [licences avots](https://github.com/tesseract-ocr/tessdata_fast/blob/65727574dfcd264acbb0c3e07860e4e9e9b22185/LICENSE) ir fiksēts tai pašai versijai. Saglabājiet piegādātās licences un norādes, izplatot būvējumu.

## Lokāla un bezsaistes darbība

`workerPath`, `corePath` un `langPath` veido absolūtus ceļus uz pašas lietotnes origin. `workerBlobURL: false` novērš bibliotēkas papildu Blob worker apvalku; `gzip: false` atbilst oficiālajiem nekompresētajiem modeļiem. Tesseract modeļi papildus tiek kešoti `keyval-store` IndexedDB ar versijotu atslēgu prefiksu `gaso-tessdata-fast-4.1.0`. Šī krātuve ir nodalīta no melnrakstu datubāzes.

PWA interfeiss, arī uzraugošā worker kods, tiek precache glabāts kā līdz šim. Publiskajai `/ocr/v7-fast-4-1-0/` resursu direktorijai ir atsevišķs tā paša origin `CacheFirst` kešs `gaso-ocr-v7-fast-4-1-0` ar 16 ierakstu limitu. Dokumentu attēli un OCR teksti šajā kešā neietilpst. Sākotnējā interfeisa atvēršana nelejupielādē visus modeļus. Iestatījumu sagatavošanas poga secīgi ielādē vajadzīgos publiskos failus, salīdzina SHA-256 ar manifestu un glabā tos šajā kešā.

Bezsaistes priekšnoteikumi: produkcijas tīmekļa būvējums, aktivizēts service worker, iepriekš ielādēts interfeiss un pieejami izvēlēto valodu OCR resursi. `dev` režīmā service worker ir izslēgts. Trūkstošs modelis bezsaistē rada skaidru kļūdu; lietotne neizmanto CDN kā rezerves avotu. Pārlūks var atbrīvot kešu/IndexedDB, tādēļ sagatavošanas paziņojums nav beztermiņa glabāšanas garantija. Tieša `file://` atvēršana netiek atbalstīta.

## IndexedDB un rezultāta shēma

Saglabāta esošā datubāze **`gaso-document-ai`, versija 1** un tās `drafts`, `pages`, `images` krātuves. Jaunas krātuves vai indeksi nav nepieciešami: `pages` ierakstam pievienoti neobligāti `ocr` un `ocrAttempt` lauki. Migrācija ir saderīga lauku pievienošana, bez datu dzēšanas, shēmas versijas paaugstināšanas vai veco attēlu pārrakstīšanas. Vecs melnraksts bez šiem laukiem atveras ar vēl neizpildītu OCR.

```js
page.ocr = {
    schemaVersion: 1,
    pageId,
    imageVersion, // lapas ID + normalizētu apstrādes parametru identifikators
    languages: ['lav'],
    engine: 'tesseract.js',
    engineVersion: '7.0.0',
    modelVersion: 'tessdata_fast:4.1.0',
    originalText,
    editedText: null, // lietotāja labojumi; arī tukša virkne ir derīgs labojums
    editedAt: null,
    confidence, // 0..100 vai null; tas nav izmērīts kļūdu līmenis
    status: 'success', // vai 'empty'
    recognizedAt, // epoch milliseconds
    durationMs,
}
```

`ocrAttempt` neveiksmē/atcelšanā glabā `status`, `errorCode`, `languages`, `imageVersion`, `startedAt`, `durationMs`, saglabājot agrāko `ocr`. Progress dzīvo tikai atmiņā; nepabeigts OCR pēc pārlādes netiek automātiski atsākts.

Katrai no divām teksta versijām limits ir **250 000 JS rakstzīmju vienā lapā**. Vienas sesijas iepriekšējais limits ir 20 lapas; teksta lauki tādējādi ir ierobežoti līdz ap 20 MB UTF-16 pirms datubāzes papildu izmaksām. Pārsniegts rezultāts netiek klusi apgriezts vai saglabāts vecā rezultāta vietā. Limits pārbaudīts gan rezultāta izveidē, gan pirms IndexedDB ieraksta. Neierobežota atkārtotu OCR vēsture netiek uzkrāta.

`editedText ?? originalText` nosaka lietotājam un nākamajai analīzei izmantojamo tekstu. Labojumi nepārraksta `originalText`. Atkārtots OCR ar esošu rezultātu prasa apstiprinājumu pirms aizstāšanas, arī masveida režīmā. Teksta dialoga lapu pārslēgšana/aizvēršana brīdina par nesaglabātiem labojumiem. Sekmīga teksta saglabāšana ieraksta arī pārējās sesijas izmaiņas; tas ir norādīts UI.

Aktualitāti nosaka lapas ID un precīzs normalizēto apstrādes parametru identifikators: perspektīva, filtrs un pagrieziens. Ja parametri mainīti, teksts netiek izdzēsts, bet ir skaidri atzīmēts kā novecojis. Valodu komplekts glabājas rezultātā; atšķirīga pašreizējā izvēle dod atsevišķu paziņojumu. Lapu secības maiņa nepadara tekstu novecojušu. Aizstāšana rada jaunu lapas ID bez vecā OCR; saglabājot/dzēšot lapu, kopā pazūd arī vecais OCR ieraksts.

## Pārbaudes un mērījumi

Izmantoti tikai sintētiski, pārlūka canvas ģenerēti dokumenti ar zināmām transkripcijām. `tests/ocr.spec.js` izmanto īstu Tesseract.js/WASM un īstu IndexedDB; nevienā OCR pārlūka testā netiek iepriekš ievadīta izdomāta OCR atbilde. Trūkstošu modeļu/kodolu, bojāta attēla un kvotas testos apzināti izraisa kļūdu, bet pārējā ķēde paliek īsta.

`tests-unit/ocr.test.js` atsevišķi pārbauda datu shēmu, aktualitāti, ievades avotu, limitus un valodu kopas. Worker dzīves cikla vienību pārbaudēs izmantots imitēts worker; šie testi neapliecina OCR kvalitāti. Kopā ar iepriekšējiem attēlu matemātikas testiem ir **18 vienību testi**.

OCR pārlūka scenāriji: latviešu rēķins, rediģēšana un oriģināla saglabāšana, atkārtota OCR apstiprinājums, atjaunošana pēc pārlādes, LV/EN/RU un visu trīs kopēja izvēle, tabula, vājš apgaismojums, mazs teksts, secīga sesija ar bojātu un tukšu lapu, worker atkārtota lietošana, modeļa/kodola kļūda un retry, inicializācijas atcelšana, sagatavotu resursu bezsaistes pārlāde, veca melnraksta saderība, novecošana, aizstāšana/dzēšana, faktiskā perspektīvas/pagrieziena/filtra ievade, aktīvas sesijas atcelšana un kvotas kļūda. UI pārbaudīts ar Axe WCAG A/AA un pārplūdes pārbaudēm abās tēmās, 360/412 px un darbvirsmas konfigurācijās.

Kvalitātes tests aprēķina CER ar Levenšteina attālumu pēc NFC normalizācijas, mazo burtu un atstarpju normalizācijas. Katrs izpildījums Playwright pārskatam pievieno JSON ar sagaidīto tekstu, faktisko rezultātu un CER. Tas nav mērījums reālu GASO rēķinu kopai.

Pēdējā pilnajā izpildījumā visos trīs izkārtojumos iegūti vienādi rezultāti:

| Sintētiskais piemērs              |   CER |
| --------------------------------- | ----: |
| Latviešu rēķins                   | 0,00% |
| Angļu rēķins                      | 0,00% |
| Krievu teksts                     | 6,32% |
| Angļu tabula                      | 0,00% |
| Vājāk apgaismots latviešu teksts  | 0,00% |
| Mazs angļu teksts (25 px avotā)   | 0,00% |
| Iztaisnots un pagriezts dokuments | 0,00% |

Tās ir šīs mazās sintētiskās kopas vērtības, nevis universāla precizitāte. Slīpā dokumenta tests atsevišķi ģenerē projektīvu foto ar pagrieztu tekstu, iztaisno to esošajā redaktorā un izpilda OCR pēc saglabāšanas/pārlādes; tā CER ir pievienots atsevišķā JSON rezultātā.

| Komanda (`frontend/`)                                                                                          | Faktiskais rezultāts                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run build`                                                                                            | Sekmīgs produkcijas būvējums; 29 PWA precache ieraksti, ap 773 KiB interfeisam; ap 34,9 MiB atsevišķi piegādātiem OCR failiem         |
| `npm.cmd run test:unit`                                                                                        | **18/18 sekmīgi**: 10 iepriekšējie attēlu apstrādes un 8 OCR testi                                                                    |
| `npm.cmd run test:e2e`                                                                                         | **117/117 sekmīgi**, ap 7 minūtēm; 87 iepriekšējie un 30 OCR scenāriju izpildījumi 360 × 800, 412 × 915 un 1440 × 1000 konfigurācijās |
| `npm.cmd run test:e2e -- tests/ocr.spec.js --grep 'OCR quota' --reporter=list --output=test-results/ocr-retry` | **3/3 sekmīgi** pēc pēdējā paziņojuma labojuma: neveiksmīga saglabāšana, retry un vecās kļūdas pazušana arī pēc dialoga aizvēršanas   |
| `npm.cmd run format:check`                                                                                     | Visi pārbaudāmie frontend faili atbilst Prettier konfigurācijai                                                                       |

Pilnajā pārbaudē ar **īsto dzinēju** visas trīs valodas atpazītas pēc tīkla atslēgšanas un pilnas lapas pārlādes, izmantojot iepriekš sagatavotos resursus. Atsevišķā tīkla novērošanā nav konstatēti ārēja origin pieprasījumi. Atcelšana pārbaudīta gan modeļa inicializācijas, gan aktīvas vairāku lapu atpazīšanas laikā. Iepriekš pabeigtā lapa un atceltā mēģinājuma statuss saglabājas pēc pārlādes.

Izpildījumu gaitā izlabota kodola 404 kļūdaina klasificēšana par modeļa kļūdu, iepriekšējās sesijas progresa palikšana pēc jaunas sesijas sākšanas un kļūdas paziņojuma saglabāšanās pēc veiksmīga retry. Lapas aizstāšanas tests izmanto īsto failu izvēles notikumu. Pirmajā pilnajā izpildījumā bija **116/117**: esošais dokumentu sadaļas kontrasta tests dažreiz mērīja vēl aktīvu maršruta caurspīdīguma animāciju. Tam pievienota animācijas beigu gaidīšana, nemainot kontrasta prasības; atkārtotais pilnais komplekts izturēts. Pēc pēdējā, tikai kļūdas paziņojumu skarošā UI labojuma veikts jauns būvējums un atsevišķā 3/3 regresijas pārbaude. Pilnais HTML pārskats saglabāts `frontend/playwright-report/index.html`; pēdējā mērķētā pārbaude to nepārraksta.

## Ierobežojumi un nākamais posms

Nav izmērīta darbība fiziskos mazatmiņas Android tālruņos, Android WebView, APK vai Capacitor native bezsaistes režīmā. Pārlūka mobilo izmēru emulācija nav fiziskas ierīces tests. Lieli 40 MP oriģināli un vairākas valodas var patērēt daudz atmiņas; kļūdas tiek parādītas, taču reāla ierīces atmiņas izsmelšana nav apzināti izraisīta. Priekšskatījums neietekmē OCR izšķirtspēju; apstrādātiem attēliem turpina darboties esošie redaktora 8 MP/5000 px ierobežojumi. OCR ievades papildu agresīva samazināšana nav pievienota.

Tabulas tiek atpazītas kā teksts; šūnu semantika, rokraksta uzticamība, dokumenta tips un rekvizīti nav šī posma rezultāts. Nav universālas kvalitātes garantijas nekvalitatīvām fotogrāfijām vai sarežģītiem izkārtojumiem. Melnrakstu glabāšana joprojām ir piesaistīta konkrētam pārlūka profilam/origin, bez mākoņa rezerves kopijas.

Nākamais posms var patērēt OCR rezultāta tekstu, valodas un izcelsmi dokumentu analīzei un grupēšanai. Pirms korporatīvā MI pievienošanas jāsaskaņo API specifikācija, datu aizsardzība un piekļuve. Atsevišķi jāpaplašina atļauto fotoattēlu transkripciju kopa, jāizmēra CER/WER un veiktspēja fiziskās ierīcēs, kā arī jāizvērtē PDF ģenerēšana. Fiksētas uzņēmumu vai rēķinu izkārtojumu veidnes šeit nav ieviestas.
