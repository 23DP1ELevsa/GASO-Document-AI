# 5. posms — dokumentu grupēšana un informācijas kartītes

## Realizācija

Vienā sesijā var izveidot vairākus dokumentus ar unikāliem UUID. Dokumentu lapu saraksti satur atsauces uz kopīgajiem sesijas lapu ierakstiem; nav attēlu kopiju katrai grupai. Lapas ārpus grupām vienmēr redzamas nepiesaistīto lapu sarakstā. Modelis validē, ka lapa ir reāla sesijas lapa un nepieder vairākām grupām.

Jauns dokuments saņem tukšus atribūtus. Pārvietošana saglabā atlasīto lapu secību, sadalīšana saglabā sākotnējā dokumenta relatīvo secību. Apvienošana pievieno avota lapas mērķa beigās un saglabā tikai mērķa atribūtus; dialogs skaidri brīdina par avota kartītes dzēšanu. Grupas dzēšana saglabā visas lapas un OCR, pārceļot tās uz nepiesaistīto sarakstu. Sesijas priekšskatījumu secība un katra dokumenta secība ir neatkarīgas. Aizstāts foto saņem jaunu lapas ID tajā pašā grupas pozīcijā.

Komponentes `DocumentGroups.vue` un `DocumentInformation.vue` izmanto esošo Vuetify paleti, gaišo/tumšo režīmu, Blob priekšskatījumus un latviešu lokalizāciju. Telefonā tabulas rindas izkārtojas vertikāli. Ievades un atlases pieejamas ar tastatūru; pārvietošanai nav vajadzīga vilkšana.

## Datu struktūra

IndexedDB `gaso-document-ai` joprojām izmanto datubāzes versiju 1 un krātuves `drafts`, `pages`, `images`. Paplašināti ierakstu lauki, bez destruktīvas migrācijas.

```text
drafts[id]
  schemaVersion: 2
  pageIds: visas sesijas lapas sesijas secībā
  documents[]
    id, sessionId, createdAt, updatedAt
    pageIds[]: dokumenta lapas dokumenta secībā
    values: lietotāja rediģētās standartizētās vērtības
    customFields[]: { key, label }
    analysis: null | { analyzedAt, source, result }
    confirmation: null | { confirmedAt, source, values }
```

`values.document_type` un `values.document_title` ir dokumenta tips un nosaukums. Kopīgo lauku/tipu reģistrs atrodas `features/documents/catalog.js`; atslēgas saskaņotas ar prasību katalogiem. Tukši lauki ir `null`, nenoteikts tips ir `unknown`. Lietotāja papildu atribūtam piešķir unikālu `custom_…` atslēgu, atsevišķi glabājot latvisko nosaukumu. Pašreizējā saskarne ievada skalāras teksta vērtības; strukturētus pušu/preču masīvus var pievienot nākamajā posmā. Nauda ir decimālvirkne ar divām zīmēm; dokumenta numuri saglabā sākuma nulles.

Vecs melnraksts bez grupējuma atveras ar `documents: []`; lapu masīvs, oriģināli, apstrādātie attēli un OCR netiek mainīti. Formāta versija 2 tiek ierakstīta nākamajā saglabāšanā. Eksistējošā revīzijas pārbaude un visu trīs krātuvju transakcija saglabājas. Kvotas kļūme atceļ visus ierakstus, atstājot labojumus atmiņā atkārtotam mēģinājumam.

## Lokālā analīze

`features/documents/analysis.js` ir neatkarīgs sinhrons lokālu noteikumu sniedzējs: saņem tikai sakārtotas lapas ar OCR tekstu. Tas neizmanto failu nosaukumus, uzņēmumu sarakstus, fiksētas koordinātas, tīklu vai MI. Esošais Python eksperiments paliek atsevišķs.

Pārlūka rezultāts ir `{ version, provider: 'local_rules', document_type, attributes, evidence, requires_review: true, warnings }`. Atribūtu atslēgas un normalizēšanas noteikumi atbilst prasību katalogam. `evidence` glabā `pageId`, lapas numuru dokumentā (no 1) un precīzu OCR rindas fragmentu. Esošais pārlūka OCR nesaglabā vārdu/rindu koordinātas, tāpēc tās netiek izdomātas. Šis iekšējais rezultāts nav pilnais CLI `document-analysis.schema.json` transporta formāts ar obligātajām koordinātām un lapu rastra metadatiem. Nākotnes adapterim vajadzīgs skaidrs šo formātu pārveidotājs.

