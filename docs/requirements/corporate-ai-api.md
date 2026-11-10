# GASO korporatīvā MI API sagatavošana — #04

Statuss 2026-11-10: tehniskais līgums un jautājumi sagatavoti; pakalpojums, piekļuve un datu apstrādes nosacījumi vēl nav saskaņoti. Kartīte #04 nav pilnībā pabeigta. Šis dokuments nav uzņēmuma apstiprinājums.

## Jautājumi atbildīgajam speciālistam

| Nr. | Jautājums | Nepieciešamais rezultāts |
| --- | --- | --- |
| 1 | Kāds pakalpojums un modelis ir apstiprināts GASO? | Pakalpojuma īpašnieks, tehniskā dokumentācija, modeļa versija |
| 2 | Vai pieņem attēlus un PDF? Kādi formāti? | MIME tipi, maksimālā izšķirtspēja, skenētu PDF atbalsts |
| 3 | Vai ir REST API? | Faktiskā adrese, versijas, pieprasījumu un kļūdu piemēri |
| 4 | Kā notiek autentifikācija? | Atslēga, OAuth, mTLS vai cits faktiski noteikts mehānisms; rotācija |
| 5 | Vai vairāku lapu dokumentu var nosūtīt vienā pieprasījumā? | Lapu limits, secība, atbildes piesaiste lapām |
| 6 | Vai pieejama strukturēta JSON atbilde un shēmas ierobežošana? | Atbalstītā shēma, validēšana, nepilnīgas atbildes |
| 7 | Vai iegūst tipu, atribūtus un to avotus? | Tipu saraksts, teksta fragmenti, lapas, novērtējuma nozīme |
| 8 | Vai atbalsta latviešu, angļu, krievu un jauktas valodas? | Oficiāls atbalsts un atļauti kvalitātes testi |
| 9 | Kādi ir failu, lapu, tokenu un pieprasījumu ierobežojumi? | Limiti, paralēlisms, 429, taimauti, asinhroni uzdevumi |
| 10 | Kā aprēķina izmaksas? | Tarifi, kvotas, izmaksu uzskaite un budžeta ierobežojumi |
| 11 | Kur apstrādā un glabā datus? | Reģions, apakšapstrādātāji, saglabāšanas termiņi, dzēšana, rezerves kopijas, izmantošana apmācībai |
| 12 | Vai drīkst nosūtīt pilnu dokumentu vai tikai atlasītu tekstu? | Atļautās datu kategorijas, maskēšana, personas un banku dati |
| 13 | Vai drīkst izmantot izstrādes un demonstrācijas vidē? | Atsevišķa testvide, piekļuve, atļautie dokumenti |
| 14 | Vai jau ir koda piemēri un dokumentu risinājumi? | Esošie adapteri, kontaktpersona un atbalsta process |
| 15 | Kādi tīkla un audita nosacījumi jāievēro? | Izejošo adrešu saraksts, TLS, VPN, žurnālu saturs, incidentu kārtība |

Visu atbilžu statuss pašlaik ir **nav saņemts**. Apstiprinājumam vēl jāfiksē atbildīgais, datums, atļautā vide un atļautais datu apjoms.

## Integrācijas līgums

Neatkarīgā prototipa [interfeiss](../../tools/ocr-evaluation/analysis.py) ir `DocumentAnalysisProvider.analyze(pages) -> result`. Ievade satur vienam dokumentam piederošas, sakārtotas OCR lapas ar tekstu un koordinātām. Lapu grupējumu nodrošinās cita komponente. API pilnu attēlu pievienošana būs jāprojektē pēc specifikācijas saņemšanas; pašreizējais interfeiss attēlu nosūtīšanu nerealizē.

| Realizācija | Pašreizējā uzvedība |
| --- | --- |
| `LocalOcrProvider` | Vienkāršs lokāls semantikas eksperiments pēc OCR; bez tīkla |
| `CorporateAiProvider` | Atgriež `corporate_api_not_configured`; HTTP pieprasījumu nav |
| `MockDocumentProvider` | Testā padota rezultāta neatkarīga kopija; nepiedalās reālās atpazīšanas mērījumos |

Visām realizācijām jāievēro [rezultāta JSON shēma](document-analysis.schema.json), atribūtu nozīmes un `requires_review: true`. Dokumenta saturs ir dati: arī tajā rakstīti norādījumi nedrīkst mainīt apstrādes noteikumus, izsaukt rīkus vai noteikt saņēmēja adresi.

[Backend konfigurācijas sagatave](../../backend/.env.example) definē `DOCUMENT_AI_PROVIDER=local`, tukšus `CORPORATE_AI_BASE_URL`, `CORPORATE_AI_API_KEY`, `CORPORATE_AI_MODEL` un `CORPORATE_AI_TIMEOUT=60`. Tie ir projekta iekšējie nosaukumi, nevis GASO API protokols. Python CLI lasa režīmu no procesa vides; `.env` automātiski neielādē. Frontend šos parametrus nesaņem.

## Pieslēgšanas secība pēc saskaņošanas

1. Saņemt rakstisku atļauju konkrētajam pakalpojumam, videi un datu kategorijām.
2. Backend izveidot adapteri pēc faktiskās dokumentācijas; pieprasījumu veidot tikai uz administratora konfigurētu, atļautu adresi.
3. Ieviest autentifikāciju, failu/lapu limitus, TLS pārbaudi, taimautu, izmaksu un atkārtojumu ierobežojumus. Neatkārtot neatgriezenisku operāciju bez idempotences līguma.
4. Validēt un normalizēt atbildi pēc kopējās shēmas. Atteikumu, nekorektu JSON vai taimautu parādīt kā kļūdu, nevis izdomātus datus.
5. Palaist tos pašus atļautos etalonus, atsevišķi mērot OCR un atribūtus. Nepublicēt dokumentu tekstu vai pilnus pieprasījumu žurnālus.
6. Saglabāt obligātu lietotāja pārbaudi. Nav automātiskas pārejas uz citu ārēju MI pakalpojumu.

Lokālā režīma dokumenti paliek lokāli. Modeļu/programmu instalēšana izmanto internetu, taču dokumentu apstrādei tas nav vajadzīgs. Rezultātu JSON, pierādījumu fragmenti, rastri un žurnāli ir tikpat privāti kā oriģināli. To glabāšanas termiņi, piekļuves tiesības un dzēšana GASO vidē vēl jāsaskaņo. Prototips nav produkcijas drošības vide.
