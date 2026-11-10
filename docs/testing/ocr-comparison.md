# OCR, attēlu un PDF bibliotēku izvērtējums — #06

Pārbaudīts 2026-11-10. Zemāk atdalīti oficiālās dokumentācijas solījumi un faktiski izpildītie testi. Izvēle ir provizoriska; reālu dokumentu pilnu manuālo etalonu vēl nav.

## OCR kandidāti

| Risinājums un versija | LV / EN / RU | Struktūra, tabulas un lasīšanas secība | Resursi, instalācija un integrācija | Licence un ierobežojumi |
| --- | --- | --- | --- | --- |
| Tesseract: izmēģināts 5.5.3; upstream izpētīts 5.5.4 | `lav`, `eng`, `rus` valodu dati | TSV vārdi, robežas un novērtējumi; lapas segmentācija; tabulas netiek pārvērstas semantiskās šūnās | CPU, atsevišķs izpildfails un valodu dati; Laravel var palaist izolētā rindas procesā; pēc instalācijas bez interneta | Apache-2.0 dzinējam; distributīva atkarībām savas licences. Testā pieejamais conda-forge būvējums 5.5.3 nav produkcijas versijas izvēle |
| PaddleOCR: izpētīts 3.7.0; adaptera profils PP-OCRv5 | LV — latīņu modelis; EN un RU atbilstoši izvēlētajam modelim; jaukts LV/RU jāpārbauda atsevišķi | Teksta detekcija un atpazīšana, poligoni/novērtējumi; tabulu analīzei atsevišķs PP-Structure risinājums | CPU vai GPU atkarībā no runtime; Python/PaddlePaddle un iepriekš sagatavoti modeļi; smagāka instalācija nekā Tesseract | Apache-2.0 kodam; pārbaudīt izvēlētos svarus/atkarības. Šajā Python vidē PaddlePaddle instalācijas priekšnoteikums neizpildās |
| Docling: izpētīts 2.149.0 | Atkarīgs no OCR dzinēja un modeļa; Tesseract backend var izmantot `lav+eng+rus` | Dokumenta struktūra, lasīšanas secība un tabulas; nav universāls rēķinu atribūtu risinājums | Python un struktūras modeļi; CPU iespējams, GPU izvēle atkarīga no modeļiem; Laravel pieslēgums caur procesu vēlāk | MIT pamatkodam; modeļu un OCR atkarību licences atsevišķi. Šeit nav instalēts vai palaists |

