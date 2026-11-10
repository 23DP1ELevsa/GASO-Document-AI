# Lokālais OCR demonstrācijas rīks

Neatkarīgs komandrindas prototips attēliem un PDF. Laravel, Vue, MongoDB un ārējs MI API nav nepieciešams. Tas veic OCR un ierobežotu atribūtu iegūšanas eksperimentu; gatava universāla dokumentu izpratne vēl nav realizēta.

## Palaišana šajā darba mapē — Windows PowerShell

Python vide un Tesseract ir pieejami projekta lokālajās, ignorētajās mapēs. Visas komandas zemāk palaiž no repozitorija saknes.

```powershell
$env:TESSDATA_PREFIX = (Resolve-Path '.local-runtime/ocr-runtime/share/tessdata').Path
$env:OMP_THREAD_LIMIT = '2'
& tools/ocr-evaluation/.venv/Scripts/python.exe tools/ocr-evaluation/generate_synthetic.py --font C:/Windows/Fonts/arial.ttf
& tools/ocr-evaluation/.venv/Scripts/python.exe tools/ocr-evaluation/ocr_demo.py tools/ocr-evaluation/private/synthetic/lv.png --tesseract .local-runtime/ocr-runtime/Library/bin/tesseract.exe --output tools/ocr-evaluation/private/result.json
```

Lai pārbaudītu savu atļauto PDF vai foto, `lv.png` vietā norāda lokālo faila ceļu pēdiņās. Piemēram, pievieno `--auto-orient`, lai izmēģinātu Tesseract orientācijas noteikšanu. Tas prasa `osd.traineddata`; nepārliecinoša rezultāta gadījumā attēls netiek mainīts un rezultātā ir brīdinājums. EXIF orientācija tiek ņemta vērā automātiski. Perspektīvas un neliela slīpuma korekcija vēl nav realizēta.

Bez `--output` JSON tiek izvadīts stdout; tas var saturēt personas datus. Rezultātus glabā `private/` vai citā privātā vietā. CLI neielādē `.env` failus. `DOCUMENT_AI_PROVIDER` pēc noklusējuma ir `local`; `corporate_ai` apzināti beidzas ar kļūdu, kamēr nav īstas integrācijas.

## Uzstādīšana citā datorā

Nepieciešams 64 bitu Python 3.11+ un atsevišķs Tesseract izpildfails ar `lav`, `eng`, `rus`, izvēles `osd` valodu datiem. Faktiski pārbaudīta Python 3.14.5 vide; citām versijām pakotņu saderība jāpārbauda. Sākotnējai instalācijai vajag internetu; OCR darbībai pēc tam tas nav vajadzīgs.

```powershell
python -m venv tools/ocr-evaluation/.venv
& tools/ocr-evaluation/.venv/Scripts/python.exe -m pip install -r tools/ocr-evaluation/requirements.txt
tesseract --version
tesseract --list-langs
```

