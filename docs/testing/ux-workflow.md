# UX pārstrāde — dokumenta sagatavošana četros soļos

## Problēmas un izvēlētais risinājums pirms implementācijas

| Pašreizējā problēma                                                                             | Risinājums                                                                                                                       |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Vienā garā lapā vienlaikus redzami imports, lapu rīki, grupēšana, OCR, analīze un eksports      | Četri stāvoklim piesaistīti soļi: pievienošana, lapas, informācija, PDF                                                          |
| Pat vienam rēķinam jāizveido grupa un atsevišķi jāatlasa lapas                                  | Skaidra izvēle “Visas lapas ir viens dokuments”, izmantojot esošo grupēšanas modeli                                              |
| Vairāku dokumentu veidošanu sāk ar tukšām grupām un sarakstiem                                  | Lapu priekšskatījumos atzīmējamas jauna dokumenta sākuma vietas; pilnie manuālie rīki paliek pieejami                            |
| Atsevišķi jāzina par OCR un lokālo analīzi                                                      | Viena darbība “Atpazīt dokumentu”: atkārtoti izmanto aktuālo tekstu, atpazīst tikai nepieciešamās lapas un tad piedāvā atribūtus |
| Trīs kolonnu atribūtu tabula konkurē ar lasāmu un aizpildāmu informāciju                        | Rediģējama forma ar skaidru ieteikuma/pārbaudes statusu; avota fragmenti un papildlauki izvēršami                                |
| Neaktīva PDF poga neskaidro, kā turpināt                                                        | Divas skaidras izvēles: pārbaudīt informāciju vai saglabāt tikai skenētās lapas; kvalitātes iestatījumi papildu sadaļā           |
| Sākumlapa neparāda konkrētos iesāktos darbus un ieviestais process joprojām atzīmēts kā plānots | Galvenā skenēšanas darbība, īss iespēju apraksts un konkrētas turpināmo sesiju kartītes                                          |
| Melnraksti izskatās pēc neskaidra arhīva                                                        | Sesiju statuss pēc lapu grupējuma; skaidrs paskaidrojums, ka lejupielādētie PDF nav lietotnes arhīvs                             |
| Saglabāšanas darbība pazūd garās lapas apakšā                                                   | Vienmēr sasniedzams statuss un saglabāšanas darbība; saglabāšana pie pārejām un apstiprinājuma                                   |

Saglabāšanas arhitektūru nepārbūvē par paralēlu fona rakstīšanu: esošais OCR saglabā pēc katras lapas, savukārt PDF pārbauda saglabāto revīziju. Nekontrolēts taimeris varētu konkurēt ar šīm darbībām. Izvēlēta secīga saglabāšana skaidros lietotāja darbību punktos un redzams nesaglabāto izmaiņu statuss. Saglabāšanas kļūme nedrīkst tikt parādīta kā veiksmīga pāreja vai apstiprināts saglabājums.

Esošie attēlu apstrādes, OCR, lokālās analīzes un PDF dzinēji paliek spēkā. Plūsmas metadati ir neobligāts melnraksta papildinājums; vecajiem ierakstiem turpināšanas soli nosaka no faktiskajām lapām, grupām un aktuālajiem apstiprinājumiem.

## Implementācija un pārbaudes

### Galvenā plūsma

