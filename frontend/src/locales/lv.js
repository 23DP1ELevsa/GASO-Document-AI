export default {
  app: {
    name: 'GASO Document AI',
    shortName: 'Document AI',
    brand: 'GASO',
    prototype: 'Izstrādes versija',
    version: 'Versija',
    local: 'Lokālais režīms',
    offline: 'Bez interneta',
    skip: 'Pāriet uz saturu',
    navigation: 'Galvenā navigācija',
    workspace: 'Jūsu dokumentu darbvieta',
    footer: 'Sakārtoti dokumenti. Skaidrs pārskats.',
    storageWarning:
      'Pārlūks neļauj saglabāt iestatījumus. Izvēlētais režīms darbosies līdz lapas aizvēršanai.',
  },
  nav: { home: 'Sākums', scan: 'Skenēt', documents: 'Dokumenti', settings: 'Iestatījumi' },
  common: {
    soon: 'Drīzumā pieejams',
    planned: 'Plānots',
    scan: 'Skenēt dokumentu',
    allDocuments: 'Visi dokumenti',
    localTitle: 'Jūsu ierīcē. Jūsu pārziņā.',
    localDescription:
      'Attēli un melnraksti tiek glabāti šīs pārlūkprogrammas IndexedDB krātuvē. Tie netiek nosūtīti ārējiem pakalpojumiem. Pārlūka datu dzēšana izdzēsīs arī melnrakstus; tā nav rezerves kopija.',
    localShort: 'Saskarne darbojas neatkarīgi no servera.',
    next: 'Nākamajos posmos',
    learnMore: 'Par lokālo režīmu',
  },
  home: {
    eyebrow: 'MAZĀK PAPĪRA. VAIRĀK SKAIDRĪBAS.',
    title: 'Dokumentu kārtība sākas šeit.',
    description:
      'Viena vieta dokumentu digitalizācijai. No pirmā attēla līdz pārskatāmam dokumentu arhīvam.',
    scanHint: 'Fotografējiet vai pievienojiet attēlus no ierīces',
    recent: 'Jūsu melnraksti',
    recentSubtitle: 'Lokāli saglabātās skenēšanas sesijas.',
    draftSummary: 'Saglabātie melnraksti: {count}',
    emptyTitle: 'Viss sākas ar pirmo dokumentu',
    emptyDescription:
      'Pievienojiet dokumenta attēlus un saglabājiet pirmo skenēšanas sesiju kā melnrakstu.',
    workflow: 'No papīra līdz digitālam dokumentam',
    workflowSubtitle: 'Iecerētā dokumenta apstrāde — soli pa solim.',
    capture: 'Uzņemiet',
    captureText: 'Fotografējiet vienu vai vairākas dokumenta lapas.',
    recognize: 'Atpazīstiet',
    recognizeText: 'Lokāls OCR palīdzēs iegūt tekstu no attēla.',
    organize: 'Saglabājiet',
    organizeText: 'Pārbaudiet rezultātu un izveidojiet PDF dokumentu.',
    illustration: 'Dokumenta ilustrācija',
  },
  scan: {
    eyebrow: 'JAUNS DOKUMENTS',
    title: 'Dodiet papīram digitālu dzīvi.',
    description:
      'Pievienojiet lapas, sakārtojiet tās un saglabājiet skenēšanas sesiju savā ierīcē.',
    camera: 'Fotografēt',
    gallery: 'Pievienot no galerijas',
    preview: 'Lapu priekšskatījums',
    noPages: 'Pagaidām nav pievienotu lapu',
    noPagesText: 'Fotografējiet dokumentu vai pievienojiet vienu vai vairākus attēlus no ierīces.',
    importTitle: 'Pievienojiet dokumenta lapas',
    cameraHint:
      'Tālrunī pārlūks var piedāvāt aizmugurējo kameru. Ja tā nav pieejama, izvēlieties attēlu no ierīces. Datorā atvērsies failu izvēle.',
    limits: 'JPEG, PNG vai WebP · līdz 25 MiB un 40 MP attēlam · līdz 20 lapām un 200 MiB sesijā.',
    pageCount: 'Lapas: {count}',
    pageNumber: '{number}. lapa',
    pageActions: '{number}. lapas darbības',
    moveUp: 'Pārvietot {number}. lapu uz augšu',
    moveDown: 'Pārvietot {number}. lapu uz leju',
    openPreview: 'Atvērt {number}. lapas priekšskatījumu',
    closePreview: 'Aizvērt priekšskatījumu',
    originalPreview: 'Oriģinālā attēla priekšskatījums',
    originalUnchanged:
      'Oriģinālais attēls tiek saglabāts bez pārkodēšanas. Priekšskatījumam tiek izmantota attēlā norādītā orientācija.',
    replace: 'Aizstāt attēlu',
    removePage: 'Dzēst lapu',
    newSession: 'Jauna sesija',
    deleteSession: 'Dzēst sesiju',
    save: 'Saglabāt melnrakstu',
    unsaved: 'Ir nesaglabātas izmaiņas',
    savedState: 'Melnraksts saglabāts',
    newState: 'Jauna skenēšanas sesija',
    saved: 'Melnraksts sekmīgi saglabāts šajā pārlūkprogrammā.',
    added: 'Pievienotās lapas: {count}. Saglabājiet izmaiņas, lai tās būtu pieejamas pēc pārlādes.',
    replaced: 'Attēls aizstāts. Saglabājiet melnraksta izmaiņas.',
    deleted: 'Sesija izdzēsta.',
    confirmDiscard:
      'Sesijā ir nesaglabātas izmaiņas. Vai atmest tās un atvērt citu sesiju? Saglabātais melnraksts netiks dzēsts.',
    confirmDelete: 'Vai dzēst visu sesiju un tās saglabātos attēlus? Šo darbību nevar atsaukt.',
    localTitle: 'Melnraksti paliek šajā pārlūkprogrammā',
    localInfo:
      'Saglabāšana ir lokāla, bez servera un MI. Pārlūka datu dzēšana izdzēsīs melnrakstus. Citā pārlūkā vai adresē tie nebūs pieejami.',
    unsavedHint:
      'Izmaiņas, arī lapu dzēšana un secība, tiek ierakstītas krātuvē, nospiežot “Saglabāt melnrakstu”. Nesaglabātas izmaiņas pēc pārlādes zudīs.',
    loading: 'Ielādē…',
    working: 'Apstrādā…',
    retry: 'Mēģināt vēlreiz',
    errors: {
      fileType:
        'Neatbalstīts faila formāts vai saturam neatbilstošs faila tips. Izvēlieties JPEG, PNG vai WebP. HEIC, SVG, GIF un PDF netiek atbalstīti.',
      fileSize: 'Attēls ir tukšs vai pārsniedz 25 MiB. Izvēlieties mazāku failu.',
      dimensions: 'Attēls pārsniedz 40 megapikseļus vai 16 000 pikseļus vienā malā.',
      decode: 'Attēlu nevar atvērt. Fails var būt bojāts vai šis attēla variants nav atbalstīts.',
      pageLimit:
        'Sesijā var būt ne vairāk kā 20 lapas. Saglabājiet šo sesiju un izveidojiet jaunu.',
      sessionSize: 'Sesijas attēlu kopējais izmērs nedrīkst pārsniegt 200 MiB.',
      storage:
        'Lokālā krātuve nav pieejama vai darbība neizdevās. Izmaiņas nav saglabātas. Pārbaudiet pārlūka datu glabāšanas iestatījumus un mēģiniet vēlreiz.',
      storageBlocked:
        'Lokālās krātuves atvēršana ir bloķēta. Aizveriet citas šīs lietotnes cilnes un mēģiniet vēlreiz.',
      quota:
        'Ierīcē nepietiek vietas melnrakstam. Izmaiņas nav saglabātas; atbrīvojiet vietu vai samaziniet lapu skaitu un mēģiniet vēlreiz.',
      conflict:
        'Melnraksts ir mainīts vai dzēsts citā cilnē. Izmaiņas nav saglabātas. Saglabāto versiju atveriet no dokumentu sadaļas pēc pašreizējo izmaiņu atmešanas.',
      missingDraft:
        'Melnraksts nav atrasts. Tas, iespējams, ir dzēsts. Izveidojiet jaunu sesiju vai atveriet citu melnrakstu.',
      missingImage: 'Melnraksta attēls nav pieejams. Mēģiniet atvērt melnrakstu vēlreiz.',
      empty: 'Pirms saglabāšanas pievienojiet vismaz vienu lapu.',
      busy: 'Sagaidiet pašreizējās darbības pabeigšanu.',
      invalidQuad:
        'Stūriem jāveido izliekts, nepārkrustojošs četrstūris attēla robežās. Koriģējiet koordinātas vai atiestatiet stūrus.',
      processingUnavailable:
        'Šajā pārlūkā nevar palaist lokālo attēlu apstrādi. Izmantojiet aktuālu Chrome vai Edge un pārbaudiet Worker atļaujas.',
      processingFailed:
        'Attēla apstrāde neizdevās. Oriģināls un sesija nav mainīti. Mēģiniet vēlreiz vai atceliet rediģēšanu.',
      processingTimeout:
        'Attēla apstrāde aizņēma pārāk ilgu laiku un tika apturēta. Oriģināls nav mainīts.',
      resultTooLarge:
        'Apstrādātais attēls pārsniedz 48 MiB. Samaziniet atlasīto apgabalu vai izmantojiet mazāku attēlu.',
    },
  },
  editor: {
    eyebrow: 'LOKĀLA ATTĒLA APSTRĀDE',
    edit: 'Rediģēt skenējumu',
    original: 'Oriģināls un stūri',
    result: 'Apstrādātais skenējums',
    resultCaption:
      'Redzama apstiprinātā apstrādātā versija. Sākotnējā fotogrāfija ir saglabāta un pieejama redaktorā.',
    processed: 'Apstrādāts',
    zoom: 'Pietuvinājums',
    dragHint:
      'Velciet stūrus ar peli vai pirkstu. Atlasītam stūrim darbojas bulttaustiņi; Shift palielina soli. Pietuvinātu attēlu var ritināt.',
    corner: '{number}. stūris',
    axis: '{number}. stūra {axis} (%)',
    coordinates: 'Precīzas koordinātas (%)',
    detect: 'Noteikt robežas',
    resetCorners: 'Atiestatīt stūrus',
    detected:
      'Atrasts iespējams dokumenta četrstūris. Pārbaudiet un, ja vajag, izlabojiet visus četrus stūrus.',
    uncertain:
      'Dokumenta robežas nevar droši noteikt. Izvēlieties tās manuāli; pilna attēla rāmis ir tikai sākuma atlase.',
    manual: 'Atlase atiestatīta uz pilna attēla robežām. Pārvietojiet stūrus uz dokumenta malām.',
    previewHint: 'Sagatavojiet priekšskatījumu, lai redzētu rezultātu.',
    stale: 'Atlase ir mainīta. Atjauniniet priekšskatījumu pirms apstiprināšanas.',
    filters: 'Attēla režīms',
    filter: {
      original: 'Oriģinālās krāsas',
      enhanced: 'Uzlabots',
      grayscale: 'Pelēktoņi',
      bw: 'Melnbalts',
    },
    rotation: 'Pagriešana',
    left: '90° pa kreisi',
    right: '90° pa labi',
    resetRotation: 'Atiestatīt pagriezienu',
    rotationValue: 'Pagrieziens: {value}°',
    restore: 'Atjaunot oriģinālu',
    restored:
      'Atjaunota pilna fotogrāfija, sākotnējā orientācija un krāsas. Apstipriniet, lai piemērotu šo izvēli.',
    cancel: 'Atcelt rediģēšanu',
    preview: 'Priekšskatīt',
    apply: 'Apstiprināt izmaiņas',
    applied:
      'Skenējums atjaunināts sesijā. Nospiediet “Saglabāt melnrakstu”, lai saglabātu izmaiņas pēc pārlādes.',
    working: 'Apstrādā attēlu…',
    saveHint:
      'Apstiprināšana maina tikai atvērto sesiju. Lai saglabātu pēc pārlādes, izmantojiet “Saglabāt melnrakstu”. Atcelšana saglabā iepriekšējo stāvokli.',
    limits:
      'Rezultāts: līdz 8 MP / 5000 px vienā malā, PNG bez JPEG pārkodēšanas. Lielu fotoattēlu darba kopija tiek samazināta līdz 16 MP; oriģināls paliek neskarts. Sīkas līnijas un vāji simboli jāpārbauda priekšskatījumā.',
  },
  documents: {
    eyebrow: 'LOKĀLIE MELNRAKSTI',
    title: 'Vieta visiem svarīgajiem dokumentiem.',
    description:
      'Turpiniet skenēšanas sesijas, kas saglabātas šajā pārlūkprogrammā. Tie ir melnraksti, nevis reģistrēti dokumenti.',
    count: 'Saglabātie melnraksti',
    emptyTitle: 'Vēl nav saglabātu melnrakstu',
    emptyDescription:
      'Pievienojiet dokumentu attēlus skenēšanas sadaļā un saglabājiet sesiju. Pēc tam to varēsiet atvērt un turpināt šeit.',
    future: 'Arhīvs augs kopā ar jums',
    futureText:
      'OCR, PDF ģenerēšana, automātiska grupēšana, meklēšana un reģistrēšana vēl nav pieejama.',
    draft: 'Melnraksts',
    created: 'Izveidots',
    updated: 'Rediģēts',
    continue: 'Turpināt',
    openDraft: 'Atvērt melnrakstu',
    cover: 'Melnraksta pirmās lapas priekšskatījums',
    deleteDraft: 'Dzēst melnrakstu',
    confirmDelete: 'Vai dzēst melnrakstu un visus tā saglabātos attēlus? Šo darbību nevar atsaukt.',
  },
  settings: {
    eyebrow: 'JŪSU PREFERENCES',
    title: 'Iestatījumi',
    description: 'Pielāgojiet savu darbvietu un iepazīstiet lietotni.',
    appearance: 'Izskats',
    appearanceText: 'Izvēlieties sev ērtāko vizuālo režīmu.',
    light: 'Gaišs',
    dark: 'Tumšs',
    themeLabel: 'Vizuālais režīms',
    themeSaved: 'Izvēle tiek saglabāta šajā ierīcē.',
    privacy: 'Dati un privātums',
    aiTitle: 'MI integrācija nākotnē',
    aiDescription:
      'Pēc saskaņošanas paredzēts pievienot GASO korporatīvo MI dokumentu analīzei. Šobrīd MI pakalpojumi nav pieslēgti.',
    about: 'Par lietotni',
    aboutText: 'Dokumentu digitalizācijas mobilās lietotnes pamats.',
    language: 'Saskarnes valoda',
    latvian: 'Latviešu',
    languageNote: 'Angļu un krievu valodas atbalsts paredzēts nākotnē.',
    github: 'Projekts GitHub',
    githubHint: 'Atveras jaunā cilnē',
    prototype: '3. posms · attēlu apstrāde',
  },
  pwa: {
    install: 'Instalēt lietotni',
    installText: 'Pievienojiet Document AI ierīces sākuma ekrānam.',
    update: 'Pieejama jauna lietotnes versija.',
    reload: 'Atjaunināt',
    error:
      'Neizdevās sagatavot bezsaistes režīmu. Mēģiniet pārlādēt lietotni, kad pieejams internets.',
  },
}
