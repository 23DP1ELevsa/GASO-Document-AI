# 6. posms — lokāla PDF ģenerēšana un eksports

## Bibliotēkas un licences

2026-11-12 pārbaudīta oficiālā dokumentācija, repozitoriju licences un npm jaunākās publicētās versijas. Izvēlēts **pdf-lib 1.17.1** un **@pdf-lib/fontkit 1.1.1** (abas MIT). `pdf-lib` nodrošina PDF lapas, JPEG/PNG ievietošanu un teksta zīmēšanu pārlūkā; `fontkit` ļauj iegult savu fontu. Izmantoti npm moduļi Vite būvējumā, bez izpildlaika CDN. Izvēle atbilst esošajam JavaScript/Vite projektam un neprasa serveri vai Node vidi pārlūkā. PDFKit arī ir pārlūka iespējas, bet šim ierobežotajam lapu/attēlu/tabulas zīmēšanas uzdevumam izvēlēta mazāka integrācija ar `pdf-lib` API; salīdzinošs ātrdarbības mērījums nav veikts.

Avoti: [pdf-lib dokumentācija](https://pdf-lib.js.org/), [API un fontu iegulšana](https://pdf-lib.js.org/docs/api/classes/pdfdocument), [publicētie laidieni](https://github.com/Hopding/pdf-lib/releases), [pdf-lib licence](https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md), [fontkit oficiālais README](https://github.com/Hopding/fontkit/blob/master/README.md), [PDFKit pārlūka instrukcija](https://pdfkit.org/docs/getting_started.html).

**Noto Sans Regular 2.008**, 569 208 baiti, piegādāts kā nemainīts lokāls TTF. Tas aptver latīņu/latviešu un kirilicas tekstu. Licence: **SIL OFL 1.1**, kas pieļauj fonta iegulšanu un izplatīšanu ar programmatūru. Pilnais paziņojums ir `frontend/public/licenses/NotoSans-OFL.txt`; bibliotēku paziņojumi — blakus `pdf-lib-MIT.txt` un `fontkit-MIT.txt`. Fontkit npm pakotnē nav atsevišķa licences faila, tāpēc piegādāta pakotnes MIT deklarācijas norāde un sākotnējā fontkit autora MIT paziņojums.

Fonta avota commit ir `ffebf8c1ee449e544955a7e813c54f9b73848eac`, SHA-256 `b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5`. Avota saites, izmērs un licences kontrolsumma glabāti `frontend/src/assets/fonts/source.json`. [Oficiālais fonta avots](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans), [OFL teksts](https://github.com/notofonts/noto-fonts/blob/main/LICENSE), [fontkit sākotnējā licence](https://github.com/foliojs/fontkit/blob/master/LICENSE).

Ne visi Unicode simboli ir šajā fontā: neatbalstītus simbolus, piemēram, emocijzīmes, informācijas lapā noraida ar kļūdu. Tie netiek klusi aizstāti vai izlaisti. PDF skenējumi joprojām saglabā dokumentā redzamos simbolus kā attēlu. Fonta apakškopa tiek iegulta tikai režīmā ar informācijas lapu.

Neatkarīgai PDF pārbaudei testos izmantots **pdfjs-dist 6.5.438** (Apache-2.0), [oficiālais PDF.js projekts](https://mozilla.github.io/pdf.js/). Tas neietilpst lietotnes izpildlaika kodā. Tā Node prasības dēļ projekta minimums paaugstināts uz Node.js 22.13; pārbaudīts ar 22.14.0.

## Lietotāja plūsma un režīmi

Dokumenta kartītes **Izveidot PDF** atver `PdfExportDialog.vue`. Noklusējums ir informācijas lapa, A4 un augsta kvalitāte. Lietotājs var noņemt informācijas lapu, izvēlēties attēla proporciju lapu vai optimizētu kvalitāti. Visām pogām ir realizēta darbība.

**Ar informāciju:** pirms skenējumiem izveido divu kolonnu atribūtu tabulu ar latviskiem lauku nosaukumiem. Ir dokumenta nosaukums, tips, numurs, nosūtītājs, saņēmējs, datums un pārējie aizpildītie standarta/papildu lauki. Tukšs kopīgais lauks ir `—`. Virsraksts, vērtības un gari vārdi tiek pārnesti pēc faktiskajiem fonta platuma mērījumiem. Tabula turpinās nākamajā lapā ar kolonnu virsrakstiem; arī viena ļoti gara vērtība drīkst turpināties vairākās lapās. Teksts paliek atlasāms, kopējams un meklējams.

**Tikai skenējumi:** informācijas lapu un atribūtu tekstu nepievieno. Katrs grupas lapas attēls aizņem atsevišķu PDF lapu, grupas `pageIds` secībā. PDF neveido no apvienota sesijas OCR teksta un nepievieno citas grupas lapas. Katru dokumentu eksportē atsevišķi; masveida lejupielāde/ZIP nav ieviesti.

**Priekšskatīt PDF** parāda progresu, pēc tam lapu skaitu, faila izmēru un informācijas lapas statusu. Iebūvētam skatam izmanto tikai lokālu Blob URL. Ja `navigator.pdfViewerEnabled` nav patiess vai skats nav pieejams, piedāvā faila atvēršanu jaunā cilnē vai lejupielādi. Alternatīvā saite ir pieejama arī blakus iebūvētajam skatam. Ja pārlūks bloķē jaunu cilni, paliek lejupielādes iespēja. Dialoga aizvēršana atjauno fokusu uz izsaukuma pogu un atbrīvo URL.

## Apstiprinājums un datu integritāte

Informācijas lapa ir pieejama tikai, ja `documentExportPlan().confirmed` ir patiess: dokumenta pašreizējās vērtības un lapu/OCR versija atbilst apstiprinājuma momentuzņēmumam. Neapstiprinātas vai novecojušas kartītes gadījumā redzams brīdinājums, priekšskatījums ar kartīti ir bloķēts un **Atgriezties pie datu pārbaudes** atver esošo redaktoru. Var izvēlēties tikai skenētās lapas. Melnraksta informācijas lapas eksportu šajā posmā nepiedāvā.

PDF laukus veido tikai no dokumenta pārbaudītajām vērtībām, nevis `analysis.result` ieteikumiem. `requires_review` un apstiprinājums ģenerēšanas laikā netiek mainīti. Datumi, summas, OCR teksts, grupējums un oriģināli netiek pārveidoti PDF vajadzībām.

`snapshot.js` vajadzības gadījumā vispirms saglabā sesijas nesaglabātās izmaiņas ar esošo atomāro transakciju. Poga tad saucas **Saglabāt un priekšskatīt PDF** un teksts skaidro saglabāšanu. Kļūmes gadījumā PDF Worker netiek palaists. Pēc saglabāšanas atkārtoti ielasa melnrakstu un pārbauda tā ID, revīziju un dokumenta datu parakstu pret atvērto sesiju. Attēli tiek lasīti no saglabātās `images` krātuves.

Pēc ģenerēšanas, pirms lejupielādes un pirms alternatīvās atvēršanas atkārtoti pārbauda revīziju un parakstu. Citas cilnes saglabājums vai izmaiņas atvērtajā sesijā bloķē iepriekšējo priekšskatījumu. Tā ir pārbaude pret novērojamo aktuālo revīziju, nevis ilgstoša datubāzes bloķēšana citām cilnēm. Eksporta laikā vietējās sesijas rediģēšanas vadīklas ir bloķētas.

Nav jaunas IndexedDB krātuves vai migrācijas. Gatavais PDF ir tikai īslaicīgs Blob un lietotāja lejupielādēts fails. Atcelšana aptur PDF procesu; pirms tā jau sekmīgi pabeigtā melnraksta saglabāšana netiek atsaukta.

## Attēli, izmērs un orientācija

`resolveOcrInput` tiek atkārtoti izmantots pilna apstiprinātā attēla nolasīšanai: saglabāts `processed` Blob ir prioritārs, citādi oriģināls; vecam ierakstam ar apstrādes parametriem, bet bez rezultāta, lokāli atjauno apstrādāto attēlu. Šo atjaunošanu PDF process nesaglabā atpakaļ dokumentā. Thumbnail netiek izmantots.

Augstā kvalitātē JPEG/PNG ievieto sākotnējos baitus, ja nav vajadzīga izmēra vai EXIF orientācijas korekcija. JPEG EXIF un PNG eXIf attēlus nepieciešamības gadījumā dekodē ar orientāciju un saglabā PNG, lai PDF bibliotēka neignorētu pagriezienu. WebP vienmēr konvertē lokāli. Konvertēšanai izmanto pilna izmēra dekodēto attēlu un OffscreenCanvas. Pēc darba aizver ImageBitmap un atbrīvo pagaidu kanvu.

**A4:** automātiski izvēlas portretu vai ainavu, saglabā 18 pt malas un centrē attēlu ar vienādu mērogu abās asīs. **Pielāgots:** PDF lapas proporcijas atbilst attēlam; tā nav kalibrēta sākotnējā fiziskā dokumenta izmēra atjaunošana. Informācijas lapas vienmēr ir A4 portretā.

| Režīms              | Izšķirtspēja                                   | Iegulšana                                                              |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| Augsta, noklusējums | Līdz 16 MP un 6000 px malā, bez palielināšanas | JPEG/PNG parasti bez pārkodēšanas; vajadzīgās korekcijas un WebP → PNG |
| Optimizēta          | Līdz 4 MP un 2400 px malā, bez palielināšanas  | Viena pārkodēšana JPEG ar kvalitāti 0,85 un baltu fonu                 |

Optimizācijas brīdinājums paskaidro sīka teksta un tabulu līniju risku. Ja augstā kvalitātē lielais attēls ir samazināts, to norāda arī rezultātā. Avota fails un apstiprinātais apstrādātais attēls nemainās.

## Veiktspēja, privātums un robežas

Ģenerēšana notiek vienā atsevišķā PDF Worker; tas pa vienam pieprasa attēlus no galvenā procesa. `pdf-lib.flush()` katrā solī iegulst/saspiež attēlu pirms nākamā rastra apstrādes. Process nav straumējošs: PDF bibliotēka līdz saglabāšanai glabā iegulto objektu datus atmiņā. Atsevišķa 40 MP avota dekodēšana vēl var prasīt ievērojamu atmiņu; fiziski mazatmiņas tālruņi nav mērīti.

| Ierobežojums                     | Vērtība             |
| -------------------------------- | ------------------- |
| Skenētās lapas                   | 20 vienā dokumentā  |
| PDF lapas, ieskaitot informāciju | 128                 |
| Informācijas teksts              | 250 000 rakstzīmju  |
| Viens pilna attēla Blob          | 48 MiB              |
| Sagatavoto attēlu baiti kopā     | 64 MiB              |
| Gala PDF                         | 80 MiB              |
| PDF Worker darbības laiks        | 3 minūtes, atceļams |

Ir saprotamas kļūdas trūkstošam/bojātam attēlam, fontam, apjoma ierobežojumam, neatbalstītam simbolam, Worker kļūmei, atmiņai un saglabāšanai. Kļūme neizveido daļēju lejupielādējamu PDF. Atcelšana, kļūda, noildze un sekmīgs rezultāts aptur Worker; novēlotus ziņojumus ignorē. Katrs dialogs ļauj tikai vienu aktīvu darbu. Iestatījumu maiņa atbrīvo iepriekšējo priekšskatījumu.

Netiek izmantots serveris, ārējs PDF/MI API, CDN fonts, dokumentu augšupielāde vai analītika. PWA kešā ir tikai lietotnes statiskais PDF kods un fonts; dokumentu Blob URL, attēli un sagatavotie PDF tur netiek ierakstīti. Produkcijas PWA pēc sākotnējās sekmīgās instalācijas darbojas bezsaistē arī tad, ja PDF dialogu atver pirmoreiz. Dev serverim nav produkcijas PWA keša.

**Meklējams ir informācijas lapas teksts. Skenētajām lapām nav neredzama OCR slāņa**, tāpēc nevar apgalvot, ka viss PDF ir meklējams. Koordinātām piesaistīta OCR slāņa ģenerēšana ir nākamais darbs. Capacitor/Vite kopīgā koda struktūra saglabāta, taču native failu saglabāšana/Android PDF skatītājs nav pārbaudīts un APK nav būvēts.

## Faktiskās pārbaudes

Izmantoti tikai sintētiski attēli un OCR, Node.js 22.14.0 un instalētais Google Chrome. `test-support/readPdf.js` ar neatkarīgu PDF.js lasītāju pārbauda faktiskos failus: lapu skaitu, Unicode teksta izvilkšanu, teksta robežas, attēlu izmērus un pikseļu paraugus dokumenta secībā. Tas pārbauda saturu, nevis tikai Blob esamību.

- `npm.cmd run build` — sekmīgi; produkcijas PWA iekļauj lokālo PDF Worker un fontu.
- `npm.cmd run test:unit` — 46/46 sekmīgi, tostarp 12 jauni PDF testi.
- `npm.cmd run format:check` — sekmīgi.
- `npm.cmd run test:e2e` — **162/162 sekmīgi** galīgajā pilnajā palaišanā, 5,6 minūtes. Ietverti **27 jaunie PDF scenāriji** un visa iepriekšējā skenēšanas, redaktora, īstā OCR un dokumentu grupēšanas regresija trīs izmēros: 360, 412 un 1440 px.

Pirms galīgās palaišanas testa ārējā tīkla novērošana precizēta, lai Chrome iebūvētā PDF skatītāja `chrome://` resursus neuzskatītu par ārējiem HTTP pieprasījumiem. Vienā mērķētajā palaišanā priekšlaicīga testa pārlāde pārtrauca sākotnējo PWA sagatavošanu; bezsaistes testa datos pievienota gaidīšana uz PWA gatavību pirms šīs pārlādes. Priekšskatījuma alternatīvas un bezsaistes scenāriji pēc tam izpildīti divreiz (4/4), un galīgā pilnā palaišana izturēta bez kļūdām. Pēc visu testu beigām Windows priekšskatījuma process apturēts, lai palaišanas process pabeigtu atskaiti; gala izejas kods 0. Iepriekšējie attēlu testi izdeva Fontconfig keša direktorijas brīdinājumu, taču visi attēlu un OCR testi izturēti.

PDF vienību testi aptver failu nosaukumus, datu izolāciju un apstiprinājumu, lapu proporcijas, vienas/vairāku lapu failus, Unicode teksta esamību, daudzu un garu atribūtu/titulu turpinājumu bez nogriešanas, nolasīšanas secību, kļūmes, atcelšanu, saglabāšanas prasību, citas cilnes revīziju, JPEG baitu saglabāšanu un Worker resursu atbrīvošanu. Pārlūka PDF scenāriji aptver abus režīmus, faktiskās lejupielādes, JPEG/PNG/WebP, apstrādātā attēla prioritāti, EXIF, optimizāciju, priekšskatījuma alternatīvu, pieejamību gaišā/tumšā režīmā, kļūmju atkārtošanu, bezsaisti un URL/Worker atbrīvošanu 360, 412 un 1440 px izmēros.

Manuāli vizuāli pārbaudīts pārlūka ģenerētā PDF priekšskatījuma ekrānattēls: virsraksts, tabula un kirilica redzami vienotā izkārtojumā. Tas nav fiziska tālruņa vai lielu reālu dokumentu kvalitātes mērījums. Lokālās atskaites/ekrānattēli: `frontend/playwright-report/`, `frontend/test-results/`.
