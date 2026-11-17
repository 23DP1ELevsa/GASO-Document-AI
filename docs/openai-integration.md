# 7. posms: OpenAI dokumentu analīze

> Šis ir vēsturisks 7. posma pārskats. Pašreizējā versija izmanto fotoattēlus, dinamiskus atribūtus un saglabātus komplektus. Skatiet [aktuālo arhitektūru un konfigurāciju](vision-architecture.md) un [testu rezultātus](testing/vision-collections.md). OCR instrukcijas zemāk vairs nav aktīvās saskarnes instrukcija.

Šī ir lokālās izstrādes integrācija. Personīgais OpenAI API paredzēts tikai sintētiskiem vai nosūtīšanai apstiprinātiem izstrādes/testēšanas datiem. Reālus GASO dokumentus drīkst nosūtīt tikai pēc atsevišķas uzņēmuma atļaujas.

## Priekšnoteikumi un palaišana

Nepieciešams PHP 8.2+ ar Laravel un Composer prasītajiem paplašinājumiem: ctype, curl, dom, fileinfo, filter, hash, mbstring, openssl, pcre, PDO, session, tokenizer, xml un zip (Composer arhīviem). Instalējiet PHP no [PHP for Windows](https://windows.php.net/download/) un [Composer](https://getcomposer.org/download/), pievienojiet PATH un pārbaudiet `php -v`, `php -m`, `composer --version`. PHPUnit vajadzīgs arī xmlwriter. MongoDB un datubāzes migrācijas šim galapunktam nav vajadzīgas.

Pārbaudītā vide: PHP 8.5.6, Composer 2.9.8, Node.js 24.15.0. `composer.json` platforma 8.2.0 fiksē atkarības, kas savietojamas ar PHP 8.2; faktiskā izpilde šajā datorā pārbaudīta ar 8.5.6. Laravel versija ir 12.72.0. Node.js minimums ir 22.13.

Pirmajā PowerShell terminālī no projekta saknes:

```powershell
cd backend
composer install
# Izpildiet tikai tad, ja lokālais .env vēl neeksistē:
Copy-Item .env.example .env
php artisan key:generate
php artisan serve --host=127.0.0.1 --port=8000
```

Neaizstājiet jau konfigurētu `.env`. Šajā darba vidē izveidots lokāls `.env` ar ģenerētu Laravel atslēgu, AI izslēgts un OpenAI atslēga tukša. Nekāda API atslēga netika pieprasīta vai izmantota.

Otrajā terminālī:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Atveriet **http://localhost:5173**. Vite pārsūta `/api` uz `127.0.0.1:8000`; tas pats darbojas `npm.cmd run build` + `npm.cmd run preview` adresē `http://localhost:4173`. Nav vajadzīgs frontend `.env` vai CORS atļauja. Pēc Vite konfigurācijas maiņas restartējiet serveri. Pirms `npm ci` apturiet Vite, lai Windows nebloķētu Rolldown failu. AI darbojas tikai datora localhost; LAN UI apskate joprojām iespējama, bet tās AI pieprasījumus Vite bloķē. Android savienojums šajā posmā nav ieviests.

## Ieslēgšana

Rediģējiet **tikai `backend/.env`** savā lokālajā redaktorā:

```dotenv
DOCUMENT_AI_PROVIDER=openai
DOCUMENT_AI_ENABLED=true
OPENAI_API_KEY=
OPENAI_MODEL=gpt-6-luna
OPENAI_TIMEOUT=60
DOCUMENT_AI_MAX_OUTPUT_TOKENS=4000
DOCUMENT_AI_REQUESTS_PER_MINUTE=3
DOCUMENT_AI_TEST_REQUEST_LIMIT=20
```

`OPENAI_API_KEY` tukšās vērtības vietā ievietojiet savu OpenAI Platform projekta atslēgu. Nekad nekopējiet to Vue/Vite `VITE_*` mainīgajos, Android, ekrānattēlos, testos vai repozitorijā. `.env` izslēdz projekta `.gitignore`. Pēc izmaiņām: `php artisan config:clear`; pēc tam restartējiet backend. `APP_DEBUG=false` jāpaliek izslēgtam. Modeļa pieejamību jūsu API projektam pārbaudiet OpenAI Platform; kļūmes gadījumā cita modeļa/pakalpojuma automātiska izvēle nenotiek.

## Lietošana un datu plūsma

1. Pievienojiet attēlus un manuāli sakārtojiet atsevišķus dokumentus.
2. Datu solī izvēlieties **Lokālā analīze** (noklusējums) vai **AI analīze (OpenAI)**.
3. AI režīmā izlasiet datu pārsūtīšanas skaidrojumu un atzīmējiet piekrišanu konkrētajam dokumentam. Izvēle un piekrišana netiek saglabāta melnrakstā; mainot dokumentu/režīmu, piekrišana jāsniedz no jauna.
4. Nospiediet **Atpazīt dokumentu**. Vajadzības gadījumā vispirms notiek lokāls OCR; tad nosūta tikai izvēlētā dokumenta sakārtotos lapu tekstus, nejaušus lapu ID un secības numurus. Attēli, failu nosaukumi, iepriekšējie labojumi, apstiprinājumi un `sourceVersion` uz serveri netiek sūtīti.
5. Esošajās kartītēs pārbaudiet un pieņemiet ieteikumus vai labojiet laukus. AI nepārraksta `document.values`, `editedFields` un apstiprinājuma vēsturi. Pēc apstiprināšanas PDF izmanto pašus skenējumus un lietotāja apstiprinātos laukus.

Lokālā analīze darbojas bez backend vai API atslēgas un neizsauc ārējus pakalpojumus. Bez interneta AI kļūme piedāvā **Turpināt ar lokālo analīzi**; pāreja notiek tikai ar lietotāja izvēli. Lokālam OCR bezsaistē iepriekš sagatavojiet valodu modeļus iestatījumos.

IndexedDB shēmas versija un veco melnrakstu migrācija nav mainīta. `document.analysis` glabā `provider`, `analyzedAt`, precīzo `source` versiju un `result` ar tipu, atribūtiem, lapu fragmentiem, brīdinājumiem un `requires_review: true`. Lapu secības, piederības, attēla vai OCR teksta izmaiņas padara veco analīzi neaktuālu ar esošo `isAnalysisStale`; apstiprinājumu pārbauda esošais `isConfirmationCurrent`. Arī izmaiņas gaidoša AI pieprasījuma laikā tiek pārbaudītas pirms rezultāta piesaistīšanas. Oriģinālo OCR tekstu AI nemaina.

## API līgums

`POST /api/document-analysis`, JSON, piemēram:

```json
{"consent":true,"pages":[{"id":"synthetic-page-1","number":1,"text":"INVOICE Nr. SYN-001\nSeller: Synthetic Seller\nTotal: 125.50 EUR"}]}
```

Pieņem tikai `consent` un `pages`; lapās tikai `id`, `number`, `text`. ID ir unikāli, numuri secīgi no 1. Nezināmas atslēgas, attēli, nepareiza secība, tukšs kopējais teksts un pārsniegti limiti tiek noraidīti. Fotogrāfiju režīma nav. Atbilde ir `{ "result": ... }` esošajā frontend ieteikumu formātā vai `{ "error": { "code": "..." } }`; atbildēs nav atslēgas vai upstream kļūdu teksta.

Laravel HTTP klients izsauc fiksētu `POST https://api.openai.com/v1/responses`, Bearer autentifikāciju, `store:false`, `text.format.type=json_schema`, `strict:true`, bez rīkiem, sarunas vēstures un automātiskiem atkārtojumiem. [Oficiālā GPT-6 Luna modeļa lapa](https://developers.openai.com/api/docs/models/gpt-6-luna) pārbaudīta pirms implementācijas: Responses API un Structured Outputs ir atbalstīti. [Structured Outputs prasības](https://developers.openai.com/api/docs/guides/structured-outputs) prasa slēgtus objektus un visus obligātos laukus; tāpēc atsevišķo saderīgo shēmu ģenerē `backend/app/DocumentAi/AnalysisSchema.php`. Pilnā vēsturiskā OCR shēma ar koordinātām un paplašināmiem laukiem netiek sūtīta modelim. Tests pārbauda shēmas kataloga atbilstību frontend katalogam.

Backend atkārtoti validē zināmos laukus un tipus, normalizē datumus un summas; nenoteiktus datumus un neviennozīmīgas summas atmet uz `null` ar brīdinājumu. Nesajauc nosūtītāju/saņēmēju, neto/PVN/bruto/atlikumu. Pierādījumu fragmentiem precīzi jāsakrīt ar tās pašas lapas OCR apakšvirkni un ID/numuru; izdomātus fragmentus atmet. Koordinātas netiek ģenerētas. Precīzs citāts pats par sevi negarantē AI interpretācijas pareizību; cilvēka pārbaude vienmēr obligāta.

## Drošība un izmaksas

- Servera noklusējums ir `local` un `false`; atslēgas trūkums dod `not_configured` bez ārēja pieprasījuma.
- AI galapunkts pārbauda lokālu vidi, tiešo loopback IP, Host un Origin. Laravel proxy galvenes netiek uzticētas. Vite atsevišķi pārbauda sākotnējā savienojuma IP un Host. Neizmantojiet tuneļus vai portu pārsūtīšanu.
- Produkcijas vidē galapunkts vienmēr atgriež 403. Pirms izvietošanas jāievieš Sanctum autentifikācija, pilnvarojums un kvotas katram lietotājam, tad jāaizstāj `DocumentAiAccess`. Pilna reģistrācija šeit nav ieviesta; neizslēdziet šo aizsardzību tikai API publiskošanai.
- Maksimums: **20 lapas**, **60 000 OCR rakstzīmju kopā**, **262 144 JSON baiti**, **4000 atbildes tokenu** (konfigurējams, kodā griesti 8000), **3 pieprasījumi minūtē** (konfigurējams). Timeout 60 sekundes, savienojumam 10; frontend gaida 70 sekundes. Ja servera timeout mainīts virs 60, jāsaskaņo frontend gaidīšanas laiks.
- Tā paša sakārtotā teksta atkārtojums bloķēts **120 sekundes**, arī mainot lapu ID. Glabā tikai ar Laravel atslēgu HMAC aizsargātu nospiedumu, nevis tekstu. Viena kritiskā sekcija ar cache lock rezervē kvotu pirms pieprasījuma.
- `DOCUMENT_AI_TEST_REQUEST_LIMIT=20` ierobežo kopējo rezervēto ārējo mēģinājumu skaitu, ieskaitot kļūmes. Skaitītājs dzīvo failu kešā un izdzīvo procesa restartu; nav dienas automātiskas atiestates. `0` aizliedz ārējos mēģinājumus. Pēc budžeta pārbaudes skaitītāju var apzināti atiestatīt ar `php artisan tinker --execute="Illuminate\Support\Facades\Cache::forget('document-ai-requests');"`. `cache:clear` arī atiestatītu kvotu un atkārtojumu aizsardzību; nelietojiet to, lai apietu budžetu. Neizmantojiet `array` kešu reālai lokālai AI lietošanai.
- Skaitliskus `input_tokens`, `output_tokens`, `total_tokens` saglabā `document_ai.usage` ierakstos `backend/storage/logs/laravel.log`, arī nepabeigtām atbildēm, ja metadati saņemti. Atbildes metadati saglabājas arī analīzes rezultātā. Pilnus pieprasījumus/atbildes, kļūdu objektus, OCR, attēlus un atslēgas nežurnalē. API neparedzētu kļūdu detalizētā žurnalēšana apzināti izslēgta; klientam sniedz drošu kodu. Neieslēdziet HTTP debug, Telescope vai ārēju pieprasījumu žurnalētāju ar sensitīvu saturu.

Šie ierobežojumi **negarantē 5 USD naudas griestus**. Pirms ieslēgšanas [OpenAI Platform](https://platform.openai.com/) pārbaudiet aktuālās modeļa cenas, sava projekta pieejamību, API limitus, kvotas un tēriņu paziņojumus; samaziniet testa pieprasījumu limitu atbilstoši budžetam. Reāls AI kvalitātes vai izmaksu mērījums šajā uzdevumā nav veikts.

`store:false` izslēdz Responses atbildes lietotnes stāvokļa saglabāšanu, bet **nenozīmē visu pakalpojuma datu glabāšanas režīmu izslēgšanu**. OpenAI ļaunprātīgas izmantošanas uzraudzības un organizācijas datu kontroles nosacījumi jāvērtē atsevišķi; skatīt [oficiālo datu kontroles dokumentāciju](https://developers.openai.com/api/docs/guides/your-data).

## Pārbaudes

```powershell
cd backend
php artisan test
cd ../frontend
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test:e2e
```

Laravel visā testu komplektā aizliedz neimitētus HTTP pieprasījumus (`Http::preventStrayRequests`). API testi izmanto tikai sintētiskus datus un `Http::fake`. Jaunajos Playwright testos backend atbildes imitē un tiešu OpenAI piekļuvi bloķē. Vienībtestos aizvieto `fetch`. Īsta atslēga pārbaudēm nav nepieciešama. Pārlūka testiem nepieciešams instalēts Chrome.

Rezultāti un pārbaudītie scenāriji: [7. posma pārbaudes](testing/openai-integration.md).
