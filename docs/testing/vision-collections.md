> Aktuālā mobilās UX versija un pilnā komplekta gala rezultāti: [mobilās UX pārskats](mobile-ux-review.md). Zemāk saglabāts iepriekšējās versijas pārskats.

# Attēlu analīzes un komplektu pārbaudes

Izmaiņu kārta: 2026-11-17. Izmantoti sintētiski attēli un imitētas OpenAI atbildes. Maksas API pieprasījumi, Git operācijas, MongoDB integrācija un APK būvēšana nav veikta. Esošais backend/.env nav pārrakstīts; pēc konfigurācijas izmaiņām iztīrīts Laravel konfigurācijas kešs.

Papildu Windows TLS labojums: reproducēta cURL 60 sertifikātu kļūda bez autorizācijas. Pēc `OpenAiTransport` labojuma īsts HTTPS GET uz OpenAI `/v1/models` bez atslēgas saņēma sagaidāmo 401, saglabājot TLS pārbaudi. Tas neizsauc modeli un nerada analīzes maksu. Pēc labojuma Laravel iztur **34/34 testus (129 assertions)**, frontend **65/65** vienību testus un produkcijas būvējums ir sekmīgs. TLS/DNS kļūmes vairs netiek kļūdaini pasniegtas kā analīzes taimauts. Zemāk tabulā saglabāts sākotnējās izmaiņu kārtas rezultāts.

## Faktiski izpildīts

| Pārbaude | Rezultāts |
|---|---|
| Laravel php artisan test | 24/24 testi; 108 assertions, sekmīgi |
| Frontend npm run test:unit | 65/65, sekmīgi |
| Frontend npm run build | Sekmīgs produkcijas PWA būvējums |
| Sākotnējā pilnā Playwright regresija | 216 testi: 141 izturēts, 75 neizturēti; 8 minūtes |
| Atkārtoti app.spec.js + vision-collections.spec.js | 48/48, sekmīgi 360 px, 390 px un telefona rāmī platā skatījumā |
| Atkārtoti editor.spec.js + scanning.spec.js + pdf.spec.js | 87/87, sekmīgi; pārbaudīti arī kvotas kļūdu rollback un bezsaistes PDF |
| Pielāgotie esošie openai.spec.js | 6/6, sekmīgi; fotoattēlu piekrišana, manuālie labojumi, PDF un bezsaistes turpināšana |
| Pilns npm run format:check | Neizturēts: 40 failu formatējuma neatbilstības, galvenokārt ārpus šajā uzdevumā mainītajiem failiem |
| Mainīto frontend failu atsevišķa Prettier pārbaude | Sekmīga |
| Mainīto Laravel failu Pint pārbaude | Sekmīga |

Pēdējās trīs Playwright rindas kopā veido 141 aktīvās plūsmas pārbaudi, kas izpildīta pa daļām. Tas nav apgalvojums, ka visi 216 vēsturiskās kopas testi tagad izturēti. Sākotnējās kļūdas ietvēra novecojušas gaidas par datubāzes versiju 1, divām navigācijas saitēm un OCR saskarni. Shēmas/navigācijas gaidas atjauninātas. Atklātā asinhronās attēlu rakstīšanas kvotas kļūdas apstrādes regresija izlabota un atkārtoti pārbaudīta.

**Atlikušais testu darbs:** vecie OCR, lokālās analīzes, teksta labošanas un dokumentu robežu ieteikumu saskarnes scenāriji jāpārveido jaunās plūsmas pārbaudēm. Tie nav dzēsti, izlaisti vai paslēpti. Pilna vēsturiskā testu kopa nav bez kļūdām. Žurnāli ir frontend/test-suite-final.log, frontend/test-regression-final.log un frontend/test-vision-final.log; attiecīgie Playwright artefakti ir lokālajā test-results mapē un var tikt aizstāti nākamajā palaišanā.

## Jauno scenāriju pārklājums

- Vienas un vairāku sakārtotu fotogrāfiju ievade bez OCR teksta un bez OCR worker palaišanas; citu dokumentu lapas nenonāk izvēlētā dokumenta pieprasījumā.
- Piekrišana, gaidīšanas pārklājums, nenoteikts progress, atcelšana un API kļūdas; manuāla turpināšana un skenējuma PDF.
- Dinamiski lauki, manuālo vērtību prioritāte, pārbaude, pielāgotu lauku pārdēvēšana/dzēšana un aizsardzība pret to atjaunošanu atkārtotā analīzē.
- Tokenu patēriņa metadatu parādīšana no imitētas reālam API formātam atbilstošas atbildes, bez precīzu naudas izmaksu minēšanas.
- Komplekta saglabāšana/pārlāde, dokumenta pievienošana vēlāk no jaunas sesijas, nosaukuma/secības maiņa un atsevišķs/kopējs PDF.
- Sākotnējās sesijas dzēšana, saglabājot komplekta PDF izveidi. Attēla rediģēšana pēc pievienošanas komplektam neizmaina saglabāto versiju un nedublē oriģināla Blob. Pēdējās atsauces dzēšana savāc nevajadzīgos attēlus.
- IndexedDB v1 → v2 migrācija saglabā oriģinālu un laboto OCR tekstu. Iepriekšējo melnrakstu grupēšanas/atribūtu saderību pārbauda arī vienību testi.
- PDF Unicode saturs, dokumentu/lapu secība un attēlu klātbūtne pārbaudīti ar neatkarīgu PDF.js lasītāju; saglabātas esošās kvalitātes, proporciju, garu tabulu un avota versijas pārbaudes.
- Gaišais/tumšais režīms, 360/390 px izkārtojumi un automatizētas WCAG AA pārbaudes, ieskaitot komplektu ekrānu. Komplekta lapā atstāts viens pirmā līmeņa virsraksts.

Sintētiskās 390 px plūsmas vizuāli pārskatītie artefakti: [AI gaidīšanas pārklājums](../mobile-design/ai-loading-390.png), [dinamiskā informācija](../mobile-design/ai-fields-390.png). Pēc analīzes saskarne pārvirza fokusu uz informācijas tabulu.

## Ierobežojumi

- Nav izpildīts maksas OpenAI pieprasījums; konkrētā API projekta modeļa tiesības un faktisko dokumentu atpazīšanas kvalitāte vēl jāpārbauda ar atļautiem dokumentiem.
- Atcelšana ierīcē negarantē jau sāktas servera apstrādes/patēriņa atcelšanu. 20 pieprasījumu kvota negarantē precīzu 5 USD slieksni.
- Produkcijas AI galapunkts joprojām bloķēts līdz autentifikācijas un individuālu kvotu ieviešanai; fiziskā Android ierīce/attāls backend nav pārbaudīts.
- Komplekts saglabā pievienošanas brīža dokumenta versiju. Jaunus labojumus ievieto, izņemot un atkārtoti pievienojot dokumentu.
- Vienā PDF eksportā līdz 20 skenētām lapām, 128 PDF lapām un 80 MiB. Lielākus komplektus eksportē pa dokumentiem.
- Bezsaistes PWA eksportam sākotnēji jāpabeidz lietotnes resursu kešošana. Pārlūka datu dzēšana izdzēš lokālos melnrakstus un komplektus.