Tesseract instalēt pēc [oficiālās instrukcijas](https://tesseract-ocr.github.io/tessdoc/Installation.html). Linux vidē pieejama sistēmas pakotņu instalācija, piemēram, `tesseract-ocr`, `tesseract-ocr-lav`, `tesseract-ocr-eng`, `tesseract-ocr-rus`, `tesseract-ocr-osd`; pakotņu nosaukumi/versijas atkarīgi no distribūcijas. Python izpildfails tur būs `.venv/bin/python`.

Šīs pārbaudes Tesseract būvējums instalēts lokāli ar micromamba no conda-forge (`tesseract=5.5.3`); tā nav projekta runtime atkarība. Ja ir micromamba, mērījuma versiju var atkārtot ar:

```powershell
micromamba create -y --no-rc -r .local-runtime/mamba -p .local-runtime/ocr-runtime -c conda-forge tesseract=5.5.3
$env:TESSDATA_PREFIX = (Resolve-Path '.local-runtime/ocr-runtime/share/tessdata').Path
```

Jaunai GASO videi izvēlēties aktualizētu Tesseract būvējumu un atkārtot salīdzinājumu. Vairāk par pārbaudītajām/upstream versijām un licencēm ir [salīdzinājumā](../../docs/testing/ocr-comparison.md).

`TESSDATA_PREFIX` jānorāda uz faktisko valodu datu mapi. Bez tā conda Windows būvējums var meklēt datus nepareizā vietā. TSV ieslēgts ar `-c tessedit_create_tsv=1`, lai nav vajadzīgs distributīvā reizēm trūkstošais `configs/tsv`. Ja izvade nav TSV, rīks atgriež kļūdu, nevis tukšu veiksmīgu atpazīšanu.

## Ievade un izvade

Atbalstīti JPEG, PNG, vienkadru TIFF, WEBP un PDF. Tiek pārbaudīts saturs ar dekoderi, nevis paļauts tikai uz faila paplašinājumu. Ierobežojumi: 25 MiB/fails, 40 megapikseļi/lapā, 20 PDF lapas; attēla īsākā mala vismaz 100 pikseļi. Daudzkadru attēli jāsadala atsevišķos failos. PDF tiek rastrēts (noklusējumā 300 DPI, `--dpi` robežas 72–600); esošais teksta slānis OCR mērījumā netiek izmantots.

Veiksmīgs procesa kods ir 0. Kļūdas gadījumā kods ir 2 un stdout satur `error.code`, drošu ziņojumu un `requires_review: true`. Tukša salasāma lapa dod veiksmīgu atbildi ar `no_text_detected`, `unknown` un `null` laukiem. Sabojāts/šifrēts vai neatbalstīts fails var dot `processing_failed`; trūkstošam dzinējam/valodām un taimautam ir atsevišķi kodi. Rezultāta fails nedrīkst pārrakstīt ievades failu.

Atbilde satur lapu tekstu, rindas, vārdus, robežas, OCR novērtējumus, apstrādes laiku, dzinēja versiju, normalizētos atribūtus un pierādījumus. [Shēma](../../docs/requirements/document-analysis.schema.json) pieļauj tipam specifiskus atribūtus. Koordinātas attiecas uz apstrādāto/pagriezto attēlu. Nenoteikti lauki ir `null`; `requires_review` vienmēr ir `true`.

`--timeout` ierobežo katru Tesseract procesu (noklusējumā 60 s), ne visu PDF uzdevumu. Paddle inferencē šis limits nav ieviests. Produkcijas rindai būs vajadzīgs arī kopējais laika un atmiņas limits. Pagaidu lapu rastri rodas tikai lokālajā `private/` un tiek iztīrīti pēc apstrādes; pilnie rezultātu JSON saglabājas līdz manuālai dzēšanai. Prototips nav produkcijas failu apstrādes izolācija.

## Testi un mērījumi

```powershell
& tools/ocr-evaluation/.venv/Scripts/python.exe -m unittest discover -s tools/ocr-evaluation/tests -v
& tools/ocr-evaluation/.venv/Scripts/python.exe tools/ocr-evaluation/evaluate_text.py tools/ocr-evaluation/private/synthetic/lv.txt tools/ocr-evaluation/private/result.json
```

Atļauto PDF kopai PowerShell izmanto failu masīvu:

```powershell
$invoiceFiles = Get-ChildItem -LiteralPath 'C:\privati\atlautie-dokumenti' -Filter '*.pdf' | Select-Object -ExpandProperty FullName
& tools/ocr-evaluation/.venv/Scripts/python.exe tools/ocr-evaluation/benchmark.py --tesseract .local-runtime/ocr-runtime/Library/bin/tesseract.exe @invoiceFiles
```

Aizstāj piemēra direktoriju ar savu reālo atļauto mapi. `benchmark.py` glabā pilnos rezultātus un privāto failu atbilstību `private/benchmark/`; konsolē ir tikai D01… identifikatori un skaitliska diagnostika. Failu saraksta maiņa var mainīt šos lokālos ID. Sintētisko datu ģenerators ir [generate_synthetic.py](generate_synthetic.py), OCR/CER/WER metodika un reālie rezultāti — [ocr-comparison.md](../../docs/testing/ocr-comparison.md).

## PaddleOCR: neizpildītie priekšnoteikumi

Pārbaude `python -m pip install --dry-run --only-binary=:all: paddlepaddle` ar esošo Python 3.14.5 neatrada saderīgu runtime. PaddleOCR teksta atpazīšana nav palaista; kodā esošais adapteris ir eksperimentāls un nav validēts.

Atkārtošanai vispirms sagatavot atsevišķu Python 3.12 x64 vidi, kurai ir pieejams PaddlePaddle CPU būvējums, pēc [oficiālās instalācijas](https://www.paddlepaddle.org.cn/install/quick). Neaizstāt strādājošo Tesseract vidi. Piemēra komandas (šajā darbā nav izpildītas):

```powershell
py -3.12 -m venv tools/ocr-evaluation/.venv-paddle
& tools/ocr-evaluation/.venv-paddle/Scripts/python.exe -m pip install paddlepaddle paddleocr==3.7.0 Pillow==13.0.0 pypdfium2==5.15.2
& tools/ocr-evaluation/.venv-paddle/Scripts/python.exe -c "import paddle; paddle.utils.run_check()"
```

Konkrēto PaddlePaddle/PaddleX versiju pēc sekmīgas instalācijas fiksēt atsevišķā lock failā; iepriekš esošais runtime versiju pāris vēl nav validēts. Vajadzīgi iepriekš lejupielādēti, saderīgi `PP-OCRv5_mobile_det` un `latin_PP-OCRv5_mobile_rec` inferenču modeļi ar konfigurācijām. Modeļu avoti ir [oficiālajā OCR katalogā](https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/pipeline_usage/OCR.html). Saglabāt tos ignorētā `models/`, fiksēt kontrolsummas un licences. Modelis jāizvēlas pēc valodām, ne izdevēja dizaina.

```powershell
& tools/ocr-evaluation/.venv-paddle/Scripts/python.exe tools/ocr-evaluation/ocr_demo.py tools/ocr-evaluation/private/synthetic/lv.png --engine paddle --paddle-det models/PP-OCRv5_mobile_det --paddle-rec models/latin_PP-OCRv5_mobile_rec --output tools/ocr-evaluation/private/paddle-result.json
```

RU modelim papildus mainīt `--paddle-rec-name eslav_PP-OCRv5_mobile_rec` un modeļa mapi. `lang` netiek izmantots lokālo modeļu vietā: ar explicit modeļiem to noteic izvēlētā modeļa vārdnīca. Adapteris pieprasa lokālos modeļus un izslēdz orientācijas/deformāciju papildu modeļus; pirmo pārbaudi veikt ar sintētiku un bloķētu izejošo tīklu, lai validētu pilnīgu offline darbību. Reālus dokumentus nekad neizmantot modeļu instalēšanas pārbaudei.

## Docling: nākamais struktūras eksperiments

Docling nav instalēts un tā modeļi nav lejupielādēti. Atsevišķā saderīgā vidē instalēt `docling==2.149.0` pēc [oficiālās instrukcijas](https://docling-project.github.io/docling/getting_started/installation/), iepriekš sagatavot struktūras modeļus un lietot `--artifacts-path` vai `PdfPipelineOptions(artifacts_path=...)`. Izvēlēties Tesseract CLI ar `TesseractCliOcrOptions(lang=['lav', 'eng', 'rus'])`, atstāt `enable_remote_services=False`. [Offline konfigurācija](https://docling-project.github.io/docling/usage/advanced_options/) jāvalidē uz sintētiska PDF pirms atļauto piemēru atkārtotas pārbaudes. Šie ir turpmākas pārbaudes soļi, ne ziņojums par sekmīgu Docling palaišanu.
