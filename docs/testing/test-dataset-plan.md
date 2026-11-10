# Testdatu plāns — #05

2026-11-10 lietotājs atļāva 11 pievienoto PDF vizuālu izpēti un lokālu testēšanu. Tas nav atļāvums tos publicēt, izmantot modeļa apmācībai vai nosūtīt nesaskaņotam pakalpojumam. Oriģināli paliek ārpus repozitorija. Priekšskatījumi, OCR teksts un failu atbilstības atrodas ignorētajā `tools/ocr-evaluation/private/`.

## Piemēru izpēte

Identifikatori D01–D11 atbilst šīs lokālās pārbaudes failu nosaukumu kārtojumam. Privātā atbilstība ir `private/inspection/manifest.json` un `private/benchmark/manifest.json`; publiskajā dokumentā nav klientu, kontu, numuru vai īsto failu nosaukumu.

| ID | Lapas | Vispārīgs vizuālais novērojums | Atpazīšanas risks |
| --- | --- | --- | --- |
| D01 | 2 | Angļu rēķins, divas adresātu kolonnas, preču tabula; gala summas un noteikumi otrajā lapā; nav PDF teksta slāņa | Lapu turpinājums, preču un gala summu nošķiršana |
| D02 | 1 | Pavadzīmes virsraksts, rēķina numurs zem tā, īsa preču tabula un atsevišķs bankas bloks | Apvienota dokumenta nozīme, vairāki identifikatori |
| D03 | 1 | Blīva pavadzīme ar daudzām rekvizītu kolonnām un maksājumu kopsavilkumu | Sīks fonts, rindu/kolonnu sajaukšana |
| D04 | 1 | Vienkāršs rēķins ar pakalpojumu tabulu, vairākiem PVN un summu ierakstiem | PVN likmju un apmaksas summas nošķiršana |
| D05 | 1 | Polises rēķins, rekvizīti centrā, gara kontu informācija, viena pozīcija | Rēķina un polises numura atšķiršana |
| D06 | 2 | Rezervācijas lapa ar grafiku un noteikumiem; otrajā lapā atsevišķs pakalpojuma/maksājuma kopsavilkums ar apmaksāta rēķina norādi | Rezervācija nav automātiski rēķins; lapu lomas un apmaksas statuss |
| D07 | 1 | Pakalpojumu rēķins ar stingrām tabulu līnijām un kompaktu tekstu | Izteikta OCR teksta izlaišana šajā mēģinājumā |
| D08 | 1 | Rēķina numurs augšējā labajā daļā, maksātājs un adresāts citur, tabulas kopsavilkums | Lomas un vairāki summu apzīmējumi |
| D09 | 1 | Blīvas krāsainas tabulas, periodi, maksājuma bloks un summu kopsavilkums | Vairāki datumi, atlikumi un apmaksas summa |
| D10 | 1 | Angļu maksājuma/rēķina dokuments ar pasūtījumu, atlaidi un PVN kopsavilkumu | Pasūtījuma ID nav rēķina numurs, samaksātais nav pilnā summa |
| D11 | 1 | Datumi augšējā labajā daļā, adresātu kartītes, preces un maksājuma tabula | Kopējā summa, samaksātais un termiņš atšķiras |

Šie ir struktūras novērojumi, nevis pilns manuāli anotēts etalons. Dokumentu patiesie tipi, atribūti un transkripcijas vēl jāapstiprina anotētājiem; tos nedrīkst aizpildīt ar paša OCR/MI prognozēm. Desmit PDF pieejams teksta slānis; D01 divlapu PDF tā nav. Arī teksta slānis nav automātiski pareizā atbilde.

## Anotēšanas ieraksts un datu nodalīšana

Privātajam manifestam paredz: `sample_id`, oriģināla kontrolsummu, avotu, atļaujas apjomu un datumu, atļauto glabāšanas vietu/termiņu, valodas, lapu skaitu un grupējumu, kvalitātes pazīmes, izdevēja/izkārtojuma grupu, kopas daļu un atsevišķu anotāciju statusu. Etalonā vajag pārbaudītu tipu, katra lauka vērtību vai apstiprinātu neesamību, avota lapu/fragmentu, OCR transkripciju, anotētāju un pārbaudītāju.

