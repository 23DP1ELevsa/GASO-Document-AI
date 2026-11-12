import grouping from './grouping.lv.js'

export default {
  grouping,
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
    recognizeText: 'Iegūstiet rediģējamu tekstu ar lokālu OCR.',
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
  ocr: {
    eyebrow: 'LOKĀLA TEKSTA ATPAZĪŠANA',
    title: 'Lapas teksts',
    recognize: 'Atpazīt tekstu',
    recognizeAll: 'Atpazīt visas lapas',
    rerun: 'Atkārtot OCR',
    view: 'Skatīt tekstu',
    close: 'Aizvērt teksta apskati',
    image: 'OCR ievades attēls',
    selectPage: 'Izvēlēties lapu',
    languages: 'Dokumenta OCR valodas',
    language: { lav: 'Latviešu', eng: 'Angļu', rus: 'Krievu' },
    languageHint:
      'Izvēlieties vienu vai vairākas dokumenta valodas. Izvēle saglabājas šajā pārlūkprogrammā; atmiņā ielādē tikai izvēlētos modeļus.',
    settingsTitle: 'Teksta atpazīšana (OCR)',
    settingsError: 'OCR valodu izvēli neizdevās saglabāt. Tā darbosies līdz pārlādei.',
    status: 'Statuss',
    statuses: {
      success: 'Teksts atpazīts',
      empty: 'Teksts nav atrasts',
      error: 'OCR kļūda',
      cancelled: 'OCR atcelts',
    },
    usedLanguages: 'Izmantotās valodas',
    confidence: 'Dzinēja ticamības vērtējums',
    text: 'Atpazītais teksts — varat labot',
    originalText: 'Sākotnējais OCR teksts',
    textLimit:
      'Līdz {count} rakstzīmēm katrā teksta versijā. Sākotnējais rezultāts saglabājas atsevišķi.',
    save: 'Saglabāt tekstu',
    saved: 'Teksts un sesija saglabāti šajā pārlūkprogrammā.',
    copy: 'Kopēt tekstu',
    copied: 'Teksts nokopēts.',
    noResult: 'Šai lapai vēl nav OCR rezultāta.',
    empty:
      'Teksts nav atpazīts. Pārbaudiet attēlu, dokumenta valodu un filtru; pēc tam mēģiniet vēlreiz.',
    stale: 'Teksts tika atpazīts no iepriekšējās attēla versijas. Ieteicams atkārtot atpazīšanu.',
    staleLabel: 'Teksts no iepriekšējās versijas',
    languageChanged:
      'Izvēlētais valodu komplekts atšķiras no rezultāta valodām. Lai lietotu jauno izvēli, atkārtojiet OCR.',
    confirmRerun:
      'Jaunais OCR rezultāts var atšķirties. Veiksmīga atpazīšana aizstās iepriekšējo OCR tekstu un šīm lapām saglabātos manuālos labojumus. Vai turpināt?',
    confirmUnsaved: 'Tekstā ir nesaglabāti labojumi. Vai atmest tos?',
    cancel: 'Apturēt OCR',
    cancelled: 'Apstrāde apturēta. Iepriekš pabeigto lapu rezultāti saglabājas.',
    progress: 'OCR progress',
    phase: { initializing: 'Sagatavo OCR…', recognizing: 'Atpazīst tekstu…' },
    batchProgress: 'Lapa {current} no {total} · pabeigtas: {completed} · kļūdas: {errors}',
    sessionTitle: 'Sesijas lapu teksts',
    sessionHint:
      'Lapas apstrādā secīgi. Rezultāti tiek saglabāti pēc katras lapas. Sesija var ietvert vairākus dokumentus; automātiska grupēšana netiek veikta.',
    combined: 'Visu lapu teksts sesijas secībā',
    combinedHint:
      'Apvienotais skats ietver arī iepriekšējus rezultātus. Pārbaudiet katras lapas aktualitātes atzīmi.',
    privacy:
      'Atpazīšana notiek ierīcē. Attēli un teksts netiek sūtīti ārējiem pakalpojumiem. Ticamības vērtējums nav precizitātes garantija.',
    offlineHint:
      'Bezsaistes darbam sagatavojiet izvēlēto valodu modeļus un OCR kodu (aptuveni 14–22 MiB). Tīmekļa versijā vajadzīgs arī aktivizēts produkcijas PWA kešs. Pārlūks var izdzēst lokālos datus.',
    prepareOffline: 'Sagatavot OCR bezsaistei',
    preparing: 'Sagatavo OCR resursus…',
    offlineReady:
      'Izvēlēto valodu modeļi un OCR kods pārbaudīti un saglabāti šajā pārlūkā. PWA interfeisam jābūt iepriekš ielādētam.',
    errors: {
      languages: 'Izvēlieties vismaz vienu no atbalstītajām OCR valodām.',
      busy: 'Sagaidiet pašreizējās OCR darbības beigas.',
      modelUnavailable:
        'OCR valodas modeli nevar ielādēt. Pārbaudiet, vai lietotnes OCR resursi ir sagatavoti un izvēlētā valoda ir pieejama bezsaistē.',
      initialization:
        'Neizdevās palaist OCR WebAssembly vai Worker. Izmantojiet aktuālu pārlūku un pārbaudiet, vai ir pieejami lietotnes OCR faili.',
      recognition:
        'Teksta atpazīšana neizdevās. Iepriekšējais teksts saglabāts. Pārbaudiet attēlu un mēģiniet vēlreiz.',
      imageUnavailable:
        'Pilna izmēra OCR ievades attēls nav pieejams. Atveriet melnrakstu vēlreiz vai pievienojiet attēlu.',
      memory:
        'OCR nepietiek ierīces atmiņas. Aizveriet citas cilnes, izvēlieties mazāk valodu vai mazāku attēlu.',
      timeout:
        'OCR pārsniedza trīs minūtes un tika apturēts. Mēģiniet ar vienu valodu vai mazāku attēlu.',
      cancelled: 'Šīs lapas OCR ir atcelts. Iepriekšējais teksts saglabāts.',
      textTooLarge:
        'OCR teksts pārsniedz 250 000 rakstzīmes. Iepriekšējais rezultāts nav aizstāts; sadaliet ievadi mazākās lapās.',
      clipboard: 'Tekstu nevar nokopēt. Atlasiet un kopējiet to manuāli.',
      offlineUnavailable:
        'Pārlūks neļauj sagatavot bezsaistes kešu. Atveriet lietotni localhost vai HTTPS un pārbaudiet glabāšanas atļaujas.',
      integrity:
        'OCR faila kontrolsumma neatbilst sagatavotajai versijai. Atjauniniet lietotni un mēģiniet vēlreiz.',
    },
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
      'Dokumentu grupas un datu kartītes ir pieejamas skenēšanas sesijā. PDF ģenerēšana, meklēšana un reģistrēšana paredzēta nākamajos posmos.',
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
    prototype: '5. posms · dokumentu grupas un datu kartītes',
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