Atpazīst ierobežotu pilnas rindas apzīmējumu kopu LV/EN/RU un vērtību tajā pašā rindā, piemēram, `Rēķina Nr.`, `Invoice Number`, `Invoice No.`, `Номер счёта` → `invoice_number`; rēķinam arī `document_number`. Dokumenta tipam vajadzīgs skaidrs virsraksts un atbilstošs numurs vai cits atbalstošs atribūts. Pretrunīgi tipi dod `unknown`. Nosūtītāju/saņēmēju nosaka tikai no nosauktām lomām. Nevienu brīvi atrastu uzņēmumu vai lielāko skaitli neuzskata par pareizo vērtību.

Atsevišķi lauki ir `subtotal_amount`, `tax_amount`, `total_amount`, `invoice_gross_amount`, `paid_amount`, `balance_due`. `Amount due` konservatīvi dod tikai `balance_due`; `Summa ar PVN` dod tikai `invoice_gross_amount`. Dokumentā skaidri apzīmētu `Grand total` / `Kopā apmaksai` glabā `total_amount`. Vienas atslēgas pretrunīgi kandidāti, arī skaidrs kandidāts kopā ar nesalasāmu kandidātu, dod `null` un pārbaudes brīdinājumu. Datumiem pieņem ISO un nepārprotamu `DD.MM.YYYY`, pārbaudot kalendāru; `03/04/2026` paliek `null`. Summām pieņem pilnas tūkstošu grupas un nepārprotamas divas decimālzīmes. `$` bez konteksta nenosaka valūtu.

Ierobežojumi: nav dokumenta semantiskas izpratnes, vairāku rindu lauku sasaistes, tabulu nolasīšanas, aritmētikas, valodas noteikšanas vai nekļūdīgas klasifikācijas. Atbalstīto valūtu apzīmējumu saraksts ir ierobežots. Manuāli var izvēlēties visus katalogā reģistrētos tipus un aizpildīt trūkstošos laukus. Ja OCR ir no iepriekšējās attēla versijas, attiecīgās lapas tekstu jaunai analīzei izlaiž un rāda brīdinājumu.

`suggestBoundaries` ir atsevišķa ieteikumu funkcija nākotnes grupēšanas adapterim. Saskarne piedāvā pārskatīt rēķinu robežas tikai tad, ja lapas pirmajās četrās netukšajās rindās ir skaidrs virsraksts un mainās iepriekšējais skaidri nolasītais numurs. Tas pats numurs vai viens virsraksts nerada sadalījumu. Noraidīts dialogs neko nemaina; apstiprināts sadalījums izmanto parasto manuālās grupēšanas modeli. Atsauces uz citiem rēķiniem vai neparasts izkārtojums joprojām var radīt kļūdainu ieteikumu.

## Pārbaude, apstiprinājums un aktualitāte

Ieteikumi nekad automātiski neaizpilda lietotāja laukus. Lietotājs izvēlas **Izmantot** konkrētam laukam vai ievada vērtību pats, tad spiež **Apstiprināt informāciju**. Apstiprinājums ir atsevišķs vērtību un avota momentuzņēmums; `requires_review` analīzes rezultātā nemaina. Atkārtota analīze atjaunina tikai ieteikumus. Manuālas summas, datumi un valūtas tiek validētas pirms apstiprināšanas.

Avota versiju veido precīzs sakārtoto lapu ID, attēlu apstrādes versiju, izmaiņu revīziju un OCR teksta/laiku momentuzņēmums. Teksts tiek salīdzināts precīzi, bez kontrolsummu sadursmju riska; lieliem OCR rezultātiem tas palielina metadatu apjomu. Lapu pievienošana, izņemšana, secības maiņa, attēla aizstāšana/apstrāde, teksta labojumi un atkārtots OCR atzīmē analīzi kā novecojušu un iepriekšējo apstiprinājumu kā neatbilstošu pašreizējam avotam. Cita dokumenta izmaiņas to neietekmē. Manuālās vērtības un pēdējais apstiprinājums netiek dzēsti. Jauns apstiprinājums aizstāj pēdējo; pilna auditācijas vēsture šajā posmā nav ieviesta.

Grupējums un kartītes tiek ierakstītas ar **Saglabāt melnrakstu**; veiksmīga OCR darbība arī turpina saglabāt visu sesiju. Saglabāšanas kļūme ir redzama, un dati paliek atmiņā. Bez saglabāšanas pārlāde atjauno iepriekš saglabāto versiju.

## PDF sagatavošana

`documentExportPlan(session, documentId)` atdod informācijas lapas vērtības un papildu lauku nosaukumus, apstiprinājuma aktualitāti un sakārtotus `{ pageId, imageRecordId }`. Nākamā posma PDF adapteris nolasīs oriģinālo/apstrādāto attēlu no kopīgās `images` krātuves. Tam jāģenerē informācijas lapa un fotografētās lapas pareizajā secībā. Attēlus nedrīkst aizstāt tikai ar OCR tekstu. Šeit netiek ģenerēti PDF, APK vai servera izvietojumi.

