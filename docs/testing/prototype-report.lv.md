# GASO Meter AI — Trello #07 / #08 izstrādes pārskats

Datums: 2026-11-05. Izveidots lokāli palaižams Laravel 12 un Vue 3 prototips. Repozitorijā sākotnēji bija tikai dokumentācija un tukšās mapes. Nav pievienotas datubāzes tabulas, autorizācija, QR kodi, administrators, iesniegšanas vēsture, PWA vai Railway konfigurācija. Šīs sesijas salīdzinājumu tabula dzīvo tikai pārlūka atmiņā.

## Izveidotie un modificētie faili

| Faili | Nozīme |
| --- | --- |
| `backend/composer.json`, `composer.lock` | Laravel 12 un PHPUnit 11; fiksētas atkarības PHP 8.3+ |
| `backend/.env.example`, `config/app.php`, `config/meter.php`, `config/cache.php`, `config/logging.php`, `config/filesystems.php` | Servera konfigurācija bez slepenām vērtībām; nav publisku failu glabāšanas maršrutu |
| `backend/artisan`, `public/index.php`, `bootstrap/app.php`, `bootstrap/providers.php`, `routes/api.php`, `routes/console.php` | Minimāls Laravel pamats un API |
| `backend/app/Providers/AppServiceProvider.php` | Aizvietojama atpazīšanas pakalpojuma piesaiste |
| `backend/app/Http/MeterController.php`, `PrivateResponse.php` | Validēta pieprasījumu plūsma, pagaidu failu dzēšana, `no-store` priekšskatījumiem |
| `backend/app/Support/PrototypeException.php` | Lietotājam saprotamas kļūdas bez ārējā API atbilžu vai atslēgu izpaušanas |
| `backend/app/Imaging/ImageValidator.php`, `ImageOrientation.php` | Faila saturs, izmērs, pikseļu robeža, EXIF orientācija |
| `backend/app/Imaging/WindowDetector.php` | Eksperimentāla ciparu lodziņa ieteikšana lokāli |
| `backend/app/Imaging/ImageCropper.php`, `ImageEnhancer.php`, `PerspectiveCorrector.php`, `ImageOptimizer.php` | Apgriešana, konservatīvas korekcijas, perspektīva, izmērs un JPEG kodēšana |
| `backend/app/Recognition/MeterRecognizer.php`, `OpenAiRecognizer.php`, `ReadingValidator.php` | Pakalpojuma interfeiss, OpenAI integrācija, atbildes validācija |
| `backend/serve.ps1` | Lokāls PHP serveris ar nepieciešamajiem limitiem un moduļiem |
| `backend/phpunit.xml`, `tests/TestCase.php`, `tests/PrototypeTest.php` | Automatizētas pārbaudes ar imitētu API |
| `backend/tools/generate-fixtures.php`, `tools/compare-variants.php` | Atkārtojami sintētiski piemēri un izmēra/kontrasta salīdzinājums |
| `backend/bootstrap/cache/.gitignore`, `storage/app/.gitignore`, `storage/framework/cache/.gitignore`, `storage/framework/cache/data/.gitignore`, `storage/framework/views/.gitignore`, `storage/logs/.gitignore` | Palaišanai nepieciešamo mapju saglabāšana bez pagaidu datiem |
| `frontend/package.json`, `package-lock.json`, `index.html`, `vite.config.js` | Minimāls Vue 3/Vite pamats un lokāls API starpnieks |
| `frontend/src/main.js`, `App.vue`, `style.css`, `crop.js` | Latviska testēšanas saskarne un apgriešanas palīgfunkcijas |
| `frontend/tests/crop.test.js`, `playwright.config.js`, `e2e/prototype.spec.js` | Vienībtesti un darbvirsmas/mobilās saskarnes pārlūka testi |
| `README.md`, `.gitignore`, šis pārskats | Palaišana, konfigurācija, rezultāti, ģenerēto datu izslēgšana |

Atkarību mapes, būvējumi, testa ekrānattēli un ģenerētie attēli ir tikai lokāli, un tos ignorē `.gitignore`. Privātas fotogrāfijas un īstas API atslēgas nav pievienotas. Netika veiktas `add`, `commit`, `push`, zaru izveides vai Git konfigurācijas izmaiņas.

## Attēla apstrāde un privātums

