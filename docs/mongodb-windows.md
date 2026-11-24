# MongoDB glabāšana Windows un VS Code

MongoDB glabā dokumentu datus un attēlus. Pārlūka IndexedDB glabā darba kopiju bezsaistes režīmam. Servera glabāšanu ieslēdz Laravel konfigurācijā un lietotnes iestatījumos.

## 1. Pārbaudi PHP un aktīvo konfigurāciju

Atver projekta mapi VS Code un palaid PowerShell termināli.

```powershell
Get-Command php, composer, node
php -v
php --ini
php -i | Select-String 'Architecture|Thread Safety|Compiler|extension_dir|upload_max_filesize|post_max_size'
```

`php --ini` rindā **Loaded Configuration File** norāda aktīvo `php.ini`. Composer un Laravel serverim izmanto vienu PHP instalāciju. Projektam vajag PHP 8.2 vai jaunāku 8.x versiju un Composer 2. Bloķētās versijas ir `mongodb/laravel-mongodb` 5.12.1 un `mongodb/mongodb` 2.5.1. Pēdējai vajag `ext-mongodb` 2.5.x. [Laravel MongoDB pakotne](https://packagist.org/packages/mongodb/laravel-mongodb) · [MongoDB PHP bibliotēka](https://packagist.org/packages/mongodb/mongodb)

## 2. Uzstādi MongoDB PHP paplašinājumu

1. Lejupielādē arhīvu, kura PHP versija, arhitektūra, TS/NTS un kompilators atbilst pārbaudes rezultātam. Piemēram, PHP 8.5 NTS, VS17, x64 instalācijai izvēlies 8.5 NTS, VS17, x86_64 arhīvu. [MongoDB PHP draivera laidieni](https://github.com/mongodb/mongo-php-driver/releases) · [PHP paplašinājuma instrukcija](https://www.php.net/manual/en/mongodb.installation.php)
2. Izvelc DLL PHP `extension_dir` mapē. Ja DLL nosaukumā ir versija, pārdēvē to par `php_mongodb.dll`.
3. Aktīvajā `php.ini` pievieno `extension=mongodb`. Lai pieņemtu lietotnē atļautos 25 MiB attēlus, iestati `upload_max_filesize = 25M` un `post_max_size = 26M` vai lielākas vērtības.
4. Pārbaudi paplašinājumu ar `php --ri mongodb` un `php -m | Select-String '^mongodb$'`. Pārstartē Laravel serveri, ja tas jau darbojas.

Ja Windows ziņo par bloķētu DLL, pārbaudi binārā faila atbilstību PHP instalācijai. Pārvaldītā datorā lūdz administratoram atļaut oficiālo draiveri.

## 3. Instalē Composer atkarības

No projekta saknes izpildi šīs komandas.

```powershell
cd backend
composer install
composer check-platform-reqs
if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    php artisan key:generate
}
```

Esošajā `.env` failā paturi jau iestatīto `APP_KEY`. Ja tā ir tukša, izpildi `php artisan key:generate`. Tīri lokālam režīmam bez PHP paplašinājuma vari izmantot `composer install --ignore-platform-req=ext-mongodb` un `DOCUMENT_STORAGE_ENABLED=false`.

## 4. Palaid vietējo MongoDB vai izveido Atlas savienojumu

**Vietējais serveris.** Izvēlies Windows x64 MongoDB Community Server MSI un instalē to kā Windows servisu. Pārbaudi servisa nosaukumu ar `Get-Service -Name '*Mongo*'`. Ja instalācijā lietots nosaukums `MongoDB` un serviss ir apturēts, palaid to no administratora PowerShell ar `Start-Service -Name MongoDB`. Lokālā MongoDB konfigurācijā lieto `bindIp: 127.0.0.1`. Portu pārbaudi ar `Test-NetConnection 127.0.0.1 -Port 27017`. [MongoDB Community Server instalēšana Windows](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows/)

Ar ZIP instalāciju atver termināli MongoDB `bin` mapē un norādi sev piederošu datu mapi.

```powershell
$mongoData = Join-Path $env:LOCALAPPDATA 'GASO-MongoDB'
New-Item -ItemType Directory -Force $mongoData | Out-Null
.\mongod.exe --dbpath $mongoData --bind_ip 127.0.0.1 --port 27017
```

**MongoDB Atlas.** Izveido klasteri un datubāzes lietotāju ar `readWrite` piekļuvi tikai GASO datubāzei. IP piekļuves sarakstā pievieno datora publisko IP un kopē lietotnes `mongodb+srv://` savienojuma virkni. Paroles URI rezervētās rakstzīmes kodē procentu formātā. Atlas glabās dokumentus un fotoattēlus izvēlētajā mākoņa klasterī. [Atlas savienojuma iestatīšana](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/)

## 5. Konfigurē un pārbaudi Laravel

Pievieno šos iestatījumus esošajam `backend/.env` failam. Atlas gadījumā norādi sava klastera URI un datubāzi, kurai lietotājam piešķirta piekļuve.

```dotenv
APP_ENV=local
DOCUMENT_STORAGE_ENABLED=true
DOCUMENT_STORAGE_DRIVER=mongodb
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=gaso_document_ai
```

URI un paroles glabā lokālajā `.env`. Dokumentu krātuve izmanto atsevišķu `mongodb` savienojumu. Paturi esošo Laravel `DB_CONNECTION` vērtību.

```powershell
php artisan config:clear
php artisan document-storage:check --indexes
php artisan serve --host=127.0.0.1 --port=8000
```

Veiksmīgs savienojums parāda `mongodb: connected`. `storage_not_configured` norāda uz nepilnīgu konfigurāciju, `storage_driver_missing` — uz neielādētu PHP draiveri, `storage_unavailable` — uz savienojuma kļūmi. Atlas gadījumā pārbaudi IP sarakstu, datubāzes lietotāju un URI.

Ubuntu WSL2 izstrādes vidē palaid Laravel ar vairākiem PHP darbiniekiem, lai attēlu pieprasījumi varētu izpildīties vienlaikus. Laravel opcija `--no-reload` ļauj izmantot `PHP_CLI_SERVER_WORKERS`. PHP iebūvētā servera vairāku darbinieku režīms ir pieejams Linux, tostarp WSL2. [PHP iebūvētā servera dokumentācija](https://www.php.net/manual/en/features.commandline.webserver.php)

Ja MongoDB paplašinājums ir uzstādīts Ubuntu WSL2, Laravel palaid Ubuntu terminālī. Pirms palaišanas apturi šī projekta Windows Laravel procesu, ja tas izmanto portu `8000`. Pārlūka Vite starpnieks izmanto šo portu, un Windows process bez paplašinājuma atgriež `storage_driver_missing`.

```bash
cd backend
PHP_CLI_SERVER_WORKERS=4 php artisan serve --host=127.0.0.1 --port=8000 --no-reload
```

MongoDB PHP draiveris atkārtoti izmanto tā paša darbinieka savienojumu, ja savienojuma virkne un opcijas sakrīt. [MongoDB PHP klienta dokumentācija](https://www.mongodb.com/docs/php-library/current/connect/client/#client-persistence)

Vue pēc noklusējuma izmanto līdz četriem vienlaicīgiem attēlu pieprasījumiem. Vite izstrādes vai būvēšanas vidē ar `VITE_STORAGE_IMAGE_CONCURRENCY=2` vai `3` var iestatīt mazāku robežu.

Citā VS Code terminālī no projekta saknes palaid Vue.

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Atver **http://127.0.0.1:5173**. Ja esošie dokumenti saglabāti, piemēram, **http://localhost:5173**, migrācijai lieto to pašu adresi un pārlūka profilu. IndexedDB katram protokolam, resursdatora nosaukumam un portam ir atsevišķa. Ja IndexedDB versijas atjauninājumu bloķē cita cilne, aizver iepriekšējās lietotnes cilnes un pārlādē lapu.

## 6. Saglabā un atjauno dokumentu

1. Atver **Iestatījumi → Datu glabāšana** un pārbaudi statusu **Savienots ar MongoDB**.
2. Ieslēdz **Sinhronizēt turpmākās izmaiņas ar MongoDB** un apstiprini. Iepriekš saglabātajiem dokumentiem vari lejupielādēt lokālo rezerves kopiju, pēc tam izvēlies **Migrēt lokālos dokumentus** un apstiprini.
3. Nofotografē vai importē testa dokumentu. Ievadi rekvizītus manuāli vai ar piekrišanu izmanto konfigurēto AI analīzi. Apstiprini dokumentu, saglabā un pēc vajadzības pievieno komplektam.
4. Dokumenta kartītē pārbaudi **Saglabāts serverī**. Savienojuma pārtraukuma laikā ieraksti paliek ierīcē. Rindu atkārto pēc savienojuma atjaunošanas vai ar **Sinhronizēt tagad**.
5. MongoDB Compass izmanto to pašu URI. Datubāzē `gaso_document_ai` atver sesiju `scan_sessions` un pārbaudi `pageKeys` saites uz `document_pages`. Lapas `original.gridId` sakrīt ar faila `_id` kolekcijā `document_images.files`. Kontrolsummas ir arī `image_assets`, bet baiti atrodas `document_images.chunks`. [MongoDB Compass savienojums](https://www.mongodb.com/docs/compass/connect/)
6. Atjaunošanas pārbaudei atver lietotni jaunā pārlūka profilā un nospied **Atjaunot no MongoDB**. Atver dokumentu vai komplektu un izveido PDF. Attēli pirms ierakstīšanas IndexedDB tiek pārbaudīti, tāpēc pēc atjaunošanas PDF var veidot arī bez servera.

Atjaunošana pievieno trūkstošās sesijas un komplektus. Atšķirīgas esošo ierakstu revīzijas parādās sadaļā **Datu konflikti**. Izvēlies ierīces vai servera versiju. Pirms aizstāšanas vari izveidot rezerves kopiju. Dzēšana ar izslēgtu sinhronizāciju attiecas uz ierīces kopiju.

Sinhronizācijas josla skaita apstiprinātos attēlus un publicētās revīzijas. Baitu skaitītājs rāda servera apstiprināto augšupielādēto attēlu apjomu. **Apturēt sinhronizāciju** saglabā pauzi arī pēc lapas pārlādēšanas. Ar **Turpināt sinhronizāciju** lietotne pārbauda, kuri attēli jau ir serverī, un apstrādā atlikušos ierakstus. Dokumentus var rediģēt arī pārsūtīšanas laikā.

## 7. Rezerves kopijas

**Ierīces kopija.** Iestatījumos lejupielādē `.gaso-backup` un saglabā to privātā mapē. Kopijā ir IndexedDB metadati, atsauces un lokālie attēlu baiti. Importam atver lietotni tukšā pārlūka profilā un izvēlies **Atvērt lokālo rezerves kopiju**.

**MongoDB kopija.** Instalē MongoDB Database Tools. Uz kopijas laiku apturi Laravel, lai arhīvā būtu vienots datu stāvoklis. Arhivē pilnu datubāzi kopā ar GridFS iegultajiem failiem. Piemērs lokālajam serverim.

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
mongodump --uri 'mongodb://127.0.0.1:27017' --db gaso_document_ai --gzip --archive=backups/gaso.archive.gz
mongorestore --uri 'mongodb://127.0.0.1:27017' --gzip --archive=backups/gaso.archive.gz --nsFrom='gaso_document_ai.*' --nsTo='gaso_document_ai_restore.*'
```

Atjaunošanas komanda pārbauda kopiju atsevišķā datubāzē. Pielāgo datubāzes nosaukumus savai konfigurācijai. Atlas gadījumā izmanto klastera rezerves kopijas, ja tās ir pieejamas, vai Database Tools ar privātu konfigurāciju. [mongodump](https://www.mongodb.com/docs/database-tools/mongodump/) · [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/)

## 8. Datu modelis un API

| MongoDB kolekcija | Saturs |
| --- | --- |
| `scan_sessions` | Sesijas ID, datumi, shēma, servera revīzija, kā arī sakārtotas `pageKeys` un `documentKeys` saites uz publicētajām lapām un dokumentiem. |
| `documents` | Sesijas un dokumenta ID, revīzija un `data` ar lapu secību, rekvizītiem, manuālajiem labojumiem, AI metadatiem un apstiprinājumu. |
| `document_pages` | Sesijas vai momentuzņēmuma ID, dokumenta ID, pozīcija, lapas metadati un oriģināla, apstrādātā attēla un sīktēla deskriptori. |
| `document_collections` | Komplekta ID, nosaukums, sakārtoti momentuzņēmumu ID un saites, datumi un revīzija. |
| `saved_documents` | Neatkarīgi momentuzņēmumi ar sākotnējā dokumenta ID, fiksētu apstiprinājumu, datumu un lapu saitēm. |
| `image_assets`, `document_images.files`, `document_images.chunks` | SHA-256 katalogs, GridFS failu metadati un fotoattēlu baiti. Vienāda satura attēli koplieto failu. |

API prefikss ir `/api/storage/v1`. Pieprasījumiem vajag `X-GASO-Storage: 1`, rakstīšanai arī atļautu lokālo `Origin`. Vite pārsūta API pieprasījumus no localhost. Kļūdas atgriež ar strukturētu `error.code`.

| Metode un ceļš | Darbība |
| --- | --- |
| `GET /status` | Pārbaudīt konfigurāciju un savienojumu. |
| `GET /sessions`, `GET /collections` | Uzskaitīt līdz 100 ierakstiem ar `after` kursoru. |
| `GET /sessions/{id}`, `GET /collections/{id}` | Ielādēt datus. Ar `summary=1` saņem revīzijas kopsavilkumu. |
| `PUT /sessions/{id}`, `PUT /collections/{id}` | Izveidot vai publicēt jaunu revīziju, tostarp mainīt komplekta dokumentu secību. |
| `GET /sessions/{id}/documents`, `GET /sessions/{id}/documents/{documentId}` | Ielādēt sesijas dokumentus. |
| `PUT /sessions/{id}/documents/{documentId}` | Saglabāt dokumenta metadatus jaunā sesijas revīzijā. |
| `PUT /collections/{id}/documents/{snapshotId}`, `DELETE /collections/{id}/documents/{snapshotId}` | Pievienot vai izņemt momentuzņēmumu. |
| `POST /assets/check` | Pārbaudīt līdz 200 unikālām SHA-256 kontrolsummām laukā `hashes`. Atbildē `assets` satur pārbaudītos deskriptorus, `invalid` satur bojāto atsauču kontrolsummas. Trūkstošās kontrolsummas nav nevienā sarakstā. |
| `POST /assets/{sha256}` | Augšupielādēt attēlu laukā `image` ar `multipart/form-data`. |
| `GET /assets/{sha256}`, `GET /images/{sha256}` | Pārbaudīt deskriptoru vai straumēt attēlu. |
| `DELETE /sessions/{id}`, `DELETE /collections/{id}` | Publicēt dzēšanas atzīmi ar revīziju. |

Rakstot norāda `expectedRevision` (jaunam ierakstam 0), `mutationId` un objektu `payload` (izņemot dzēšanu). Sesijas saturs ir `{metadata, pages, documents}`, komplekta saturs — `{metadata, documents: [{metadata, pages}]}`. Lapa satur `metadata`, `imageRecordId`, `original` un pēc vajadzības `processed` un `thumbnail`. Sesijas attēla ieraksta ID ir lapas ID. Komplekta momentuzņēmuma attēla ierakstam ir formāts `<lapas ID>:saved:<unikālais ID>`, lai tas būtu atsevišķs no darba kopijas atsauces. Augšupielādētā attēla deskriptoram rakstot pietiek ar `{sha256, size}`. API pirms saknes revīzijas atomāras publicēšanas pārbauda visas atsauces. PDF izmanto pdf-lib pārlūkā.

Attēlu formāti ir JPEG, PNG un WebP. Limits ir 25 MiB failam, 40 miljoni pikseļu un 16 000 pikseļu vienā malā. Metadatu pieprasījuma limits ir 8 MiB.

Dzēšana maina aktīvo sarakstu, un attēli ar esošām saitēm paliek glabāšanā. Ar `php artisan document-storage:inspect-uploads` vari pārbaudīt vismaz dienu vecas nepabeigtas GridFS augšupielādes. Karogs `--include-unlinked` ietver arī attēlus, kuru augšupielāde pabeigta, bet kuriem trūkst lapas sasaistes. Lai tīrītu, vispirms izveido kopiju, apturi visus rakstītājus un ieslēdz uzturēšanas režīmu ar `php artisan down`. Pārbaudes komandai pievieno `--apply` un pēc tīrīšanas izpildi `php artisan up`. Komanda pārbauda attēlu katalogu un visu lapu versiju saites. Glabāšanas vietu plāno arī iepriekšējām lapu un dokumentu versijām.

## 9. Integrācijas testi

Izmanto testa MongoDB izvietojumu. Katrs Laravel scenārijs izveido nejauši nosauktu `gaso_storage_test_…` datubāzi, glabā sintētiskus datus un beigās dzēš savu testa datubāzi.

```powershell
$env:DOCUMENT_STORAGE_TEST_URI = 'mongodb://127.0.0.1:27017'
php artisan test --filter=MongoDocumentStorageTest
Remove-Item Env:DOCUMENT_STORAGE_TEST_URI
```

Piekļuves un konfigurācijas testi darbojas bez MongoDB. Playwright imitē Storage API un pārbauda īsto IndexedDB, saskarni un PDF ģenerēšanu.
