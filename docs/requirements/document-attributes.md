# Dokumentu atribūti un normalizācija — #05

Pārlūka 5. posmā ir realizētas rediģējamas atribūtu kartītes un atsevišķi lietotāja apstiprinājumi. Zemāk aprakstītais pilnais JSON Schema transporta formāts joprojām attiecas uz CLI prototipu. Pārlūka lokālais rezultāts izmanto tās pašas atribūtu atslēgas, bet glabā teksta fragmentu un lapas ID/numuru bez izdomātām koordinātām. [Pārlūka datu struktūra, apstiprināšana un analīzes robežas](../testing/document-grouping.md).

Mašīnlasāmais līgums ir [JSON Schema 2020-12](document-analysis.schema.json). Kopīgās atslēgas un tipa papildu lauki atrodas `attributes`; to kopa nav slēgta. Nezināma vērtība ir `null`. Trūkstoša tipam specifiska atslēga nozīmē “nav pieprasīta/nav piemērojama”; `null` — “nav droši noteikta”. Lietotāja apstiprinājums vēlāk būs atsevišķs notikums, nevis atpazīšanas atbildes `requires_review` pārslēgšana.

| Joma          | Atslēga                                                                       | Nozīme / tips                                                                                 |
| ------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Kopīga        | `document_type`, `language`                                                   | Rezultāta augšējā līmenī; tips un BCP 47 valodas kods vai `null`                              |
| Kopīga        | `document_number`                                                             | Dokumenta identifikators kā teksts, saglabājot sākuma nulles                                  |
| Kopīga        | `issue_date`                                                                  | Dokumenta izdošanas datums `YYYY-MM-DD`                                                       |
| Kopīga        | `sender`, `recipient`, `document_title`                                       | Nosūtītājs, saņēmējs un nosaukums                                                             |
| Rēķins        | `invoice_number`                                                              | “Rēķina Nr.”, “Invoice No.”, “Invoice Number”, “Номер счёта”; šim tipam arī `document_number` |
| Rēķins        | `sender`, `recipient`                                                         | Pārdevējs/izrakstītājs un pircējs; piegādes adresāts var būt atšķirīgs                        |
| Rēķins        | `due_date`                                                                    | Apmaksas termiņš; nav piegādes, izrakstīšanas vai rezervācijas datums                         |
| Rēķins        | `subtotal_amount`                                                             | Summa bez PVN                                                                                 |
| Rēķins        | `tax_amount`, `tax_breakdown`                                                 | PVN summa un pēc vajadzības likmju/summu masīvs                                               |
| Rēķins        | `total_amount`                                                                | Skaidri norādītā kopējā apmaksas summa; nenosaka pēc lielākā skaitļa                          |
| Rēķins        | `invoice_gross_amount`, `paid_amount`, `balance_due`                          | Papildu nošķīrums pilnajai summai, samaksātajam un atlikumam                                  |
| Rēķins        | `currency`                                                                    | ISO 4217 kods; `€` → `EUR`, `$` bez konteksta ir neskaidrs                                    |
| Rēķins        | `bank_account`                                                                | Teksts; tikai pēc nepieciešamības un datu apstrādes atļaujas saskaņošanas                     |
| Līgums        | `contract_number`, `parties`                                                  | Līguma numurs un pušu masīvs ar lomām                                                         |
| Līgums        | `conclusion_date`, `effective_date`, `expiry_date`                            | Noslēgšana, spēkā stāšanās, beigas — atsevišķi datumi                                         |
| Līgums        | `duration`, `subject`                                                         | Darbības termiņš un priekšmets; nenoteiktam termiņam tekstu saglabā                           |
| Iesniegums    | `application_date`, `applicant`, `recipient`, `subject`                       | Datums, iesniedzējs, adresāts un tēma                                                         |
| Apdrošināšana | `policy_number`, `insured_party`, `coverage_start`, `coverage_end`            | Polises numurs, apdrošinātais un seguma periods                                               |
| Pavadzīme     | `delivery_note_number`, `delivery_date`, `shipper`, `consignee`, `line_items` | Nodošanas numurs/datums, nosūtītājs, saņēmējs, preču pozīcijas                                |

Līgumu, iesniegumu un citu tipu pilnā semantika šajā prototipā nav realizēta. Papildu atribūti var būt JSON skalāri, masīvi un objekti. Naudas vērtības vienmēr saglabā kā decimālvirknes ar divām zīmēm, nevis binārus peldošā punkta skaitļus. Katalogu vēl jāapstiprina biznesa pārstāvim.

## Nenoteiktība un pierādījumi

`evidence.<attribute>` satur avota fragmentu, lapu (no 1) un `[x1,y1,x2,y2]` robežas. Koordinātas ir apstrādātā attēla pikseļos ar sākumu augšējā kreisajā stūrī; tās kalpo parādīšanai un kontekstam. EXIF/OSD pagriešana maina šo telpu; precīza transformācija atpakaļ uz kameras attēlu vēl jāievieš. Koordinātas nav rēķina veidne.

OCR vārda `confidence` ir dzinēja novērtējums diapazonā 0–1 vai `null`; tas nav kalibrēta atribūta pareizības varbūtība. Shēma pārbauda struktūru; īstus datumus papildus pārbauda normalizators. Paplašinātie lauki vēlāk jāvalidē pēc to kataloga.

ISO datumu pieņem tikai tad, ja kalendāra datums eksistē. Lokālais eksperiments papildus saprot `DD.MM.YYYY`; `03/04/2026` atstāj `null`, jo lokalizācija nav noteikta. Summām pieņem pilnas tūkstošu grupas un nepārprotamu decimāldaļu: `1 234,56`, `1,234.56`, `1.234,56` → `1234.56`; `1,234` paliek `null`. Parādu, priekšapmaksu, atlaidi, PVN un gala summu nedrīkst apvienot pēc vizuālas līdzības.

Ja vienai atslēgai ir dažādi kandidāti vai arī skaidrs un nesalasāms kandidāts, atgriež `null`, saglabā avotus un brīdinājumu. Summu aritmētika var radīt pārbaudes brīdinājumu, bet nedrīkst klusām aizstāt dokumentā redzamo summu. Šobrīd aritmētiskā pārbaude nav realizēta.

Lokālās semantikas robežas: atpazīst tikai dažus pilnas rindas apzīmējumus un vērtību tajā pašā rindā. Lauks citā rindā vai nezināms sinonīms paliek neatpazīts. Nav uzņēmumu nosaukumu, fiksētu lapas zonu vai piemēru failu nosaukumu noteikumu. Rindu/koordinātu maiņas testi pārbauda šo neatkarību, bet nepierāda vispārīgu semantisko izpratni.
