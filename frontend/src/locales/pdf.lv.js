export default {
  create: 'Izveidot PDF',
  title: 'PDF eksports',
  close: 'Atcelt',
  preview: 'Priekšskatīt PDF',
  savePreview: 'Saglabāt un priekšskatīt PDF',
  download: 'Lejupielādēt PDF',
  includeInformation: 'Iekļaut dokumenta informācijas lapu',
  pageSize: 'Skenēto lapu formāts',
  a4: 'A4 — pielāgota orientācija',
  image: 'Pielāgots attēla proporcijām',
  quality: 'Attēla kvalitāte',
  high: 'Augsta',
  optimized: 'Optimizēta',
  qualityHint:
    'Augsta kvalitāte saglabā JPEG/PNG baitus, ja nav vajadzīga orientācijas vai izmēra korekcija. Lieliem attēliem — līdz 16 MP / 6000 px.',
  optimizedHint:
    'Optimizēta kvalitāte samazina attēlus līdz 4 MP / 2400 px un pārkodē JPEG. Sīks teksts un tabulu līnijas var kļūt grūtāk salasāmas. Pārbaudiet priekšskatījumu.',
  unsaved:
    'Pirms PDF izveides nesaglabātās sesijas izmaiņas tiks saglabātas. Ja saglabāšana neizdosies, PDF netiks ģenerēts.',
  unconfirmed:
    'Dokumenta informācija nav apstiprināta vai apstiprinājums ir novecojis. Lai iekļautu kartīti PDF, pārbaudiet un apstipriniet datus. Varat izvēlēties eksportēt tikai skenētās lapas.',
  review: 'Atgriezties pie datu pārbaudes',
  verified: 'Informācijas lapa ietver lietotāja pārbaudītos datus.',
  scansOnly: 'PDF ietver tikai skenētās lapas. Informācijas lapa nav pievienota.',
  informationPages: 'Informācijas lapas: {count}',
  pages: 'PDF lapas: {count}',
  size: 'Faila izmērs: {size} MiB',
  previewTitle: 'Sagatavotā PDF priekšskatījums',
  open: 'Atvērt PDF jaunā cilnē',
  fallback:
    'Ja iebūvētais PDF skats nav pieejams vai paliek tukšs, atveriet failu jaunā cilnē vai lejupielādējiet to.',
  noViewer:
    'Šis pārlūks nepiedāvā iebūvētu PDF priekšskatījumu. Atveriet sagatavoto failu jaunā cilnē vai lejupielādējiet to.',
  working: 'Veido PDF…',
  information: 'Sagatavo dokumenta informāciju…',
  images: 'Pievieno skenētās lapas: {completed}/{total}',
  saving: 'Sagatavo PDF failu…',
  resized:
    'Lielie attēli pielāgoti eksporta izšķirtspējas ierobežojumiem. Pārbaudiet sīkā teksta salasāmību.',
  privacy:
    'PDF izveido tikai šajā ierīcē. Skenētās lapas ir attēli; tajās nav meklējama OCR teksta slāņa.',
  errors: {
    options: 'Pārbaudiet PDF eksporta iestatījumus.',
    busy: 'Sagaidiet pašreizējās darbības pabeigšanu.',
    empty: 'Dokumentam nav lapu. Pievienojiet vismaz vienu lapu.',
    missingDocument: 'Dokuments vairs nav pieejams. Atveriet to vēlreiz.',
    confirmationRequired:
      'Lai iekļautu informācijas lapu, nepieciešams aktuāls lietotāja apstiprinājums.',
    sourceChanged:
      'Dokuments vai melnraksts ir mainīts. Šis PDF vairs neatbilst pašreizējai versijai. Atveriet aktuālo melnrakstu un izveidojiet priekšskatījumu vēlreiz.',
    image:
      'Neizdevās nolasīt pilna izmēra attēlu. Pārbaudiet lapu un vajadzības gadījumā saglabājiet to redaktorā vēlreiz.',
    imageLimit: 'Lapas attēls nav pieejams, ir tukšs vai pārsniedz 48 MiB.',
    limit:
      'PDF pārsniedz eksporta apjoma ierobežojumus. Izvēlieties optimizētu kvalitāti vai sadaliet dokumentu mazākās daļās.',
    font: 'Lokālais Unicode fonts nav pieejams. Ielādējiet lietotni ar interneta savienojumu un mēģiniet vēlreiz.',
    unsupportedCharacters:
      'Informācijas laukos ir simboli, kurus lokālais fonts neatbalsta, piemēram, emocijzīmes. Pārbaudiet laukus vai eksportējiet tikai skenētās lapas.',
    textLayout: 'Kādu informācijas lauka simbolu nevar izvietot tabulā. Pārbaudiet lauka saturu.',
    worker:
      'Neizdevās palaist lokālo PDF izveidi. Izmantojiet aktuālu Chrome vai Edge un mēģiniet vēlreiz.',
    timeout:
      'PDF izveide pārsniedza trīs minūtes. Izvēlieties optimizētu kvalitāti vai mazāk lapu.',
    cancelled: 'PDF izveide atcelta. Dokumenta dati nav mainīti.',
    memory: 'PDF izveidei nepietiek atmiņas. Izvēlieties optimizētu kvalitāti vai mazāk lapu.',
    generation: 'PDF izveide neizdevās. Dokumenta dati saglabāti; mēģiniet vēlreiz.',
    popup: 'Pārlūks neļāva atvērt jaunu cilni. Izmantojiet PDF lejupielādes pogu.',
  },
}
