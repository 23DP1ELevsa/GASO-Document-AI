# 3. posms — lokāla dokumenta attēla apstrāde

Datums: 2026-11-10. Darbs veikts esošajā Vue 3/Vuetify pārlūka lietotnē. Git komandas, Android Studio un ārējie attēlu apstrādes/MI pakalpojumi nav izmantoti. Iepriekšējie OCR rīki un testu pārskati saglabāti.

## Izveidotie moduļi

| Fails `frontend/src/` | Atbildība |
| --- | --- |
| `features/processing/geometry.js` | Normalizētu četrstūru validācija, homogrāfija, izmēru aprēķins, bilineāra perspektīvas pārveide un pagriešana |
| `features/processing/detectDocument.js` | Samazināta rastra robežu kandidāti, ģeometrijas/malu/gaišuma vērtējums, nenoteiktības atgriešana |
| `features/processing/filters.js` | Sākotnējās krāsas, mērens uzlabojums, pelēktoņi, adaptīvs melnbalts slieksnis |
| `features/processing/processing.worker.js` | Attēlu dekodēšana, darba rastri, apstrāde, PNG un mazie priekšskatījumi ārpus galvenā pavediena |
| `features/processing/processor.js` | Viena Worker darba dzīves cikls, progress, kļūdas, 45 sekunžu limits un atcelšana |
| `components/CornerPicker.vue` | Četri 44 px marķieri, Pointer Events, tastatūra, pietuvinājums un procentu koordinātas |
| `components/ScanEditorDialog.vue` | Oriģināla/rezultāta salīdzināšana, lokāli pagaidu parametri, apstiprināšana/atcelšana |
| `styles/editor.css` | Esošajam gaišajam/tumšajam dizainam pielāgots redaktors mobilajam un darbvirsmai |

Esošajos `ScanView.vue`, `ScanPageCard.vue`, `ImagePreviewDialog.vue`, sesijas modulī un repozitorijā pievienota rediģēšanas darbība, apstrādāts priekšskatījums un atsevišķa oriģināla/rezultāta lasīšana.

## Algoritmi un izvēles pamatojums

Izvērtēta OpenCV.js oficiālā dokumentācija, tostarp homogrāfijas un perspektīvas pārveides. Šim posmam izvēlēts neliels, ar lietotni piegādāts JavaScript Worker bez ārējas OpenCV/WASM ielādes. OpenCV nav instalēts vai salīdzinoši mērīts; nav konstatēta un netiek apgalvota bibliotēkas nesaderība. Šeit izmantota sava matemātiska homogrāfija un ierobežots robežu kandidātu meklētājs.

Analīzes attēla garākā mala ir līdz 900 px. Algoritms izmanto pelēktoņus, 3 × 3 Gausa izlīdzināšanu, Sobel gradientus, vairākas gaišo apgabalu maskas, saistītas komponentes, izliektu apvalku un četru malu līniju precizēšanu. Kandidātus noraida pie kadra malas vai neatbilstošas ģeometrijas. Vērtē katras malas atbalstu un iekšējā/ārējā gaišuma atšķirību; laukums nav vienīgais kritērijs. Ja labākais kandidāts ir vājš vai vairāki ir līdzīgi, atgriež `uncertain` bez stūru koordinātām. UI atstāj manuālu atlasi un norāda nenoteiktību.

Homogrāfijas 8 koeficientus iegūst ar daļēji pivotētu Gausa elimināciju normalizētās koordinātās. Rezultāta pikseļi ar apgrieztu kartējumu tiek bilineāri nolasīti no izvēlētā oriģināla darba rastra. Izmēri balstīti pretējo malu garumos; netiek pieņemts A4 formāts. 90°/180°/270° pagriešana ietilpst koordinātu pārveidē. Katra filtrēšana sākas no oriģināla un parametriem; iepriekšējais PNG vai priekšskatījuma JPEG netiek atkārtoti izmantots kā avots.