## Pārbaudes

Pārbaudes veiktas 2026-11-12 ar Node.js 22.14.0 un instalēto Google Chrome. Tikai sintētiski attēli un OCR; jaunie semantikas testi ievieto noteiktu OCR tekstu izolētā IndexedDB, atsevišķi no iepriekšējā posma īstā Tesseract regresijas testiem.

- `npm.cmd run build` — izpildīts sekmīgi; OCR modeļu kontrolsummas pārbaudītas.
- `npm.cmd run test:unit` — 34/34 sekmīgi, tostarp 16 jauni dokumentu modeļa/analīzes testi.
- `npm.cmd run test:e2e -- tests/documents.spec.js` — 18/18 sekmīgi trīs izmēros: 360, 412 un 1440 px.
- `npm.cmd run format:check` — izpildīts sekmīgi. Esošo 60 failu CRLF rindu beigas normalizētas uz `.editorconfig` noteikto LF; tiem citu formatējuma neatbilstību nebija.
- `npm.cmd run test:e2e` — galīgajā pilnajā palaišanā 135/135 sekmīgi (4,8 minūtes), ietverot 18 jaunos scenārijus un visu iepriekšējo skenēšanas, redaktora un īstā OCR regresiju.

Pirmajā pilnajā palaišanā izturēti 134/135; esošais tastatūras tests vienreiz nospieda Tab pirms sākotnējā Vue skata ielādes. Testā pievienota skata gatavības pārbaude pirms tastatūras darbībām, pēc tam viss komplekts izpildīts atkārtoti. Papildus salabota atstarpju saglabāšana, ievadot dokumenta laukus pa vienai rakstzīmei; to pārbauda gan vienību, gan pārlūka tests. Pēc visu scenāriju izpildes Windows priekšskatījuma process apturēts, lai testu palaišanas process pabeigtu atskaites sagatavošanu; galīgās palaišanas izejas kods ir 0. Fontconfig paziņoja par nepieejamu lietotāja keša direktoriju, taču attēlu ģenerēšanas un OCR testi izturēti.

Jaunie testi aptver izveidi, piederības un secības saglabāšanu, pārvietošanu, sadalīšanu/apvienošanu, grupas drošu dzēšanu, attēlu un OCR saglabāšanu, manuālus/papildu atribūtus, apstiprinājuma atjaunošanu, novecojušu analīzi pēc OCR labojuma un foto aizstāšanas, vecā melnraksta migrāciju, citas kartītes datu izolāciju, saglabāšanas kļūmes atomaritāti, robežu ieteikumu apstiprinājumu un atteikumu. Abos režīmos pārbauda horizontālo pārplūdi un axe WCAG A/AA kļūdas. Vienību testi papildus aptver dažādus LV/EN/RU izkārtojumus, summu nozīmju nošķiršanu, neskaidrus kandidātus, datumu/summu normalizāciju, visas avota izmaiņu kategorijas un PDF datu plānu.

Pārlūka ekrānattēli un atskaites ir `frontend/test-results/` un `frontend/playwright-report/`. Fiziskā tālrunī, Android APK un ar reāliem konfidenciāliem dokumentiem pārbaudes nav veiktas.

## Atkārtojama manuālā pārbaude

1. Importēt vairākus atļautus attēlus, atzīmēt daļu nepiesaistīto lapu un izveidot divus dokumentus. Pārvietot vienu lapu, mainīt dokumenta secību, sadalīt un apvienot grupas. Dzēst vienu grupu un pārliecināties, ka tās lapas joprojām ir nepiesaistītas.
2. Veikt OCR un **Analizēt lokāli**. Pārbaudīt katru ieteikumu pret attēlu un avota fragmentu; izmantot tikai pārbaudītos ieteikumus, pārējos laukus aizpildīt manuāli. Pievienot savu atribūtu un apstiprināt informāciju.
3. Saglabāt melnrakstu un pārlādēt lapu. Pārbaudīt lapu secību, atribūtus, papildu lauka nosaukumu un apstiprinājuma laiku. Otrā dokumentā nedrīkst parādīties pirmā dokumenta nosūtītājs vai summa.
4. Labot OCR vai aizstāt attēlu. Sagaidīt aktualitātes brīdinājumu, atkārtot analīzi un pārliecināties, ka manuālā vērtība nav pārrakstīta. Atkārtoti pārbaudīt, apstiprināt un saglabāt.
5. Atkārtot telefonā gaišajā un tumšajā režīmā, pārbaudot ievadi un lapu pārvietošanu. Tas ir manuālās pārbaudes kontrolsaraksts; fiziska tālruņa pārbaude šajā izstrādes sesijā nav veikta.
