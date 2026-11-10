# Dokumentu tipu katalogs — #05

Tipu nosaka dokumenta nozīme un vairāki satura pierādījumi. Logotips, faila nosaukums, viena atslēgvārda atrašanās vieta vai konkrēts uzņēmums nedrīkst būt tipa noteikšanas pamats.

| Atslēga | Nosaukums | Nozīme un atšķiršana |
| --- | --- | --- |
| `invoice` | Rēķins | Maksājuma pieprasījums ar darījuma un summu informāciju; var būt priekšapmaksas vai polises rēķins |
| `contract` | Līgums | Pušu saistības, priekšmets, datumi un noteikumi |
| `application` | Iesniegums | Iesniedzēja lūgums adresātam; nejaušs vārds “application” nav pietiekams |
| `insurance_document` | Apdrošināšanas dokuments | Polise, segums, apdrošināšanas periods; apdrošinātāja izrakstīts rēķins var būt `invoice` |
| `delivery_note` | Pavadzīme | Preču nodošanas/saņemšanas dokuments; iespējama apvienota rēķina/pavadzīmes nozīme |
| `other` | Cits | Saturs salasāms un saprotams, bet neietilpst reģistrētajos tipos |
| `unknown` | Nav noteikts | Nepietiek pierādījumu, nesalasāms teksts vai pretrunīgi tipu kandidāti |

Apvienotam dokumentam primāro tipu manuāli pārbauda; papildu nozīmes var norādīt `attributes.document_roles` masīvā. Vienam maksājumam saistīti pasūtījuma, rezervācijas un rēķina numuri nav savstarpēji aizstājami.

Tipu reģistrs ir paplašināms: pievieno jaunu `snake_case` identifikatoru, nozīmes aprakstu, atribūtu katalogu un pārbaudītus piemērus. Rezultāta shēma pieļauj jaunas atslēgas bez datu modeļa pārbūves. Pakalpojuma nezināmu tipu nedrīkst nekritiski pieņemt — backend to salīdzina ar reģistru un nosūta pārbaudei.

Pašreizējais lokālais eksperiments atpazīst tikai dažus skaidrus LV/EN/RU virsrakstus; pārējos gadījumos atgriež `unknown`. Tas nav gatavs universāls klasifikators. Valodas noteikšana nav realizēta (`language: null`); izvēlētās OCR valodu pakotnes nepierāda dokumenta valodu.