Tesseract valodas pārbaudītas [oficiālajā valodu katalogā](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html); versijas un 5.5.4 labojumi — [izlaidumos](https://github.com/tesseract-ocr/tesseract/releases), dzinēja licence — [repozitorijā](https://github.com/tesseract-ocr/tesseract). Nākamajai videi jāizmanto aktualizēts būvējums un vēlreiz jāveic testi.

PaddleOCR 3.7.0 piedāvā arī PP-OCRv6, taču šo modeļu rezultāti nav mērīti. PP-OCRv5 izvēle adapterī padara paredzēto modeļu profilu skaidru; tā nav rekomendācija, ka tas pārspēj jaunāko modeli. LV un RU profili aprakstīti [oficiālajā daudzvalodu katalogā](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.en.md), API — [OCR pamācībā](https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/pipeline_usage/OCR.html), 3.7.0 — [izlaidumos](https://github.com/PaddlePaddle/PaddleOCR/releases), licence — [LICENSE](https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE).

Docling dzinēji ietver Tesseract CLI, TesserOCR, EasyOCR, RapidOCR, OcrMac un citus variantus; izvēle nenozīmē vienādu valodu kvalitāti. Offline darbībai iepriekš jāielādē struktūras un OCR modeļi, jānorāda lokālais artifacts ceļš un jāatstāj ārējie servisi izslēgti. Avoti: [OCR dzinēji](https://docling-project.github.io/docling/concepts/OCR/), [offline opcijas](https://docling-project.github.io/docling/usage/advanced_options/), [2.149.0 izlaidums](https://github.com/docling-project/docling/releases/tag/v2.149.0), [MIT licence](https://github.com/docling-project/docling/blob/main/LICENSE). Jaunus modeļus drīkst izmantot tikai pēc to atsevišķas izvērtēšanas.

## Attēli un PDF

| Risinājums / izpētītā versija | Pielietojums un integrācija | Licence / praktiskais ierobežojums | Faktiski palaists |
| --- | --- | --- | --- |
| OpenCV 5.1.0 / 4.14.0 izlaidumu līnijas | Kontūras, perspektīva, kontrasts, slīpuma korekcija; Python process vai cits backend pieslēgums | Apache-2.0 jaunajām versijām; CPU, izvēles paātrinājumi; pats neatpazīst rēķina laukus | Nē; šajā posmā nav vajadzīgs instalēt tikai nākotnei |
| PHP GD; libgd 2.3.3 | Vienkārša mērogošana, pagriešana, sīktēli tieši Laravel/PHP | PHP paplašinājuma un libgd licences; nav OCR un automātiskas dokumenta perspektīvas analīzes | Nē |
| Imagick 3.8.1 + atsevišķs ImageMagick | Plašāka attēlu apstrāde PHP vidē; nepieciešami atbilstoši PHP binārie paplašinājumi | Imagick PHP-3.01, ImageMagick sava licence; delegātiem citas licences un resursu/policy iestatījumi | Nē |
| Pillow 13.0.0 | Prototipa attēlu dekodēšana, EXIF un pagriešana | MIT-CMU pakotnes metadatos, papildatkarībām savi nosacījumi; nav OCR | Jā |
| pypdfium2 5.15.2 | PDF rastrēšana un teksta slāņa izpēte; Python CLI ievadei | Apache-2.0/BSD-3-Clause saistījumiem, PDFium un iekļautajām atkarībām atsevišķi paziņojumi | Jā, 11 PDF |
| FPDF 1.9.0 | Viegls PHP risinājums attēlu izvietošanai vairāku lapu PDF; perspektīvs arhīva PDF kandidāts | Atļaujoša FPDF licence; teksta Unicode/fontu prasības jāizvērtē, ja pievienos tekstu | Nē; PDF izveide atlikta |
| Dompdf 3.1.6 | HTML/CSS → PDF tieši PHP; piemērots atskaitēm | LGPL-2.1; fonti, CSS un atmiņa; arhīva lapas jāveido no oriģinālajiem attēliem | Nē |
| OCRmyPDF 17.14.1 dokumentācija | Esošam PDF pievieno meklējamu OCR slāni; nav atribūtu ekstraktors | MPL-2.0 pamatkodam, Tesseract un citu izmantoto komponentu licences atsevišķi; instalācijas komplekts atkarīgs no platformas | Nē; lietderīgs vēlāk, ja vajag meklējamu arhīva PDF |

Attēlu avoti: [OpenCV izlaidumi](https://github.com/opencv/opencv/releases) un [licence](https://opencv.org/license/), [PHP GD](https://www.php.net/manual/en/book.image.php), [libgd](https://libgd.github.io/), [Imagick izlaidumi](https://github.com/Imagick/imagick/releases) un [licence](https://github.com/Imagick/imagick/blob/master/LICENSE), [ImageMagick licence](https://imagemagick.org/license/). Pillow un pypdfium2 versijas papildus fiksētas faktiskās lokālās vides pakotņu metadatos; pypdfium2 licences apraksta [oficiālais README](https://github.com/pypdfium2-team/pypdfium2/blob/main/README.md).

PDF avoti: [FPDF versijas](https://github.com/Setasign/FPDF/tags) un [licence](https://github.com/Setasign/FPDF/blob/master/license.txt), [Dompdf izlaidumi](https://github.com/dompdf/dompdf/releases) un [Composer metadati](https://github.com/dompdf/dompdf/blob/master/composer.json), [OCRmyPDF instalācija](https://ocrmypdf.readthedocs.io/en/latest/installation.html) un [MPL licence](https://github.com/ocrmypdf/OCRmyPDF/blob/main/LICENSE). Šis ir tehnisks licences uzskaitījums; GASO vēl jāapstiprina konkrētais distributīvs un darbības vide. Projekta paša MIT licence paliek spēkā.

## Faktiskais mērījums

Windows x64, Python 3.14.5, Tesseract 5.5.3, Pillow 13.0.0, pypdfium2 5.15.2. `lav+eng+rus`, PSM 3, PDF 300 DPI, CPU režīms, `OMP_THREAD_LIMIT=2`. Katram dokumentam viena secīga palaišana. Laiks ietver rastrēšanu, OCR un lokālo semantiku; dzinēja sākotnējā versijas/valodu pārbaude nav ieskaitīta. CPU slodze, aparatūras modelis, RAM maksimums un GPU izmantošana nav instrumentēti, tāpēc skaitļi ir provizoriski un nav servera jaudas plāns.

| ID | Lapas | Laiks, s | OCR teksta simboli | Ne-null lauki¹ |
| --- | --- | --- | --- | --- |
| D01 | 2 | 4.6831 | 4536 | 0 |
| D02 | 1 | 1.2449 | 1009 | 2 |
| D03 | 1 | 2.2075 | 1987 | 0 |
| D04 | 1 | 1.3811 | 948 | 4 |
| D05 | 1 | 1.2834 | 1040 | 0 |
| D06 | 2 | 3.6314 | 2638 | 0 |
| D07 | 1 | 1.6607 | 131 | 0 |
| D08 | 1 | 1.3480 | 784 | 1 |
| D09 | 1 | 2.5091 | 2919 | 0 |
| D10 | 1 | 1.0573 | 696 | 1 |
| D11 | 1 | 1.1526 | 883 | 2 |

¹ Skaits ir tikai diagnostika, nevis pareizo vērtību skaits. `invoice_number` un `document_number` var atspoguļot vienu vērtību. Kopsumma: **11 dokumenti, 13 lapas, 22.1591 s**. Pārskatot tekstu pret lapu attēliem, D07 ir acīmredzama teksta izlaišana; sīkie fonti un tabulas citos piemēros arī prasa manuālu salīdzināšanu. Netika sagatavota pilna transkripcija, tāpēc reālo dokumentu CER/WER un atribūtu precizitāte nav aprēķināta.

Lokālais tipa eksperiments tikai D04 noteica `invoice`; pārējiem 10 atgrieza `unknown`. Tas parāda ierobežoto pārklājumu. Patiesie tipi vēl nav manuāli anotēti visai kopai; šo attiecību nedrīkst saukt par klasifikācijas precizitāti. Dažādo piemēru [struktūru izpēte](test-dataset-plan.md) nav izmantota uzņēmumu noteikumu vai koordinātu veidņu veidošanai.

| Dzinējs | Izmēģinātie dokumenti | Teksta kvalitāte / laiks | Secinājums |
| --- | --- | --- | --- |
| Tesseract 5.5.3 | 11 PDF un 3 sintētiski LV/EN/RU attēli | PDF: teksts iegūts visiem, D07 būtiski nepilnīgs; 22.1591 s. Sintētikas rezultāti zemāk | Darbspējīgs lokāls sākumpunkts, nepietiek pilnai semantikai |
| PaddleOCR 3.7.0 | Neviens; pārbaudīta runtime instalēšanas iespēja | `pip install --dry-run --only-binary=:all: paddlepaddle` uz Python 3.14.5: `No matching distribution found`; kvalitāte/laiks nav izmērīti | Atkārtot izolētā saderīgā Python vidē; adapteris vēl nav validēts |
| Docling 2.149.0 | Neviens; dokumentācijas izpēte | Nav lokāli instalēts, nav struktūras modeļu; kvalitāte/laiks nav izmērīti | Nākamajā eksperimentā vērtēt tabulas/lasīšanas secību uz tās pašas kopas |

Sintētiskajos attēlos ir tikai izdomāti uzņēmumi/numuri. Ģeneratora teksts ir zināms etalons, Unicode NFC un atstarpes vienotas; reģistrs un pieturzīmes saglabāti.

| Piemērs | Etalona simboli | CER | WER | Apstrādes laiks, s |
| --- | --- | --- | --- | --- |
| LV | 226 | 0 | 0 | 0.4426 |
| EN | 200 | 0 | 0 | 0.3676 |
| RU | 207 | 0 | 0 | 0.4261 |

Šie ir viegli darbspējas testi, nevis pierādījums precizitātei ar reāliem rēķiniem. Papildu tukšā attēlā iegūts `no_text_detected`, nederīgā attēlā — kļūda un procesa kods 2. 90° sintētiskā attēlā OSD novērtējums nesasniedza slieksni: orientācija netika mainīta, atgriezts `orientation_uncertain`. Automātiska pagriešana nav garantēta.

## Ieteikums nākamajam posmam

Saglabāt kopējo rezultāta līgumu un lokālu CPU OCR kā bāzi. Vispirms anotēt atļautos dokumentus, papildināt kopu ar kameru fotogrāfijām un neredzētiem izdevējiem. Tad saderīgā izolētā vidē salīdzināt PaddleOCR un Docling, mērot arī RAM un lasīšanas secību. Tikai pēc šīs pārbaudes izvēlēties servera dzinēju; pašlaik nav pamata pasludināt uzvarētāju.

Laravel integrācijai sākt ar rindas procesu un validētu JSON, bez jauna mikroservisa. Semantikai vēlāk pieslēgt saskaņoto GASO API vai izvērtētu lokālu izpratnes modeli. PDF arhivēšanai sākumā izvērtēt FPDF attēlu lapas; OCRmyPDF pievienot tad, ja meklējams teksta slānis ir apstiprināta prasība. Palaišana un neizpildītie priekšnoteikumi ir [rīka instrukcijā](../../tools/ocr-evaluation/README.md).