Uzlabotais filtrs ierobežo kontrasta pastiprinājumu, saglabā krāsas. Melnbaltais filtrs izmanto lokālā vidējā gaišuma slieksni ar nelielu nobīdi. Tas nav garantēts uzlabojums jebkuram vājam tekstam; lietotājam rezultāts jāpārbauda un jāspēj atgriezties pie sākotnējām krāsām.

## Dati un saderība

IndexedDB datubāzes versija paliek **1**, jo nemainās krātuves vai indeksi. Ir papildu neobligāti ierakstu lauki:

- `pages.processing`: `{ version: 1, corners: [{x,y}, ...], rotation, filter }` vai `null`; `processedWidth`, `processedHeight`, `modifiedAt`; atjaunināts mazais priekšskatījums;
- `images.blob`: nemainīts sākotnējais Blob; `images.processed`: neobligāts PNG;
- `drafts.cover`: pirmās lapas pašreizējais mazais priekšskatījums.

Vecie ieraksti bez apstrādes parametriem atveras ar pilna attēla atlasi, 0° un sākotnējām krāsām. Tie netiek pārrakstīti, vienkārši atverot redaktoru. Apstiprināšana maina aktīvo sesiju, savukārt “Saglabāt melnrakstu” atomāri saglabā metadatus, oriģinālu un rezultātu. Lapu kārtošana parametrus saglabā; aizstāšana izveido jaunu neapstrādātu lapu; dzēšana izņem arī apstrādāto versiju. Oriģināla atjaunošana pēc saglabāšanas noņem rezultāta Blob.

## Pārbaudes

Izmantoti tikai sintētiski rastri un ģenerēts JPEG ar EXIF orientāciju. Oriģinālu saglabāšana pārbaudīta ar SHA-256 kontrolsummām. Pārlūka testi izmanto īstu IndexedDB un Worker, izņemot apzināti izraisītās kļūmju situācijas.

`npm.cmd run test:unit` pārbauda desmit scenārijus:

1. Izliekta četrstūra derīgums, paškrustošanās, apgriezta secība, sakrituši stūri un robežas.
2. Homogrāfijas sakritība ar neatkarīgi definētu projektīvu funkciju arī iekšējos punktos.
3. Perspektīvas pārveides nolasījumi no rastra ar zināmiem pikseļu koordinātu krāsu kodiem.
4. Visas četras taisnleņķa orientācijas ar precīzu pikseļu secību.
5. Čeka proporcijas un izvades izmēru ierobežojumi.
6. Visu četru filtru uzvedība, ieskaitot smalku līniju uz nevienmērīgi apgaismota fona.
7. Slīpa lapa uz tumša fona ar zināmiem stūriem.
8. Ēnota lapa un lielāks rāmis pie attēla malas, ko nedrīkst izvēlēties dokumenta vietā.
9. Gaišs zema kontrasta un vienkrāsains fons, kur jāatgriež nenoteiktība.
10. Gaišs fons ar pietiekamu kontrastu un divas līdzīgi ticamas lapas, kuru gadījumā jāizvēlas manuālais režīms.

`tests/editor.spec.js` pievieno deviņus scenārijus, katru **360 × 800**, **412 × 915** un **1440 × 1000** izkārtojumā:

- Robežu piedāvājums, zināmas manuālās koordinātas, perspektīvas rezultāta izmēri un parametru saglabāšana/atjaunošana.
- Peļu un CDP skāriennotikumu vadīti stūri, tastatūra un pietuvinājuma koordinātas; nederīga četrstūra bloķēšana. Pārlūka koordinātu pārbaudes pieļauj ne vairāk kā viena ekrāna pikseļa noapaļošanu.
- Pagriešana, visi filtri un oriģināla atjaunošana. Saglabāta PNG pikseļi pārbaudīti uz pelēktoņu un bināru rezultātu, nevis tikai pēc pogu stāvokļa.
- Jau esoši v1 ieraksti bez jaunajiem laukiem; atcelšana nemaina to datus vai sesijas saglabāšanas stāvokli.
- Divu lapu rediģēšana, pārkārtošana, aizstāšana un dzēšana, pārbaudot rezultātu tīrīšanu.
- Worker kļūda un iestrēguša darba atcelšana/apturēšana bez sesijas izmaiņām.
- Axe WCAG A/AA pārbaudes abos režīmos; redaktora darbošanās bezsaistē ar kešā esošo lokālo Worker kodu.
- EXIF orientēta JPEG koordinātu saglabāšanās un papildu 90° pagriešana.
- Mākslīgi izraisīta kvotas kļūme apstrādātā attēla ierakstā: transakcijas atcelšana saglabā iepriekšējo oriģinālu/parametrus, atkārtota saglabāšana izdodas.