1. `POST /api/inspect` saņem failu. Pieņem JPEG, PNG un WebP līdz 20 MiB (20 × 1024² baiti). Saturs tiek pārbaudīts ar attēla galveni un atkodēšanu, nepaļaujoties uz faila nosaukumu. Pirms atkodēšanas pārbauda 24 megapikseļu un 12000 px malas drošības robežu. 4000×3000 tiek atbalstīts.
2. JPEG orientāciju nolasa EXIF modulis; PNG `eXIf` un WebP `EXIF` orientācijas tagus nolasa atsevišķs TIFF metadatu lasītājs. Atbalstītas arī spoguļotās orientācijas. Transparenci saplacina uz balta fona.
3. `WindowDetector` samazina attēlu analīzei līdz 600 px garākajai malai un meklē savienotus tumšus komponentus ar lodziņam raksturīgām proporcijām un aizpildījumu. Līdzvērtīgu kandidātu gadījumā atgriež `null`. Tas nelieto konkrēta skaitītāja modeļa veidni un neveic ārēju API pieprasījumu. Tumšas elektronisko displeju apmales var atrast, bet displejus bez šāda kontrasta vai ļoti slīpus lodziņus var palaist garām. Ieteikums vienmēr ir eksperimentāls, un lietotājam tas jāpārbauda.
4. Atgriež orientētu oriģināla priekšskatījumu līdz 1600 px un relatīvās koordinātas. Lietotājs var vilkt jaunu taisnstūri jebkurā virzienā un koriģēt X/Y/platumu/augstumu ar tastatūru. Koordinātas attiecas uz orientēto oriģinālu, nevis priekšskatījuma pikseļiem.
5. `POST /api/preview` atkārtoti saņem oriģinālu un izgriež atlasīto apgabalu sākotnējā izšķirtspējā. Minimums ir 16×16 px; koordinātas nedrīkst iziet ārpus attēla.
6. Pēc izvēles pielieto četru stūru perspektīvas projektīvu transformāciju ar bilineāru interpolāciju, slīpumu ±10°, gaišumu ±30, kontrastu 0–15 un vieglu izlīdzināšanu. Perspektīvas stūrus norāda attiecībā pret izgriezumu. Koriģēšana pēc noklusējuma ir izslēgta; nav ģeneratīvas attēla atjaunošanas vai izdomātu ciparu.
7. Garāko malu ierobežo līdz 1024, 1600 vai 2048 px, saglabājot proporcijas un nekad nepalielinot mazāku fragmentu. Rezultāts ir JPEG ar kvalitāti 94, bez oriģināla EXIF un citiem metadatiem. Sešu variantu salīdzinājums apvieno trīs malu limitus ar kontrastu 0 un 10. Jāizvēlas mazākais variants, kurā lietotājs vēl skaidri redz ciparu kontūras; nav universāla izmēra visiem fotoattēliem.
8. Pirms `POST /api/recognize` lietotājs aplūko fragmentu un obligāti apstiprina lietošanas atļauju un personas datu, adreses, sērijas numura un citas nevajadzīgas informācijas neesamību. Mainot apgriešanu vai korekcijas, priekšskatījums un apstiprinājums tiek anulēts. Personas datu pārbaude šajā prototipā ir **cilvēka veikta**; automātiska personas datu noteikšana nav realizēta. Apstiprinājums ir vajadzīgs arī backend pieprasījumā.

Augšupielādes netiek ievietotas `storage` vai publiskā mapē. Katrs pieprasījums strādā ar PHP multipart pagaidu failu un attēliem operatīvajā atmiņā; `finally` izdzēš saņemto failu arī apstrādes kļūdas gadījumā. PHP papildus izdzēš multipart failus pieprasījuma beigās. Frontend patur attēlus tikai atmiņā, nelieto `localStorage`, IndexedDB vai service worker. Atbildēm ar attēliem ir `Cache-Control: no-store, private`. Testu ģenerators ir atsevišķs CLI rīks, kurš apzināti saglabā **sintētiskus** paraugus lokālai salīdzināšanai; tā nav lietotāju attēlu glabāšana.

Lokālajam prototipam nav autentifikācijas. Serveri piesaistīti `127.0.0.1`. Ieviesti pieprasījumu limiti: inspect 20/min, preview 30/min, recognize 6/min; tie nav domāti publiskai izvietošanai. MySQL nav nepieciešams.

## OpenAI integrācija