Neanotēts lauks nav zināms `null`; tā statuss ir `pending`, un to izslēdz no precizitātes saucēja. Arī “neizlasāms” jāatšķir no “dokumentā nav”. Pašreizējie 11 piemēri ir izpētes kopa, nevis neatkarīgs tests.

Nākamajam pilotam sagatavot vismaz 60 atļautus dokumentus, aptverot zemāk minētās pazīmes; skaits ir plāns, nevis pašreizējā pieejamība. Dalīt izstrādes, validācijas un aizturētajā testā pa izdevēja/izkārtojuma grupām. Visas viena dokumenta lapas, tā foto un mākslīgi pasliktinātās versijas paliek vienā daļā. Pārbaudes kopā iekļaut jaunus izdevējus un apzīmējumus; uz tās pamata nerakstīt īpašus noteikumus.

| Scenārijs | Nepieciešamais etalons un pārbaude | Pašlaik |
| --- | --- | --- |
| Dažādi uzņēmumi un izkārtojumi | Neatkarīgi pārbaudīti lauki; sadalījums pēc izdevēja | 11 piemēri vizuāli izpētīti; pilns etalons nav gatavs |
| Viena/vairākas lapas | Lapu secība, dokumenta robežas, avota lapa | 9 vienlapas un 2 divlapu PDF |
| LV, EN, RU un jaukta valoda | Cilvēka pārbaudīta valoda un teksts | LV/EN piemēri; RU tikai sintētisks |
| Slikts apgaismojums, ēnas | Vienam saturam oriģināls un kontrolēts foto | Vēl jāsagatavo |
| Slīpums, perspektīva, 90°/180° | Zināma transformācija, teksta un robežu pareizība | Viena 90° sintētiska pārbaude; perspektīva nav realizēta |
| Tabulas un vairāki datumi/summas | PVN, neto, apmaksa, atlikums un datumu lomas atsevišķi | Pārstāvēts piemēros; anotācijas jāizveido |
| Daļēji nesalasāms saturs | Atzīmēts “neizlasāms”; sagaida `null` un pārbaudi | Automatizēts kandidātu konflikta tests |
| Sajauktas dažādu dokumentu lapas | Manuāli pārbaudīts lapu grupējums | Nākotnes scenārijs; grupēšana nav realizēta |
| Cits/nezināms tips | Pārbaudīts `other` vai `unknown` un pamatojums | Nezināma satura vienībtests |
| Trūkstoši atribūti | Apstiprināta neesamība, bez izdomātām vērtībām | Vienībtests; reālu dokumentu etalons vēl vajadzīgs |
| Jauns sinonīms, valoda, izkārtojums | Aizturēts tests; kļūda vai `null` jāmēra | Rindu secības/koordinātu vienībtests, ne pilns vispārinājuma tests |
| Nederīgs, tukšs vai pārliels fails | Pareizs kļūdas kods vai `no_text_detected` | Attēla/CLI kļūdu un tukšas lapas pārbaudes |

## Mērījumi

OCR: CER = simbolu rediģēšanas attālums / etalona simbolu skaits; WER analoģiski vārdiem. Pirms salīdzināšanas vieno Unicode NFC un atstarpes; saglabā reģistru un pieturzīmes. Rindu/kolonnu secības problēmas uzrādīt atsevišķi. [evaluate_text.py](../../tools/ocr-evaluation/evaluate_text.py) izmanto šo kārtību.

Semantika: tipu sajaukuma matrica un macro F1; laukiem precīza normalizētās vērtības atbilstība, aizpildījuma pārklājums, kļūdaini aizpildīto lauku īpatsvars, pamatota atturēšanās un lietotāja labošanas laiks. `null` nedrīkst izmantot, lai slēptu zemu pārklājumu; tāpat ne-null lauku skaits nav pareizības mērījums. Laiku, RAM un CPU mērīt ar fiksētu aparatūru, DPI, modeļu kontrolsummām, valodām un atsevišķu auksto/iesilušo palaišanu.

Pieņemšanas sliekšņi un minimālie datu apjomi vēl jāvienojas ar GASO pēc pilotkopas anotēšanas. Visām atbildēm nepieciešama lietotāja pārbaude. To pašu testu manifestu un shēmu izmantot korporatīvajam API tikai pēc datu nosūtīšanas atļaujas.