1. **Sākums → Skenēt dokumentu.** Galvenā darbība sāk jaunu sesiju; nesaglabātu darbu aizsargā esošais apstiprinājums. Sākumlapas sadaļa **Turpināt iesākto** rāda trīs jaunākos reālos melnrakstus ar nosaukumu, attēlu, lapu skaitu un pēdējo izmaiņu laiku.
2. **Pievienošana.** Fotografēšana vai vairāku attēlu izvēle. Pēc sekmīga importa atveras lapu solis. Kamera un galerija izmanto iepriekšējo failu importu un tā ierobežojumus.
3. **Lapas.** Priekšskatījums, secība un vienkāršs redaktors ar pagriešanu. **Visas lapas ir viens dokuments** izveido grupu bez atsevišķas lapu atlases. **Sadalīt vairākos dokumentos** ļauj attēlos atzīmēt sākuma vietas. Izveidotās grupas redzamas ar lapu priekšskatījumiem. Jau esošu atšķirīgu grupu apvienošana prasa skaidru apstiprinājumu.
4. **Informācija.** Viena **Atpazīt dokumentu** darbība izmanto aktuālo lapu tekstu, atpazīst tikai trūkstošu vai novecojušu OCR, tad palaiž esošos lokālos teksta noteikumus un saglabā sesiju. Ieteikumi paliek atsevišķi no manuālajām vērtībām; **Izmantot** pieņem vienu ieteikumu. Lietotājs drīkst arī visu ievadīt pats. Summai pieļauj komatu un, atstājot lauku, normalizē esošajam datu formātam.
5. **Apstiprināt un turpināt** saglabā pārbaudīto vērtību momentuzņēmumu un atver nākamo nepārbaudīto dokumentu vai PDF soli. **Turpināt bez rekvizītu lapas** ļauj izlaist atpazīšanu un apstiprināšanu.
6. **PDF.** Redzams nosaukums, veids, lapu skaits un rekvizītu statuss. Apstiprinātam dokumentam **Izveidot PDF** automātiski sagatavo priekšskatījumu. Nepārbaudītam dokumentam redzamas divas izpildāmas izvēles: **Pārbaudīt informāciju** un **Saglabāt tikai skenētās lapas**. Rezultāta dialogā galvenā darbība ir **Lejupielādēt PDF**. Kvalitāte, A4/attēla formāts un informācijas lapas izvēle ir izvēršami.

Soļi rāda reālu stāvokli: vai ir lapas, vai visas ir piesaistītas un vai visu dokumentu apstiprinājumi vēl atbilst datiem. Iespējams atgriezties un atkārtoti atvērt sasniedzamos soļus. Pāreja fokusē jaunā soļa virsrakstu; soļu pogas un galvenās darbības izmantojamas ar tastatūru.

### Saglabātās iespējas

- Oriģinālo un apstrādāto attēlu glabāšana, perspektīvas korekcija, automātisko stūru kandidāti, manuāli stūri, filtri, pagriešana un oriģināla atjaunošana. Ātrais redaktors sāk ar vienkāršu skatu; **Papildu darbības** atver stūrus un filtrus. Iepriekšējā lapas izvēlne var atvērt pilno redaktoru uzreiz.
- Lapu aizstāšana, dzēšana, secība; grupu manuāla izveide, lapu pārvietošana, sadalīšana, apvienošana un grupas dzēšana, saglabājot lapas. Tukšas grupas paliek rediģējamas papildu grupēšanas rīkos.
- LV/EN/RU OCR, valodu izvēle, pilns un labojams teksts, sākotnējā teksta saglabāšana, atsevišķas lapas atkārtošana, sesijas teksta apvienotais skats, progress, atcelšana, kļūdu paziņojumi un bezsaistes resursu sagatavošana.
- Tipam raksturīgie un lietotāja papildu atribūti, avotu fragmenti, analīzes brīdinājumi un pēdējā apstiprinājuma vērtības. Neaktuālus ieteikumus nevar pieņemt; manuālās vērtības un apstiprinājumu vēsture saglabājas.
- PDF ģenerēšanas dzinējs, pilnie attēli, Unicode informācijas teksts, proporcijas, kvalitātes iestatījumi, lejupielāde, atvēršana citā cilnē, atcelšana un revīziju/integritātes pārbaudes.
- PWA, galvenā navigācija, gaišais/tumšais režīms un iepriekšējie importa/atmiņas ierobežojumi. Jaunu atkarību, ārēja MI, servera un MongoDB nav.

### Dati un saglabāšana

`drafts`, `pages` un `images` krātuves un IndexedDB versija **1** saglabājas. Dokumentu grupēšanas `schemaVersion: 2` netiek mainīta. Jauns ir tikai neobligāts melnraksta `workflow: { step, documentId }` lauks, kuru ieraksta esošajā atomārajā transakcijā. Navigācijas metadati nesatur attēlus vai OCR kopijas.

Vecajiem melnrakstiem soli nosaka no lapām, grupām un aktuālajiem apstiprinājumiem: bez lapām — pievienošana; ar nepiesaistītām lapām — lapas; ar grupējumu — informācija; ar pārbaudītu informāciju — PDF. Norādīto soli ierobežo līdz sasniedzamajam, bet vairs neesoša dokumenta atlases vietā izvēlas pirmo pieejamo. Iepriekšējā grupēšanas migrācija joprojām atver vecās nepiesaistītās lapas un saglabā sākotnējo/laboto OCR.