`MeterRecognizer` ļauj vēlāk mainīt pakalpojumu, nemainot attēlu apstrādi. `OpenAiRecognizer` izmanto Laravel HTTP klientu un oficiālo `POST https://api.openai.com/v1/responses`. Nosūta vienu `input_image` kā fragmenta JPEG datu URL ar `detail: high`, īsu instrukciju un stingru `text.format` JSON shēmu. Tas atbilst [OpenAI attēlu ievades dokumentācijai](https://developers.openai.com/api/docs/guides/images-vision) un [strukturētu atbilžu dokumentācijai](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). Noklusējuma [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) izvēle ir maināma `.env`.

Shēma atļauj tikai `{"reading": "03874"}` vai `{"reading": null}`. Backend papildus pārbauda, ka nav citu lauku un ka tekstā ir 1–12 ASCII cipari; skaitlis, komats, atstarpes vai `?` tiek noraidīti. Sākuma nulles saglabājas. Instrukcija prasa tikai veselos m³, ignorēt decimāldaļu un sērijas numurus un neskaidru cilindru/pārejas pozīciju gadījumā atgriezt `null`. Promptu un JSON validāciju nedrīkst uzskatīt par garantiju pret modeļa pārliecinoši nepareizu nolasījumu.

Izmaksas ierobežo apgriešana pirms API, bez liekiem atkārtotiem uzlabojumu pieprasījumiem, viens fragments un 150 izvades tokenu limits. Nav automātiskas atkārtošanas pēc kļūdas vai timeout, lai neradītu neparedzētus dubultus maksājumus. `store: false` izslēdz Responses objekta glabāšanu; tas nav solījums par OpenAI visu pakalpojuma žurnālu nulles glabāšanu.

Apstrādā savienojuma kļūdas un timeout (504), 401/403 (sanitizēta konfigurācijas kļūda), 429 (limits/kvota), citus HTTP statusus (502), nederīgu JSON, nepabeigtu atbildi, atteikumu un shēmas pārkāpumu. Sākotnējais pakalpojuma kļūdas teksts un API atslēga netiek atgriezti frontend. Sagaidāmās domēna kļūdas netiek žurnalētas ar steka trasēm.

Ja pieejama tokenu uzskaite, UI rāda ievades, kešotās ievades un izvades tokenus. Aprēķins: `((input-cached)*input_price + cached*cached_price + output*output_price) / 1000000`. Nepieciešamas paša konfigurētas, izvēlētajam modelim atbilstošas cenas; tukšas vai nederīgas cenas dod `null`. Tā ir aptuvena tokenu izmaksu aplēse USD, nevis rēķins.

## Palaišana un konfigurācija

Precīzas atkarību instalēšanas, `.env`, API atslēgas, serveru un testu komandas uzturētas vienuviet: [README — uzstādīšana un palaišana](../../README.md#uzstādīšana-un-palaišana). Ikdienas darbam: `backend/serve.ps1`, otrā terminālī `frontend` mapē `npm.cmd run dev`, pārlūkā `http://127.0.0.1:5173`.

## Veiktās pārbaudes un rezultāti

| Pārbaude | Rezultāts |
| --- | --- |
| PHPUnit | 22 testi, 124 apgalvojumi — iziet |
| Frontend Node testi | 2 testi — iziet |
| Vite produkcijas būvējums | Izveidots veiksmīgi |
| Chrome darbvirsma | Īsta lokāla augšupielāde, automātisks ieteikums, 6 variantu sagatavošana, izvēle, obligāts privātuma apstiprinājums, imitēts maksas rezultāts, sākuma nulles, zināmā rādījuma salīdzinājums un priekšskatījuma anulēšana — iziet |
| Chrome mobilais skats 390×844 | Manuāla apgriešana, fragments, `null`, atkārtots mēģinājums, API kļūdas paziņojums un lapas platums — iziet |
| Reāls OpenAI API un īstas fotogrāfijas | Nav veikts: nebija nodrošinātas atslēgas un atļautas fotoattēlu kopas |

Backend testi faktiski pārbauda JPEG/PNG/WebP, 4000×3000 attēlu, manuālu fallback, apgriešanu pirms ārējā API, proporcijas visos sešos variantos, nepalielināšanu, korekciju izpildi, nepareizu perspektīvas četrstūri, bojātu/pārāk lielu failu, 24 MP robežu, nepareizas koordinātas, atteikšanos bez privātuma apstiprinājuma, trūkstošu API atslēgu, `null`, cenu aprēķinu, nezināmas cenas, lasījuma validāciju, 401/429/503, timeout, atteikumu, bojātu/nepabeigtu atbildi, pagaidu faila dzēšanu un 8 JPEG orientāciju izmērus. PNG/WebP TIFF orientācijas tagu nolasīšana ir atsevišķi pārbaudīta. Vienību orientācijas izmēru pārbaude pati par sevi nepierāda visu fotoattēlu metadatu variantu vizuālo pareizību.

API testos vienmēr tiek izmantotas imitācijas un aizliegti neimitēti HTTP pieprasījumi. Pārlūkā īsts ir tikai lokālais attēlu apstrādes API; atpazīšanas atbilde tiek pārtverta. Reāli OpenAI pieprasījumi un izmaksas testu laikā nav radušies.

### Faktiskais izmēra/kontrasta eksperiments

`tools/compare-variants.php` apstrādāja 2000×330 px fragmentu no pašu ģenerēta 4000×3000 sintētiska attēla. JPEG kvalitāte visos variantos 94.

| Malas limits | Kontrasts | Rezultāta izmērs | Baiti |
| --- | --- | --- | --- |
| 1024 | 0 | 1024×169 | 26688 |
| 1024 | 10 | 1024×169 | 25726 |
| 1600 | 0 | 1600×264 | 30819 |
| 1600 | 10 | 1600×264 | 32647 |
| 2048 | 0 | 2000×330 | 40523 |
| 2048 | 10 | 2000×330 | 44033 |

Proporcijas saglabātas ar pikseļu noapaļošanu, mazāks fragments netiek palielināts, kontrasts ne vienmēr samazina faila izmēru. Šie dati ir failu izmēra un apstrādes salīdzinājums. Ciparu salasāmības saglabāšana īstās fotogrāfijās un atpazīšanas precizitātes atšķirība starp variantiem vēl jāpārbauda. Paši variantu JPEG un CSV paliek ignorētajā `storage/app/test-fixtures/` mapē.

## Manuālās pieņemšanas plāns un atlikušais

Izmantojiet tikai atļautas fotogrāfijas. Katram attēlam ievadiet zināmo veselo m³ rādījumu kā tekstu un saglabājiet sākuma nulles. Atkārtojiet atlasītajiem 1024/1600/2048 un kontrasta variantiem, priekšskatījumā pārbaudot, vai nav zudušas vai mainītas ciparu kontūras. Sesijas tabula ļauj salīdzināt atbildes; katra atpazīšana ir atsevišķs maksas pieprasījums.

| Scenārijs | Kas jau izmēģināts | Vēl vajadzīgā īstā foto / MI pārbaude |
| --- | --- | --- |
| Skaidrs, labi apgaismots | Sintētisks fails; pilna lokālā plūsma un imitēts rādījums | Dažādu mehānisku un elektronisku skaitītāju precizitāte |
| Tumšs | Ģenerēts tumšs paraugs; gaišuma korekcijas izpilde | Gaišuma/kontrasta ietekme uz faktiskajiem cipariem |
| Slīps | Ģenerēts 6° paraugs; rotācija un perspektīvas transformācija darbojas | Perspektīvas punktu izvēle un rezultāta precizitāte īstam foto |
| Daļēji neskaidri cipari | Ģenerēts izplūdis paraugs; `null` plūsma imitēta | Pārliecināties, ka modelis atgriež `null`, neizdomā vērtību |
| Mehāniska cilindra pāreja | Vienkāršots sintētisks neskaidrības paraugs; konservatīva instrukcija | Īstas pārejas pozīcijas, arī ļoti pārliecinošu kļūdu risks |
| Mazs skaitītājs lielā foto | Ģenerēts 4000×3000 paraugs ar mazu lodziņu; oriģināla izgriešanas testi | Detektora aptvere un mazu ciparu salasāmība |
| Nederīgs vai >20 MB fails | Automatizēti noraidīts | Papildu telefonu kameru formātu paraugi, ja nepieciešams |
| API kļūda / nepieejamība | Automatizētas imitācijas un pārlūka kļūdas/retry | Īsta konta atļaujas un tīkla konfigurācija |

Automātiskais detektors nav universāls un nevar garantēt, ka nav izvēlējies citu tumšu etiķeti. Manuāla atlase ir pilnvērtīgs fallback. Nav automātiskas OCR/PII maskēšanas, automātiskas kvalitātes/lasāmības garantijas vai īstu pārejas cilindru precizitātes mērījumu. Visas korekcijas ir izvēles iespējas un lietotājam vizuāli jāpārbauda.

Trello #07 un #08 ir tehniski realizēti prototipa līmenī, bet galīgos pieņemšanas kritērijus par reālu atpazīšanu un salasāmības saglabāšanu nevar atzīmēt kā pierādītus bez īsta API izmēģinājuma un atļautām fotogrāfijām. Trello karšu statusi netika mainīti.