Visi 60 iepriekšējie navigācijas, sesiju, importa, kļūdu, bezsaistes un izkārtojuma testi paliek pilnajā komplektā. Kopā pilnais komplekts ietver 87 pārlūka testus.

```powershell
cd frontend
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run format:check
```

| Pārbaude | Faktiskais rezultāts |
| --- | --- |
| `npm.cmd run test:unit` | **10 no 10 sekmīgi** |
| `npm.cmd run build` | Vite produkcijas būvējums sekmīgs; lokālais Worker komplektēts kopā ar lietotni; PWA interfeisa precache ap 727 KiB |
| `npm.cmd run test:e2e` | **87 no 87 sekmīgi**, pēdējais pilnais izpildījums ap 3,5 minūtēm |
| `npm.cmd run format:check` | Visi pārbaudāmie frontend faili atbilst Prettier konfigurācijai |

Izpildvide: Node.js 24.15.0, npm 11.12.1 un instalēts Google Chrome; jaunas atkarības nav pievienotas. Starppārbaudē mobilā skāriena koordināta noapaļojās par daļu ekrāna pikseļa. Tests sagaida dialoga animācijas beigas un pārbauda novirzi attēla ekrāna pikseļos, nevis pieprasa neiespējamu precizitāti uz procenta simtdaļu. Gala pilnajā izpildījumā kļūmju nav.

Ekrānattēli, trace kļūmēm un HTML pārskats atrodas iepriekš izmantotajās ignorētajās `frontend/test-results/` un `frontend/playwright-report/` mapēs. Mobilā un darbvirsmas redaktora ekrānattēli papildus vizuāli apskatīti. Testa priekšskatījuma serveris pēc izpildes tiek apturēts.

## Ierobežojumi un nākamie darbi

Automātiskais meklētājs ir heiristisks, nevis statistiski validēts universāls dokumentu detektors. Testu situācijas nepierāda drošu darbību ar visiem fonu materiāliem, atspīdumiem, vairākiem dokumentiem, salocītām lapām vai ļoti vāju kontrastu. Lietotājam vienmēr jāpārbauda atlase; neskaidrībā darbojas manuālā izvēle.

Oriģinālu importa limiti saglabāti. Darba rastrs ierobežots līdz 16 MP / 6000 px, apstrādātais rezultāts līdz 8 MP / 5000 px un 48 MiB. Samazināšana resursu dēļ skar darba kopiju/rezultātu, nevis oriģinālu. Ir progress, viens darbs vienlaikus un 45 sekunžu pārtraukšanas limits. Maksimālā apjoma attēli un reāla mazatmiņas tālruņa veiktspēja nav izmērīta.

Skārieni pārbaudīti ar Chrome CDP emulāciju, nevis fizisku Android ierīci. Nav pārbaudīts Android Studio, APK, Safari/Firefox vai ekrānlasītājs. Pārlūkam nepieciešams Worker, ImageBitmap un OffscreenCanvas atbalsts; nepieejama procesa gadījumā tiek parādīta kļūda un saglabāts iepriekšējais stāvoklis.

OCR, PDF, dokumentu klasifikācija/grupēšana, serveris un MI nav ieviesti. Nākamais posms var izmantot saglabātos oriģinālus un apstrādātos PNG OCR/PDF sagatavošanai; papildus vajadzīga kvalitātes novērtēšana ar atļautām reālām fotogrāfijām un fiziskām ierīcēm.
