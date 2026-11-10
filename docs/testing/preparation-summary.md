# Tehniskās sagatavošanas pārskats

Datums: 2026-11-10. Sagatavots lokāls pamats #04–#06 darbiem, saglabājot esošās `backend/`, `frontend/`, `docs/` mapes un MIT licenci. Pilnā PWA, PDF izveide un MongoDB nav realizētas. Izmaiņas nav komitētas vai publicētas.

## Izveidotie un mainītie faili

| Faili | Rezultāts |
| --- | --- |
| `README.md`, `.gitignore` | Dokumentācijas saites, pašreizējais statuss un privāto OCR datu/izpildvides izņēmumi |
| `backend/.env.example` | Backend korporatīvā API konfigurācijas sagatave bez izdomātiem piekļuves parametriem |
| `docs/requirements/corporate-ai-api.md` | Jautājumi, integrācijas līgums, datu nosūtīšanas un piekļuves nosacījumi |
| `docs/requirements/document-types.md` | Paplašināms tipu katalogs, `other` un `unknown` nošķīrums |
| `docs/requirements/document-attributes.md` | Kopīgie un tipam specifiskie lauki, normalizācija un nenoteiktība |
| `docs/requirements/document-analysis.schema.json` | Vienota, paplašināma JSON rezultāta shēma |
| `docs/testing/test-dataset-plan.md` | Piemēru struktūras izpēte, atļauju robežas, etalonu un neatkarīgo testu plāns |
| `docs/testing/ocr-comparison.md` | Oficiālajos avotos pārbaudītas bibliotēkas un reāli lokālie mērījumi |
| `docs/diagrams/document-processing-architecture.md` | Apstrādes moduļi, divi režīmi un Laravel integrācijas robeža |
| `tools/ocr-evaluation/README.md`, `requirements.txt` | Palaišana, instalācija, versijas un neizpildītie priekšnoteikumi |
| `tools/ocr-evaluation/ocr_demo.py`, `engines.py`, `analysis.py` | Lokālais CLI, Tesseract, eksperimentāls Paddle adapteris un analīzes pakalpojumu interfeiss |
| `tools/ocr-evaluation/benchmark.py`, `generate_synthetic.py`, `evaluate_text.py` | Atkārtojami mērījumi, sintētiski attēli un CER/WER aprēķins |
| `tools/ocr-evaluation/tests/test_analysis.py` | Neatkarības, normalizācijas, nenoteiktības, shēmas un kļūdu testi |
| Šis pārskats | Paveiktais un turpmākais darbs |

Ignorētajā `tools/ocr-evaluation/private/` ir lokālie priekšskatījumi, failu atbilstības, pilnie OCR rezultāti un sintētika. `.local-runtime/` un `.venv/` ir lokālas atkarības; tās nav projekta publicējamais saturs. Oriģinālie PDF nav kopēti publicējamajās projekta mapēs un nav nosūtīti ārējiem OCR/MI servisiem.

## Faktiski pārbaudīts

Tesseract 5.5.3 ar `lav+eng+rus`, PSM 3 un PDF rastrēšanu 300 DPI apstrādāja **11 PDF / 13 lapas 22.1591 sekundēs**. Teksts iegūts visiem; vienā blīvā tabulā būtiski izlaidumi. Reāliem dokumentiem trūkst pārbaudītu etalonu, tāpēc nav aprēķināts precizitātes procents. Lokālais virsrakstu eksperiments tikai vienam dokumentam piešķīra `invoice`, pārējiem `unknown`; tas nav gatavs klasifikators.

Trīs vieglos sintētiskos LV/EN/RU piemēros CER un WER bija 0 pēc NFC/atstarpju normalizācijas. Tas apliecina darbspēju konkrētos piemēros, ne vispārinājumu. Astoņi automatizētie testi iziet. Vienpadsmit PDF un trīs sintētisko pamata piemēru rezultāti atbilst JSON shēmai. Tukša attēla un nederīga faila apstrāde pārbaudīta; 90° piemēram atgriezts `orientation_uncertain`, nevis garantēta korekcija.

PaddlePaddle instalācijas pārbaude ar Python 3.14.5 neatrada saderīgu bināro pakotni. PaddleOCR inference nav veikta, adapteris nav validēts. Docling ir izpētīts dokumentācijā; nav instalēts un nav izmēģināts. Tādēļ nav empīriska trīs dzinēju kvalitātes vai resursu salīdzinājuma. OpenCV, GD, Imagick un PDF izveides rīki šajā posmā ir izvērtēti dokumentācijā.

## Kā palaist

No projekta saknes PowerShell:

```powershell
$env:TESSDATA_PREFIX = (Resolve-Path '.local-runtime/ocr-runtime/share/tessdata').Path
$env:OMP_THREAD_LIMIT = '2'
& tools/ocr-evaluation/.venv/Scripts/python.exe tools/ocr-evaluation/generate_synthetic.py --font C:/Windows/Fonts/arial.ttf
& tools/ocr-evaluation/.venv/Scripts/python.exe tools/ocr-evaluation/ocr_demo.py tools/ocr-evaluation/private/synthetic/lv.png --tesseract .local-runtime/ocr-runtime/Library/bin/tesseract.exe --output tools/ocr-evaluation/private/result.json
```

Pilnā [palaišanas instrukcija](../../tools/ocr-evaluation/README.md) ietver jaunas vides uzstādīšanu, atļauta lokāla faila apstrādi, testus un Paddle/Docling turpmākos soļus.

## Statuss un nākamie soļi

| Kartīte | Paveikts | Kas vēl vajadzīgs |
| --- | --- | --- |
| #04 | Jautājumi, drošības/integrācijas līgums, lokāls/mock/slēgts korporatīvais providers, backend konfigurācija | Faktiska GASO specifikācija, piekļuve un apstiprināti datu apstrādes noteikumi; kartīte nav pilnībā pabeigta |
| #05 | Tipu un atribūtu katalogs, scenāriji, 11 piemēru struktūras izpēte un privātuma noteikumi | Biznesa apstiprinājums katalogam, manuāli anotēti etaloni un neatkarīga fotogrāfiju/testu kopa |
| #06 | Lokāli palaists OCR prototips, faktiskie Tesseract testi, bibliotēku izpēte un arhitektūra | Paddle/Docling palaišana saderīgā vidē, godīgs etalonu salīdzinājums un resursu mērījumi |

GASO speciālistam vēl jāatbild par pakalpojumu/modeli, PDF/attēlu un valodu atbalstu, autentifikāciju, ierobežojumiem, izmaksām, datu reģionu/glabāšanu/apmācību, pilnu attēlu nosūtīšanu un izstrādes vides tiesībām. [Jautājumu saraksts un pieslēgšanas secība](../requirements/corporate-ai-api.md) paredz īstu backend adapteri tikai pēc šo atbilžu un atļaujas saņemšanas. Automātiskas pārejas uz nesaskaņotu ārējo pakalpojumu nav.

Nākamajā posmā ieteicams anotēt pilotkopu, atjaunināt Tesseract būvējumu un salīdzināt papildu dzinējus uz neredzētiem izdevējiem. Pēc tam Laravel rindā pievienot lokālu OCR procesu un saskaņoto MI adapteri aiz kopīgā rezultāta līguma. Pašreizējie piemēri nav izmantoti fiksētu koordinātu, uzņēmumu šablonu vai modelim specifiskas apmācības veidošanai.
