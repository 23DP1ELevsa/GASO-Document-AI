Lovable mobilais dizains ir pārnests uz esošo Vue 3 / Vuetify lietotni. Dizaina avoti bija `gazo-paper-companion-main/DESIGN_SPEC.md`, `src/proto/App.tsx`, `src/proto/ui.tsx`, `src/styles.css`, `src/proto/model.ts` un `src/proto/store.tsx`. Prototipa faili nav mainīti. Git komandas nav izpildītas.

| Ekrāns      | Pārveide                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sākums      | Lielā zilā skenēšanas kartīte, galerijas izvēle, līdz diviem nepabeigtiem melnrakstiem, privātuma piezīme.                                                                                                               |
| Foto        | Tumšs fotografēšanas ekrāns ar rāmi un slēdzi, kas atver esošo ierīces kameras / faila izvēli. Kamera netiek imitēta.                                                                                                    |
| Lapas       | Divu kolonnu priekšskatījumi, pārvietošana, rediģēšana, aizstāšana un apstiprināta dzēšana. Vienai lapai dokuments izveidojas, turpinot uz datiem. Vairākas lapas var sadalīt ar redzamiem atdalītājiem.                 |
| Redaktors   | Pilnekrāna mobilais izkārtojums ar esošo perspektīvas korekciju, pagriešanu un filtriem.                                                                                                                                 |
| Dati        | Priekšskatījumu josla, rediģējamu lauku kartītes, statusi “Pārbaudiet”, “Nav atrasts”, “Pārbaudīts”, atsevišķi lauku avoti un poga “Pareizi”. Apzināti notīrīts ieteikums paliek tukšs arī pēc saglabāšanas.             |
| PDF         | Satura izvēle “PDF ar informāciju” / “Tikai skenējums”, sakļauti kvalitātes un A4 / Letter / foto proporciju iestatījumi, priekšskatījums un tiešā lejupielāde. Informāciju var iekļaut tikai ar aktuālu apstiprinājumu. |
| Gatavs      | Lejupielādei nodotā faila nosaukums, nākamā dokumenta skenēšana un pāreja uz dokumentiem. Pārlūks nevar garantēt, ka lietotājs ir pabeidzis faila saglabāšanu, tāpēc saskarne precīzi norāda lejupielādes sākšanu.       |
| Dokumenti   | Kompaktas kartītes ar priekšskatījumu, nosaukumu, lapu skaitu, izmaiņu laiku, statusu un melnraksta turpināšanu. Mainot eksportētā dokumenta saturu, tā lejupielādes statuss tiek atcelts.                               |
| Iestatījumi | Kompaktas gaišā / tumšā režīma un noklusējuma PDF izvēles. Saglabāta valodu un bezsaistes resursu sagatavošana.                                                                                                          |

Visos ekrānos lietotnes platums nepārsniedz 430 px. Pārnestas prototipa krāsas, lokāls Manrope fonts, noapaļojumi, atstarpes, kartīšu ēnas un apakšējā darbību josla. Galvenā navigācija sākumā un dokumentos satur divas cilnes. Solī vienmēr ir viena galvenā darbība un iepriekšējo soļu izvēle. Ievērotas statusa un navigācijas joslu drošās zonas; Android atpakaļpoga pārslēdz soļus vai aizver aktīvo rediģēšanas skatu.

Saglabāta esošā IndexedDB datubāze, tās transakcijas un revīziju pārbaudes, oriģinālie attēli, veco melnrakstu atvēršana, dokumentu grupēšana, Tesseract.js latviešu / angļu / krievu atpazīšana, lokālā analīze, manuālie lauki un apstiprinājumi, pdf-lib ģenerēšana, PWA un Capacitor Android struktūra. Atpazīšana izmanto jau aktuālu lapas tekstu atkārtoti. PDF pirms ģenerēšanas un lejupielādes pārbauda saglabāto versiju. “Saglabāts ierīcē” parādās tikai pēc veiksmīgas saglabāšanas; kļūdas gadījumā iespējams mēģināt vēlreiz.

Prototipa demonstrācijas dokumenti, demonstrācijas atpazīšana, React un prototipa localStorage dokumentu modelis nav pārņemti. Papildu dokumenta metadati glabājas esošajos IndexedDB ierakstos; tēmas un PDF izvēles ir atsevišķi lietotnes iestatījumi.

Pārbaudes veiktas ar sintētiskiem dokumentiem. Gala rezultāti:

| Pārbaude                          | Rezultāts                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run build`                   | Veiksmīgi; sagatavoti arī lokālie atpazīšanas resursi un PWA.                              |
| `npm run test:unit`               | 57 / 57 testi veiksmīgi.                                                                   |
| `npm run test:e2e -- --workers=3` | 189 / 189 testi veiksmīgi, bez izlaistiem testiem; pilnais komplekts aptuveni 2,7 minūtēs. |
| `npm run format:check`            | Veiksmīgi.                                                                                 |

Komandas izpildītas `frontend/` mapē; Windows vidē izmantots `npm.cmd`. Pārlūka testiem darbojās atsevišķs lokāls Vite preview serveris ar `GASO_E2E_EXTERNAL_SERVER=1`. Testi aptver 360 × 800 un 390 × 844 skārienekrāna profilus, kā arī 1440 × 1000 datora profilu ar centrēto mobilo saskarni. Papildu ekrānattēli uzņemti 360 × 780 un 390 × 844 izmērā.

Pārbaudīta viena un vairāku dokumentu pilnā apstrāde, īsta trīs valodu atpazīšana, atpazīšanas kļūda un atcelšana, aktuāla teksta atkārtota izmantošana, manuāla datu ievade, veco melnrakstu atvēršana, saglabāšanas kļūdas un atkārtošana, lapu aizstāšana un dzēšana, redaktors, PDF saturs un attēlu secība, izmaiņas citā cilnē, darbs bez interneta, resursu atbrīvošana, abi krāsu režīmi, automātiskā WCAG AA pārbaude un fiksētās darbību joslas pārklāšanās.

Android Studio un fiziska Android ierīce netika izmantoti. Kamera turpina izmantot esošo pārlūka / ierīces failu izvēli; tieša Capacitor Camera integrācija nav pievienota.

Ekrānattēli no īstās Vue lietotnes:

| Skats              | 360 × 780                                     | 390 × 844                                     |
| ------------------ | --------------------------------------------- | --------------------------------------------- |
| Sākums             | [Attēls](mobile-design/home-360.png)          | [Attēls](mobile-design/home-390.png)          |
| Foto               | [Attēls](mobile-design/capture-360.png)       | [Attēls](mobile-design/capture-390.png)       |
| Lapas              | [Attēls](mobile-design/pages-360.png)         | [Attēls](mobile-design/pages-390.png)         |
| Dati               | [Attēls](mobile-design/fields-360.png)        | [Attēls](mobile-design/fields-390.png)        |
| PDF                | [Attēls](mobile-design/pdf-360.png)           | [Attēls](mobile-design/pdf-390.png)           |
| Gatavs             | [Attēls](mobile-design/done-360.png)          | [Attēls](mobile-design/done-390.png)          |
| Dokumenti          | [Attēls](mobile-design/documents-360.png)     | [Attēls](mobile-design/documents-390.png)     |
| Tumšie iestatījumi | [Attēls](mobile-design/settings-dark-360.png) | [Attēls](mobile-design/settings-dark-390.png) |