Saglabāšana notiek secīgi pie soļu pārejām, apstiprinājuma un atpazīšanas; OCR arī pēc katras lapas. Paliek skaidra **Saglabāt melnrakstu** darbība. Importam vai atsevišķam lauka/grupējuma labojumam, paliekot tajā pašā solī, nav fona taimera: redzams **Nesaglabāts**. Paziņojums **Saglabāts** parādās tikai pēc transakcijas pabeigšanas. **Saglabā…** attiecas tieši uz saglabāšanas operāciju. Neveiksme atstāj darbu atmiņā, bloķē pāreju un piedāvā **Mēģināt saglabāt vēlreiz**. Esošā revīziju pārbaude aizsargā pret citas cilnes izmaiņu pārrakstīšanu.

Sadaļa **Dokumenti** nošķir iesāktas un sagrupētas sesijas. Grupētas sesijas statuss nenozīmē rekvizītu apstiprinājumu vai arhivētu PDF. Lejupielādētie PDF paliek lietotāja izvēlētajā lejupielāžu vietā; tie netiek glabāti lietotnes arhīvā vai PWA kešā.

### Automatizētās pārbaudes

`frontend/tests/workflow.spec.js` iziet visus piecus pieprasītos scenārijus un saglabāšanas kļūmi:

| Scenārijs          | Reālā pārbaude                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — viens rēķins   | Sākumlapa, divi sintētiski attēli, otrās lapas pagriešana, īsts Tesseract OCR, ieteikumu pieņemšana, summa/saņēmējs, apstiprinājums, PDF lejupielāde un neatkarīga satura nolasīšana ar PDF.js |
| B — trīs dokumenti | Sešas lapas, sākuma vietas pie 3. un 5. lapas, atšķirīgi manuāli rekvizīti, trīs PDF un katra dokumenta teksta/attēlu piederības pārbaude                                                      |
| C — turpināšana    | Saglabāta sesija, jauna pārlūka cilne, turpināšana no sākumlapas, pareizais solis un manuālās vērtības pēc iepriekšējo soļu atvēršanas; galvenās darbības ar tastatūru                         |
| D — OCR kļūda      | Kontrolēti nepieejams īstā dzinēja valodas modelis, kļūdas statuss, manuāli rekvizīti un apstiprināts informācijas PDF                                                                         |
| E — bez OCR        | Vienas lapas PDF bez rekvizītu apstiprināšanas; neviena valodas modeļa pieprasījuma                                                                                                            |
| Saglabāšanas kļūme | Kvotas kļūda pie pārejas, nav nepatiesa veiksmes paziņojuma vai pazaudētu attēlu; īsta atkārtota transakcija                                                                                   |

Papildu vienību testi pārbauda veco/jauno plūsmas stāvokli, ātro grupēšanu, grupu izolāciju, aktuālā OCR atkārtotu izmantošanu, secīgu atpazīšanu/analīzi un atcelšanu. Iepriekšējie Playwright testi izmanto jauno navigāciju un reāli atver papildu sadaļas; saglabātas pārbaudes attēlu apstrādei, LV/EN/RU OCR, grupēšanai, kļūdām, revīzijām, bezsaistei, PDF saturam un resursu atbrīvošanai.

Gaišā/tumšā režīma pārbaudēs izmanto axe WCAG AA analīzi un pārbauda horizontālu pārpildi. Playwright projekti: **360 × 800**, **412 × 915**, **1440 × 1000**; pārlūks — instalētais Google Chrome. Sintētiskie attēli rodas testu atmiņā; reāli dokumenti nav izmantoti.

Faktiski izpildīts **2026-11-12**, Windows vidē ar Google Chrome:

| Komanda `frontend/` mapē   | Rezultāts                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run build`        | Sekmīgs produkcijas būvējums un PWA ģenerēšana; lokālo OCR modeļu kontrolsummas pārbaudītas                   |
| `npm.cmd run test:unit`    | **54/54** izturēti                                                                                            |
| `npm.cmd run test:e2e`     | **180/180** izturēti vienā pilnā ciklā, pa 60 katrā platumā; Playwright rezultāts `passed`, `failedTests: []` |
| `npm.cmd run format:check` | Sekmīgi; papildus pārbaudīts README un šīs dokumentācijas formatējums                                         |

Gala cikls ilga 6,7 minūtes, ieskaitot šīs Windows izpildes vides testa servera aizvēršanas gaidīšanu. Pēc visu 180 testu pabeigšanas tika apturēts tikai konkrētā Playwright palaistā Vite priekšskatījuma process; lietotnes izstrādes serveris netika apturēts. Testu stāvoklis un pārskats apstiprina visu gadījumu sekmīgu izpildi. Windows fontconfig keša brīdinājumi sintētisko attēlu ģenerēšanā testus neapturēja.

Papildus atsevišķi atkārtots saglabāšanas kļūmes/pārejas tests desktop skatā: **1/1** izturēts, pārbaudītais Playwright procesa atgriešanās kods **0**. Šai pārbaudei izmantota atsevišķa rezultātu apakšmape un tikai teksta reportieris, saglabājot pilnā 180 testu cikla HTML pārskatu un ekrānattēlus.

Pilnā cikla HTML pārskats ir `frontend/playwright-report/index.html`; ekrānattēli un OCR kvalitātes pielikumi — `frontend/test-results/`. Jaunie ekrānattēli ietver informācijas formu tumšajā režīmā, dokumentu robežu atlasi un PDF gala soli visos trīs platumos. Tie ir lokāli ģenerēti testa artefakti. Testēšanas un implementācijas laikā Git komandas netika izpildītas.

### Manuāla pārbaude VS Code pārlūkprogrammā

1. VS Code atveriet projekta mapi un terminālī izpildiet `cd frontend`, tad `npm.cmd run dev`. Ja atkarību nav, pirms tam izpildiet `npm.cmd ci`. Pirmajai OCR modeļu sagatavošanai vajadzīgs internets.
2. Atveriet terminālī parādīto adresi (parasti `http://localhost:5173`) ar **Simple Browser: Show**. Ja iegultais pārlūks neatbalsta lejupielādi vai PDF skatītāju, atveriet to pašu adresi parastajā Chrome/Edge cilnē. Produkcijas un bezsaistes pārbaudei lietojiet `npm.cmd run build`, `npm.cmd run preview` un `http://localhost:4173`.
3. Spiediet **Skenēt dokumentu**, izvēlieties divus sintētiska dokumenta attēlus un pārbaudiet lapu secību. Ar **Rediģēt skenējumu** pagrieziet vienu lapu un apstipriniet. **Papildu darbības** ļauj apskatīt stūru korekciju un filtrus.
4. Spiediet **Visas lapas ir viens dokuments**, tad **Atpazīt dokumentu**. Pieņemiet vajadzīgos ieteikumus ar **Izmantot**, izlabojiet saņēmēju/summu un spiediet **Apstiprināt un turpināt**. Pārbaudiet saglabāšanas statusu, tad izveidojiet, apskatiet un lejupielādējiet PDF.
5. Ar sešiem attēliem izmēģiniet **Sadalīt vairākos dokumentos**, atzīmējot jauna dokumenta sākumu pie 3. un 5. lapas. Apstipriniet katra dokumenta atšķirīgus datus un eksportējiet tos pa vienam. Papildu grupēšanas sadaļās pārbaudiet pārvietošanu, sadalīšanu un apvienošanu.
6. Izmainiet rekvizītus, spiediet **Saglabāt melnrakstu**, pārlādējiet lietotni un turpiniet darbu no sākumlapas. Pārbaudiet iepriekšējos soļus un abas tēmas. Citai sesijai izlaidiet atpazīšanu un izvēlieties **Saglabāt tikai skenētās lapas**.
7. Pārslēdziet DevTools ierīces platumu uz 360 un 412 px, pēc tam desktop. Izmantojiet Tab, Shift+Tab un Enter soļu un galveno darbību pārbaudei. Fiziskā telefonā atsevišķi pārbaudiet kameras izvēli, ekrāna tastatūru un faila saglabāšanu.

### Robežas

Automatizētās pārlūka pārbaudes neaizstāj pirmreizēju lietotāju novērošanu vai fiziska Android tālruņa pārbaudi. Šajā uzdevumā nav būvēts APK, lietota reāla kamera vai pārbaudīta Android native failu saglabāšana. Īpaši vāji attēli joprojām var dot kļūdainu OCR; lokālie rekvizītu noteikumi nav MI un neaptver visus dokumentu izkārtojumus. Skenētajām PDF lapām nav OCR teksta slāņa; meklējams ir apstiprinātās informācijas teksts. Melnraksti paliek konkrētā pārlūka profilā un var pazust, dzēšot tā datus.
