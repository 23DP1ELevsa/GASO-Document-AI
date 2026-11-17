# Mobilās pārskatīšanas un dokumentu apskates pārbaude

Datums: 2026-11-17. Šis pārskats papildina iepriekšējo fotoanalīzes un komplektu ieviešanu.

## Ieviestā plūsma

- Viena skaidra darbība “Apstiprināt dokumentu” validē vērtības, atzīmē aktīvos dinamiskos atribūtus kā pārbaudītus un vienā nemainīgā modeļa atjauninājumā veido momentuzņēmumu. Saglabāšana notiek pirms pārejas uz pabeigšanas skatu. Nederīgi dati netiek apstiprināti; fokusējas pirmais kļūdainais lauks.
- Kompakta atribūtu tabula ar viena lauka rediģēšanu. Saglabāta pielāgoto lauku pievienošana, pārdēvēšana un dzēšana. Tukšs lauku katalogs netiek izklāts tabulā.
- Jaunais DocumentView atver konkrētu dokumentu tikai lasīšanai no sesijas vai komplekta. Lapu priekšskatījumam izmanto kopīgo ImagePreviewDialog. PDF ģenerēšana ir atsevišķa lietotāja darbība, izmantojot esošo Unicode PDF Worker.
- Dokumenti ir atsevišķas kartītes, arī vienā vairāku dokumentu sesijā. Saraksts apvieno komplektu piederības ar sākotnējo dokumentu un rāda aktuālu apstiprinājuma statusu. Nepabeigtām sesijām saglabāta turpināšana. Sesijas dzēšana ir nodalīta un skaidri norāda tās apjomu.
- “Uz sākumu” saglabā netīro sesiju; neveiksmīga saglabāšana saglabā arī atvērtos attēlus un ievadīto tekstu. Pabeigšanas ekrānā pieejama apskate, PDF, komplekts, nākamais skenējums un sākumlapa.
- Komplekta kartīte atver saglabāto momentuzņēmumu un atgriežas tieši tajā pašā komplektā. Sākotnējā dokumenta rediģēšana neaizstāj komplekta versiju.

## Datu savietojamība

Nav jaunas IndexedDB shēmas migrācijas. Versija paliek 2; saglabāti vecie melnraksti, OCR dati, attēlu atsauces un komplektu momentuzņēmumi. Esošās isConfirmationCurrent pārbaudes atceļ apstiprinājuma aktualitāti pēc vērtību vai avota izmaiņām. V1 AI ieteikumi tiek piedāvāti pārskatīšanā bez klusas apstiprināšanas.

Maršruts: /document/:id ar draft vai collection vaicājuma parametru. Apskates ielāde lasa IndexedDB un nepalaiž AI. Sākotnējā sesija tiek pārbaudīta pirms rediģēšanas; dzēstam avotam rediģēšanas saites nav. PDF no sesijas pārbauda saglabāto revīziju; komplekta PDF izmanto nemainīgo saglabāto versiju.

## Automatizēto pārbaužu tvērums

Jaunie modeļa testi pārbauda atomisku apstiprināšanu, ievades nemutēšanu un nederīgus dinamiskos datus. mobile-review.spec.js pārbauda vienu apstiprinājumu, PDF tikai pēc darbības, lasāmu apskati pēc pārlādes, abu lapu oriģinālu, validāciju, sākumlapu no katra soļa, kvotas kļūdas, komplekta momentuzņēmumu pēc avota dzēšanas un vairāku dokumentu kartītes.

Novecojušie OCR saskarnes testi pielāgoti fotoanalīzei ar imitētām AI atbildēm. Izolētie OCR dzinēja vienību testi saglabāti. Nav izlaistu vai dzēstu testu tikai veiksmīga rezultāta iegūšanai. Maksas OpenAI pieprasījumi nav veikti. Pārbaudīta 360 px, 390 px un darbvirsmas saskarne, gaišā/tumšā tēma, tastatūra, axe pieejamība un Android atpakaļpogas notikumu loģika pārlūkā.

## Vizuālā pārbaude

Ar sintētiskiem dokumentiem pārskatīti 390 px ekrānattēli: [pārskatīšana](mobile-ux/review-390.png), [tumšā tēma](mobile-ux/review-dark-390.png), [pabeigšana](mobile-ux/completion-390.png), [dokumenta apskate](mobile-ux/document-390.png). Atsevišķā pārlūka pārbaudē veiksmīgi lejupielādēts PDF no jaunā apskates skata; pēc saglabātās revīzijas maiņas atkārtota lejupielāde tiek bloķēta un priekšskatījuma URL atbrīvots.

## Rezultāti

- Frontend vienību testi: **68/68 izturēti**, 0 kļūdu, 0 izlaistu testu (npm run test:unit).
- Produkcijas būvējums: **veiksmīgs** (npm run build); PWA kešatmiņas manifests ģenerēts.
- Pilnais Playwright komplekts: **234/234 izturēti**, 0 kļūdu, 0 izlaistu testu, ilgums 6,8 minūtes. Tie ir 78 scenāriji trīs projektos: mobile-360, mobile-390 un desktop. Komanda: GASO_E2E_EXTERNAL_SERVER=1 npx playwright test --workers=4 --timeout=90000 --reporter=line. Garās PDF un abu tēmu axe pārbaudes ir iekļautas šajā pilnajā palaidienā.
- Izmainīto UX komponenšu, skatu, modeļa un testu Prettier pārbaude: **veiksmīga**.
- Papildu pārlūka pārbaude: faktiskā PDF lejupielāde no DocumentView un lejupielādes bloķēšana pēc revīzijas maiņas — **veiksmīga**.
- Atlikušu neizturētu testu **nav**.

Pilnā palaidiena pieraksti: frontend/ux-final-unit.log, frontend/ux-final-build.log un frontend/ux-final-suite.log. Testos izmanto sintētiskus attēlus un imitētu analīzi; šie rezultāti neapliecina atsevišķu reāla OpenAI pakalpojuma izsaukumu vai fiziskas Android ierīces darbību.

## Ierobežojumi

Dati un fotogrāfijas glabājas lokāli; pārlūka datu dzēšana tos izdzēš. Lejupielādēts PDF netiek uzdots par arhivētu failu: to atkārtoti ģenerē no datiem un attēliem. Komplektu momentuzņēmumi automātiski netiek aizstāti ar jaunām avota versijām. Nav veikta pārbaude fiziskā Android ierīcē; APK, MongoDB un jauna servera glabāšana nav ieviesti. OpenAI servera konfigurācija, modelis un attēlu analīzes pamatprincipi šajā UX uzdevumā nav mainīti. Git darbības nav veiktas.
