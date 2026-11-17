# Attēlu analīzes un komplektu arhitektūra

Datu ceļš: ScanView → recognizeDocument → useScanSession.analyzeDocument → analysisPayload/prepareAiImage → Laravel DocumentAnalysisController → OpenAiAnalyzer → Responses API. Lokālais OCR šajā ceļā netiek palaists. Saglabāts esošais dokumentu katalogs, lapu grupēšana, melnrakstu saglabāšana un PDF kodols.

Aktuālā mašīnlasāmā Structured Outputs shēma: [document-vision.schema.json](requirements/document-vision.schema.json).

## OpenAI līgums

Oficiālā dokumentācija pārbaudīta 2026-11-17: [GPT-6 Luna attēlu ievades, Responses un Structured Outputs atbalsts](https://developers.openai.com/api/docs/models/gpt-6-luna), [attēlu ievade](https://developers.openai.com/api/docs/guides/images-vision), [strict JSON Schema](https://developers.openai.com/api/docs/guides/structured-outputs). Konkrētā konta modeļa pieejamība nav pārbaudīta ar maksas pieprasījumu.

POST /api/document-analysis saņem consent=true un pages=[{id,number,image}]. image ir JPEG/PNG/WebP base64 data URL. Ārēji URL un OCR teksts nav pieņemti. number ir precīza 1..N secība, ID ir unikāli. Serveris pārbauda base64, faktisko MIME un attēla izmērus līdz 16 MP/6000 px. Klienta JPEG kopija ir līdz 2800 px/8 MP ar kvalitāti 0,9; oriģināls saglabājas. Legacy attēla apstrādi vajadzības gadījumā atjauno ierīcē no saglabātajiem parametriem.

AI shēma: document_type, attributes masīvs ar {label,key,value,data_type,page,evidence}, warnings. Visas objekta properties ir required; additionalProperties=false. Nezināma atslēga/lapa/avots ir null. Laravel validē, normalizē datumus/summas/valūtu, izmet tukšus un atkārtotus laukus. Nestandarta key kļūst par pielāgotu lauku. Koordinātas netiek ģenerētas. Attēlu citāti ir nepārbaudīti AI ieteikumi (verified=false), ko lietotājam jāsalīdzina ar foto.

Klientam atgriež version=2, katalogam saderīgu attributes objektu, dynamic_attributes, evidence, requires_review=true, warnings un faktiskos skaitliskos usage metadatus. V1 saglabātie rezultāti paliek atverami. Stabilu dinamiskā lauka ID, izcelsmi un pārbaudes statusu kontrolē lietotne, nevis AI. Dinamiskajā ierakstā glabā id, key, normalizedKey, label, value, dataType, pageId/page, evidence, status, origin un labojuma/pārbaudes laiku.

Manuāli labotie/tukšotie un pārbaudītie lauki ir prioritāri. Dzēsto/pārdēvēto pielāgoto lauku iepriekšējos nosaukumus atceras, nepieļaujot to klusu atjaunošanu. Dokumenta apstiprinājums fiksē values, customFields un dynamicAttributes; avota vai datu izmaiņas padara to neaktuālu.

## Konfigurācija un drošība

Windows PHP/OpenSSL bez konfigurēta CA faila var atgriezt cURL 60, lai gan pārlūka HTTPS darbojas. `OpenAiTransport` Windows vidē izmanto operētājsistēmas uzticamo sertifikātu krātuvi ar `CURLSSLOPT_NATIVE_CA`, saglabājot `verify=true` un aizliedzot pāradresācijas. SSL pārbaude netiek atslēgta. Skatiet [oficiālo cURL aprakstu](https://curl.se/libcurl/c/CURLOPT_SSL_OPTIONS.html). cURL 28 tiek ziņots kā `timeout`; TLS/sertifikātu kļūmes kā `upstream_tls`, bet DNS/savienojuma kļūmes kā `upstream_connection`. Klientam un žurnāliem netiek nodots pilns izņēmuma teksts vai pieprasījuma dati.

| Mainīgais | Noklusējums |
|---|---|
| OPENAI_MODEL | gpt-6-luna |
| OPENAI_TIMEOUT | 60 s (maksimums 120) |
| DOCUMENT_AI_MAX_OUTPUT_TOKENS | 4000 (maksimums 8000) |
| DOCUMENT_AI_MAX_PAGES | 20 |
| DOCUMENT_AI_MAX_IMAGE_BYTES | 4 000 000 |
| DOCUMENT_AI_MAX_IMAGE_TOTAL_BYTES | 16 000 000 |
| DOCUMENT_AI_MAX_BODY_BYTES | 22 000 000, ieskaitot base64 |
| DOCUMENT_AI_REQUESTS_PER_MINUTE | 3 |
| DOCUMENT_AI_TEST_REQUEST_LIMIT | 20 |

PHP post_max_size un reversā starpnieka limitus saskaņojiet ar JSON ierobežojumu. Zemāks servera limits droši atgriež kļūdu. .env piemērs papildināts; esošais lietotāja .env nav pārrakstīts. Pēc izmaiņām izpildiet php artisan config:clear.

API atslēga paliek serverī. Attēli backend ir tikai pieprasījuma atmiņā; žurnāli satur tikai skaitlisko usage. Cache glabā kvotu skaitītājus un HMAC dublikātu nospiedumus, bez attēliem/atbildēm. Kvotu rezervē pirms ārējā zvana arī neveiksmīgam mēģinājumam; dublikātu logs 120 sekundes, automātisku maksas atkārtojumu nav. Limiti negarantē precīzu 5 USD tēriņu slieksni. store=false nav solījums par visu OpenAI glabāšanu. Produkcijā galapunkts noraida pieprasījumus; pirms izvietošanas vajadzīga autentifikācija un lietotāju kvotas. Paliek IP/host/Origin lokālās vides vārti.

## IndexedDB v2

Migrācija tikai pievieno collections un savedDocuments, neaizskarot drafts/pages/images. collections glabā id, schemaVersion=1, name, sakārtotu documentIds, revision un createdAt/updatedAt. savedDocuments glabā dokumenta/lapu momentuzņēmumu, originalDocumentId, savedAt, confirmed un katras lapas imageRecordId. Komplekti pastāv neatkarīgi no sesijas.

Pievienošana pārbauda sesijas revision vienā transakcijā ar komplekta un attēlu izmaiņām. Attēlu pārvieto uz nemainīgu ierakstu; sesijai paliek neliels alias. Vairāki komplekti koplieto vienu attēlu. Apstrādes labojumi izveido jaunu versiju ar originalReference uz iepriekšējo oriģinālu. readImageRecord atrisina atsauces un atklāj ciklus. Atkritumu savācējs transakcijā nosaka visus attēlus, kas sasniedzami no melnrakstiem/komplektiem/attēlu atsaucēm, pirms dzēš pārējos.

Komplekts automātiski neseko vēlākām melnraksta izmaiņām. Aktuālo versiju ievieto, izņemot un no jauna pievienojot dokumentu. Sesijas dzēšana komplekta attēlus neizdzēš. Secības maiņa nekad neapvieno dažādu dokumentu lapas. Komplekta mutācijas pārbauda revision pret citas cilnes labojumiem. MongoDB nav ieviests.

## PDF un mobilā UX

Atsevišķam dokumentam saglabāts esošais pdf-lib Worker, Unicode Noto Sans fonts, divu kolonnu informācijas tabula un tās sadalīšana vairākās lapās. Komplekta Worker secīgi ģenerē dokumentu sadaļas un apvieno tās lietotāja secībā. Neaktuālu apstiprinājumu nevar izmantot informācijas lapai; nepārbaudītam dokumentam eksportē tikai attēlus. Limits visam eksportam: 20 skenētas lapas, 128 PDF lapas un 80 MiB gala fails. Lejupielādēts PDF netiek modificēts; vienmēr veido jaunu versiju no datiem.

AI pārklājums izmanto Vuetify dialoga fokusa pārvaldību, aria-live, nosauktu progresa indikatoru un prefers-reduced-motion. Sagatavošanā rāda faktisko lapu skaitu, tīkla gaidīšanā nenoteiktu progresu. AbortController pārtrauc klienta gaidīšanu un neizdzēš datus; serverī jau sākta maksas apstrāde var turpināties. Bloķē paralēlus pieprasījumus un pirms rezultāta pieņemšanas pārbauda avota versiju.

Fiziskā Android ierīce/attāls backend nav izvietots vai pārbaudīts. APK nav veidots. Tesseract kods un npm run ocr:prepare saglabāts atsevišķai nākotnes atjaunošanai, bet aktīvajā saskarnē tā nav.
