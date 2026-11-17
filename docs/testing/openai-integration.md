# 7. posma pārbaudes — 2026-11-17

Izmantoti tikai sintētiski teksti/attēli un imitētas OpenAI atbildes. Maksas API pieprasījumi nav veikti; īsta modeļa semantiskā kvalitāte un projekta API pieejamība nav mērīta.

- Laravel: 24 sekmīgi testi, 105 assertions. Pārbaudīta Responses API struktūra, rēķina dati, līgums/unknown, nosūtītājs/saņēmējs, PVN/neto/atlikums, datumi/summas, null, izdomāti pierādījumi, nezināmi atribūti, bojāts JSON, atteikums, nepabeigta atbilde, 401/429/500, kredītu izsīkums, timeout, trūkstoša API vai lietotnes slepenā atslēga, izslēgts režīms, produkcijas/Origin/IP/Host bloķēšana, piekrišana, lapu secība/dublikāti, attēlu noraidīšana, izmēra un atkārtojumu limiti, testēšanas kvota, tikai skaitlisku usage žurnalēšana un neparedzētu kļūdu satura neizpaušana.
- Frontend vienībtesti: 62 sekmīgi testi. Ietver esošos dokumentu, OCR, redaktora, migrācijas un PDF testus, kā arī AI piekrišanu, izvēlētā dokumenta izolāciju, tikai OCR payload, offline, kļūdas, manuālo/apstiprināto lauku saglabāšanu, neaktuālu rezultātu noraidīšanu un AI sagaidīšanu pirms saglabāšanas.
- Frontend produkcijas/PWA būvējums: sekmīgs.
- Reāls Laravel lokālais serveris: `GET /` atbild 200; pēc noklusējuma izslēgtais `POST /api/document-analysis` atbild 503. Atslēga nav konfigurēta.
- `composer validate`, `composer check-platform-reqs` un Pint pārbaude norādītajiem PHP avotu ceļiem: sekmīgi. Mainīto frontend failu Prettier pārbaude: sekmīga. Kopējais `npm run format:check` joprojām norāda stila neatbilstības 61 iepriekšējā projekta failā; ārpus šī posma failiem masveida pārformatēšana nav veikta.

Playwright: **195/195 sekmīgi** (10,8 minūtes), Chrome izkārtojumos `mobile-360`, `mobile-390`, `desktop`. Pārbaudīts viss esošais komplekts, arī reāls lokāls Tesseract OCR, PDF, IndexedDB migrācija/saglabāšana, grupēšana, pieejamība un bezsaistes PWA. Jaunie AI testi pārbauda piekrišanas noraidīšanu pirms nosūtīšanas, tikai viena dokumenta OCR pieprasījumu, ieteikumu attēlošanu, manuāla nosūtītāja saglabāšanu, apstiprināšanu, pārlādi un reālu PDF priekšskatījumu; offline AI piedāvā lietotāja izvēlētu lokālu turpināšanu.

Pēc pēdējā lokālās darbības precizējuma atkārtoti pārbūvēta PWA un izturēti vēl **24/24** dokumentu/AI regresijas testi visos trīs izkārtojumos (1,4 minūtes). Poga **Analizēt lokāli** avotu sadaļā pārbaudīta kā lokāla arī tad, ja galvenajai atpazīšanas darbībai izvēlēts OpenAI; tā neveic ārēju pieprasījumu.

Pilnais HTML pārskats: `frontend/playwright-report/index.html`; pilnā komplekta artefakti `frontend/test-results/`, pēdējo regresiju artefakti `frontend/test-results/openai-regression/`. Izstrādes serveris atbild adresē `http://localhost:5173`, Laravel `http://127.0.0.1:8000`. AI izslēgts; maksas pieprasījumi nav veikti.
