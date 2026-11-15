import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Camera, Images, ShieldCheck, Settings as Cog, Home, FileText, ChevronRight, X, Plus, RotateCw, Crop,
  Trash2, ArrowLeft, ArrowRight, MoreVertical, Scissors, Sparkles, CheckCircle2, AlertCircle, CircleHelp,
  Download, Eye, ChevronDown, Layers, FileCheck2, BookOpen, Moon, Sun, Pencil, Info, Loader2, FileImage,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "./store";
import {
  DOC_TYPES, FIELD_SETS, countChecks, dataFor, demoRecognition, draftStatus, draftTitle, needsSingleConfirm,
  relTime, splitDocs, uid, emptyData, type DocData, type Draft, type FieldKey, type Page,
} from "./model";
import { DEMO_PAGE_COUNT, demoPageUrl } from "./demo-pages";
import { buildPdf, download, pdfName, type PdfOptions } from "./pdf";
import { Btn, Chip, Header, Logo, PageImg, SaveBadge, Sheet, StepFooter } from "./ui";

type Screen =
  | { name: "home" } | { name: "docs" } | { name: "settings" } | { name: "capture" }
  | { name: "edit"; pageId: string } | { name: "pages" } | { name: "fields" } | { name: "pdf" } | { name: "done" };

type Nav = { go: (s: Screen) => void; back: () => void; reset: (s: Screen) => void; toast: (m: string) => void; pick: () => void };

export function PrototypeApp() {
  const [stack, setStack] = useState<Screen[]>([{ name: "home" }]);
  const [toastMsg, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const store = useStore();

  useEffect(() => {
    const onPop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const toast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); }, []);
  const nav: Nav = {
    go: (s) => { history.pushState({ p: 1 }, ""); setStack((st) => [...st, s]); },
    back: () => history.back(),
    reset: (s) => setStack([s]),
    toast,
    pick: () => fileRef.current?.click(),
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const srcs = await Promise.all(Array.from(files).map((f) => new Promise<string>((res) => {
      const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f);
    })));
    if (!store.current || store.current.exported || stack.at(-1)?.name === "home" || stack.at(-1)?.name === "docs") store.start();
    store.update((d) => ({ ...d, pages: [...d.pages, ...srcs.map((src) => ({ id: uid(), src, rotation: 0, cropped: false }))] }));
    if (fileRef.current) fileRef.current.value = "";
    const top = stack.at(-1)?.name;
    if (top !== "capture" && top !== "pages") nav.go({ name: "capture" });
    toast(`Pievienotas ${srcs.length} lapas no galerijas`);
  };

  const s = stack.at(-1)!;
  let view: ReactNode;
  switch (s.name) {
    case "home": view = <HomeScreen nav={nav} />; break;
    case "docs": view = <DocsScreen nav={nav} />; break;
    case "settings": view = <SettingsScreen nav={nav} />; break;
    case "capture": view = <CaptureScreen nav={nav} />; break;
    case "edit": view = <EditScreen nav={nav} pageId={s.pageId} />; break;
    case "pages": view = <PagesScreen nav={nav} />; break;
    case "fields": view = <FieldsScreen nav={nav} />; break;
    case "pdf": view = <PdfScreen nav={nav} />; break;
    case "done": view = <DoneScreen nav={nav} />; break;
  }
  const needsDraft = !["home", "docs", "settings"].includes(s.name);

  return (
    <div className="flex min-h-dvh justify-center bg-stage sm:items-center sm:py-6">
      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-background sm:h-[min(880px,calc(100dvh-48px))] sm:rounded-[2.25rem] sm:border sm:border-border sm:shadow-card">
        <div key={s.name + ("pageId" in s ? s.pageId : "")} className="flex min-h-0 flex-1 flex-col animate-rise">
          {needsDraft && !store.current ? <HomeScreen nav={nav} /> : view}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        {toastMsg && (
          <div role="status" className="pointer-events-none absolute inset-x-4 bottom-28 z-[60] flex justify-center animate-rise">
            <span className="rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-card">{toastMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Bottom nav ---------- */
function BottomNav({ nav, active }: { nav: Nav; active: "home" | "docs" }) {
  const items = [
    { id: "home" as const, label: "Sākums", icon: Home },
    { id: "docs" as const, label: "Dokumenti", icon: FileText },
  ];
  return (
    <nav className="pb-safe border-t border-border bg-card/95 backdrop-blur" aria-label="Galvenā navigācija">
      <div className="flex">
        {items.map((it) => (
          <button key={it.id} onClick={() => active !== it.id && nav.reset({ name: it.id })}
            aria-current={active === it.id ? "page" : undefined}
            className="flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold">
            <span className={cn("flex h-8 w-16 items-center justify-center rounded-full transition-colors", active === it.id ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground")}>
              <it.icon className="h-5 w-5" />
            </span>
            <span className={active === it.id ? "text-foreground" : "text-muted-foreground"}>{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function resume(nav: Nav, d: Draft) {
  const map = { capture: "capture", pages: "pages", fields: "fields", pdf: "pdf", done: "pdf" } as const;
  nav.go({ name: map[d.stage] });
}

/* ---------- 1. Home ---------- */
function HomeScreen({ nav }: { nav: Nav }) {
  const { state, start, open, update } = useStore();
  const drafts = state.drafts.filter((d) => !d.exported && d.pages.length).slice(0, 2);
  const begin = () => { start(); nav.go({ name: "capture" }); };
  const sample = () => {
    start();
    update((d) => ({ ...d, stage: "pages", pages: [0, 1, 2].map((i) => ({ id: uid(), demo: i, rotation: 0, cropped: false })) }));
    nav.go({ name: "pages" });
  };
  return (
    <>
      <header className="pt-safe flex items-center gap-3 px-5 pb-2 pt-4">
        <Logo />
        <span className="flex-1 text-[15px] font-bold tracking-tight">GASO Dokumenti</span>
        <Btn variant="ghost" size="icon" aria-label="Iestatījumi" onClick={() => nav.go({ name: "settings" })}><Cog className="h-5 w-5" /></Btn>
      </header>
      <main className="flex-1 overflow-y-auto px-5 pb-6">
        <h1 className="mt-6 text-[28px] font-extrabold leading-[1.12] tracking-tight">Dokuments gatavs<br />dažos soļos</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Nofotografējiet, pārbaudiet un saglabājiet PDF.</p>

        <button onClick={begin}
          className="group relative mt-7 flex w-full flex-col items-start overflow-hidden rounded-3xl bg-primary p-5 text-left text-primary-foreground shadow-cta transition active:scale-[0.99]">
          <span className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-primary-foreground/10" aria-hidden />
          <span className="absolute -right-2 top-16 h-20 w-20 rounded-full bg-primary-foreground/10" aria-hidden />
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/15"><Camera className="h-7 w-7" /></span>
          <span className="mt-8 text-xl font-bold">Skenēt dokumentu</span>
          <span className="mt-0.5 text-sm opacity-85">Rēķins, līgums vai iesniegums</span>
        </button>
        <Btn variant="secondary" size="lg" className="mt-3" onClick={nav.pick}><Images className="h-5 w-5" />Pievienot no galerijas</Btn>

        {drafts.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-bold text-muted-foreground">Turpināt iesākto</h2>
            <div className="flex flex-col gap-2.5">
              {drafts.map((d) => {
                const st = draftStatus(d);
                return (
                  <button key={d.id} onClick={() => { open(d.id); resume(nav, d); }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-card active:scale-[0.99]">
                    <PageImg page={d.pages[0]!} className="h-14 w-11 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{draftTitle(d)}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Chip tone={st.tone}>{st.label}</Chip>{relTime(d.updatedAt)}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <button onClick={sample} className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-dashed border-input p-4 text-left">
            <FileImage className="h-5 w-5 shrink-0 text-primary" />
            <span className="flex-1 text-sm"><b className="font-semibold">Nav dokumenta pie rokas?</b><br /><span className="text-muted-foreground">Izmēģiniet ar demonstrācijas rēķinu</span></span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        )}

        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" />Dokumenti tiek apstrādāti tikai šajā ierīcē
        </p>
      </main>
      <BottomNav nav={nav} active="home" />
    </>
  );
}

/* ---------- 2. Capture ---------- */
function CaptureScreen({ nav }: { nav: Nav }) {
  const { current, update } = useStore();
  const [flash, setFlash] = useState(0);
  if (!current) return null;
  const pages = current.pages;
  const nextDemo = pages.filter((p) => p.demo !== undefined).length % DEMO_PAGE_COUNT;
  const shoot = () => {
    setFlash((f) => f + 1);
    update((d) => ({ ...d, pages: [...d.pages, { id: uid(), demo: nextDemo, rotation: 0, cropped: false }] }));
  };
  const cont = () => { update((d) => ({ ...d, stage: "pages" })); nav.go({ name: "pages" }); };
  return (
    <div className="dark relative flex flex-1 flex-col bg-viewfinder text-viewfinder-foreground">
      <div className="pt-safe flex items-center justify-between px-3 pt-2">
        <Btn variant="camera" size="icon" aria-label="Aizvērt kameru" onClick={nav.back}><X className="h-5 w-5" /></Btn>
        <span className="rounded-full bg-warning-soft px-3 py-1.5 text-xs font-bold text-warning">Demonstrācijas kamera</span>
        <span className="w-11" />
      </div>

      <div className="relative mx-6 mt-4 flex flex-1 items-center justify-center">
        <img src={demoPageUrl(nextDemo)} alt="" className="max-h-full w-[78%] rotate-[-2deg] rounded-sm opacity-80 shadow-2xl" />
        {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl",
          "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
          <span key={c} className={cn("absolute h-10 w-10 border-primary", c)} aria-hidden />
        ))}
        <span className="absolute bottom-4 rounded-full bg-viewfinder/80 px-3 py-1.5 text-xs font-medium">Novietojiet visu lapu rāmī</span>
        {flash > 0 && <span key={flash} className="absolute inset-0 bg-viewfinder-foreground animate-flash" aria-hidden />}
      </div>

      <p className="mt-3 px-6 text-center text-[11px] leading-snug opacity-70">
        Prototipā kamera ir simulēta: uzņemot tiek pievienota parauga lapa. Īstas bildes var izvēlēties no galerijas — tās paliek ierīcē.
      </p>

      {pages.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4" aria-label="Uzņemtās lapas">
          {pages.map((p, i) => (
            <button key={p.id} onClick={() => nav.go({ name: "edit", pageId: p.id })} aria-label={`Rediģēt lapu ${i + 1}`}
              className="relative shrink-0 animate-pop">
              <PageImg page={p} className="h-16 w-12 rounded-md ring-2 ring-viewfinder-foreground/30" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      <div className="pb-safe flex items-center justify-between px-6 pb-4 pt-4">
        <Btn variant="camera" size="icon" className="h-12 w-12" aria-label="Pievienot no galerijas" onClick={nav.pick}><Images className="h-5 w-5" /></Btn>
        <button onClick={shoot} aria-label="Uzņemt lapu" className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-viewfinder-foreground/80 transition active:scale-90">
          <span className="h-[60px] w-[60px] rounded-full bg-viewfinder-foreground" />
        </button>
        {pages.length > 0 ? (
          <Btn size="sm" className="h-12 min-w-12 rounded-full px-4" onClick={cont} aria-label={`Turpināt ar ${pages.length} lapām`}>
            Turpināt<span className="rounded-full bg-primary-foreground/20 px-1.5 text-xs">{pages.length}</span>
          </Btn>
        ) : <span className="w-12" />}
      </div>
    </div>
  );
}

/* ---------- Page edit ---------- */
function EditScreen({ nav, pageId }: { nav: Nav; pageId: string }) {
  const { current, update } = useStore();
  const [confirmDel, setConfirmDel] = useState(false);
  if (!current) return null;
  const idx = current.pages.findIndex((p) => p.id === pageId);
  const page = current.pages[idx];
  if (!page) return <Header title="Lapa izdzēsta" onBack={nav.back} />;
  const set = (patch: Partial<Page>) => update((d) => ({ ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)) }));
  const move = (dir: -1 | 1) => update((d) => {
    const ps = [...d.pages]; const j = idx + dir; if (j < 0 || j >= ps.length) return d;
    [ps[idx], ps[j]] = [ps[j]!, ps[idx]!]; return { ...d, pages: ps };
  });
  const tools = [
    { label: "Pagriezt", icon: RotateCw, on: () => set({ rotation: page.rotation + 90 }) },
    { label: page.cropped ? "Atcelt apgriešanu" : "Apgriezt malas", icon: Crop, on: () => set({ cropped: !page.cropped }), active: page.cropped },
    { label: "Uz priekšu", icon: ArrowLeft, on: () => move(-1), disabled: idx === 0 },
    { label: "Uz aizmuguri", icon: ArrowRight, on: () => move(1), disabled: idx === current.pages.length - 1 },
  ];
  return (
    <>
      <Header title={`Lapa ${idx + 1} no ${current.pages.length}`} onBack={nav.back}
        right={<Btn variant="dangerGhost" size="icon" aria-label="Dzēst lapu" onClick={() => setConfirmDel(true)}><Trash2 className="h-5 w-5" /></Btn>} />
      <main className="flex min-h-0 flex-1 flex-col px-4">
        <PageImg page={page} className="min-h-0 flex-1 rounded-2xl" />
        <p className="mt-2 text-center text-xs text-muted-foreground">Pagriešana un malu apgriešana tiks piemērota PDF failā.</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {tools.map((t) => (
            <button key={t.label} onClick={t.on} disabled={t.disabled}
              className={cn("flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[11px] font-semibold transition active:scale-95 disabled:opacity-35",
                t.active ? "bg-primary-soft text-accent-foreground" : "bg-card text-foreground shadow-card")}>
              <t.icon className="h-5 w-5" />{t.label}
            </button>
          ))}
        </div>
      </main>
      <footer className="pb-safe px-4 pt-3"><Btn size="lg" onClick={nav.back}>Gatavs</Btn></footer>
      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title="Dzēst šo lapu?">
        <p className="mb-5 text-sm text-muted-foreground">Lapa tiks noņemta no dokumenta. To nevarēs atjaunot.</p>
        <div className="flex flex-col gap-2 pb-2">
          <Btn variant="danger" size="lg" onClick={() => { update((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== pageId) })); setConfirmDel(false); nav.back(); nav.toast("Lapa izdzēsta"); }}>Dzēst lapu</Btn>
          <Btn variant="ghost" size="lg" onClick={() => setConfirmDel(false)}>Atcelt</Btn>
        </div>
      </Sheet>
    </>
  );
}

/* ---------- 3. Pages review ---------- */
function PagesScreen({ nav }: { nav: Nav }) {
  const { current, update } = useStore();
  const [menu, setMenu] = useState(false);
  if (!current) return null;
  const d = current;
  const docs = splitDocs(d);
  const move = (i: number, dir: -1 | 1) => update((x) => {
    const ps = [...x.pages]; const j = i + dir; if (j < 0 || j >= ps.length) return x;
    [ps[i], ps[j]] = [ps[j]!, ps[i]!]; return { ...x, pages: ps };
  });
  const toggleSplit = (pid: string) => update((x) => ({ ...x, splits: x.splits.includes(pid) ? x.splits.filter((s) => s !== pid) : [...x.splits, pid] }));
  const blocked = needsSingleConfirm(d) || (d.splitMode && docs.length < 2) || !d.pages.length;
  const hint = !d.pages.length ? "Pievienojiet vismaz vienu lapu" : needsSingleConfirm(d) ? "Vispirms atbildiet uz jautājumu augšā" : d.splitMode && docs.length < 2 ? "Atzīmējiet, kur sākas nākamais dokuments" : undefined;
  const cont = () => { update((x) => ({ ...x, stage: "fields", activeDoc: 0 })); nav.go({ name: "fields" }); };

  return (
    <>
      <Header title="Pārbaudiet lapas" sub={`${d.pages.length} ${d.pages.length === 1 ? "lapa" : "lapas"}${docs.length > 1 ? ` · ${docs.length} dokumenti` : ""}`} onBack={nav.back}
        right={<Btn variant="ghost" size="icon" aria-label="Vairāk darbību" onClick={() => setMenu(true)}><MoreVertical className="h-5 w-5" /></Btn>} />
      <main className="flex-1 overflow-y-auto px-4 pb-6">
        {!d.pages.length && (
          <div className="mt-16 flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary"><Camera className="h-7 w-7" /></span>
            <p className="mt-4 font-semibold">Nav nevienas lapas</p>
            <p className="mt-1 text-sm text-muted-foreground">Nofotografējiet vai pievienojiet lapas no galerijas.</p>
          </div>
        )}

        {needsSingleConfirm(d) && (
          <section className="mb-4 rounded-2xl border border-primary/25 bg-primary-soft p-4 animate-rise">
            <p className="flex items-center gap-2 font-bold"><CircleHelp className="h-5 w-5 text-primary" />Vai visas lapas ir viens dokuments?</p>
            <p className="mt-1 text-sm text-muted-foreground">Piemēram, viens rēķins ar vairākām lapām.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Btn size="md" onClick={() => update((x) => ({ ...x, singleConfirmed: true }))}>Jā, viens</Btn>
              <Btn variant="secondary" size="md" onClick={() => update((x) => ({ ...x, splitMode: true }))}>Nē, sadalīt</Btn>
            </div>
          </section>
        )}
        {d.singleConfirmed && !d.splitMode && d.pages.length > 1 && (
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" /><span className="flex-1">Visas lapas — viens dokuments</span>
            <button className="font-semibold underline" onClick={() => update((x) => ({ ...x, singleConfirmed: false }))}>Mainīt</button>
          </p>
        )}

        {!d.splitMode ? (
          <div className="grid grid-cols-2 gap-3">
            {d.pages.map((p, i) => (
              <article key={p.id} className="overflow-hidden rounded-2xl bg-card shadow-card animate-rise">
                <button className="relative block w-full" onClick={() => nav.go({ name: "edit", pageId: p.id })} aria-label={`Rediģēt lapu ${i + 1}`}>
                  <PageImg page={p} className="aspect-[3/4] w-full" />
                  <span className="absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 shadow-card"><Pencil className="h-4 w-4" /></span>
                </button>
                <div className="flex justify-between p-1">
                  <Btn variant="ghost" size="icon" aria-label={`Pārvietot lapu ${i + 1} uz priekšu`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowLeft className="h-4 w-4" /></Btn>
                  <Btn variant="ghost" size="icon" aria-label={`Pārvietot lapu ${i + 1} uz aizmuguri`} disabled={i === d.pages.length - 1} onClick={() => move(i, 1)}><ArrowRight className="h-4 w-4" /></Btn>
                </div>
              </article>
            ))}
            <button onClick={() => nav.go({ name: "capture" })} className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input text-sm font-semibold text-muted-foreground">
              <Plus className="h-6 w-6" />Pievienot vēl
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-4 flex gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />Pieskarieties starp lapām tur, kur sākas jauns dokuments.
            </p>
            {d.pages.map((p, i) => {
              const docIdx = docs.findIndex((g) => g.some((x) => x.id === p.id));
              const isStart = i === 0 || d.splits.includes(p.id);
              return (
                <div key={p.id}>
                  {i > 0 && (isStart ? (
                    <button onClick={() => toggleSplit(p.id)} className="my-3 flex w-full items-center gap-2 text-xs font-bold text-primary" aria-label="Noņemt dalījumu">
                      <span className="h-0.5 flex-1 rounded bg-primary" /><Scissors className="h-4 w-4" />Šeit sākas jauns dokuments<X className="h-4 w-4" /><span className="h-0.5 flex-1 rounded bg-primary" />
                    </button>
                  ) : (
                    <button onClick={() => toggleSplit(p.id)} className="group my-1 flex h-11 w-full items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="h-px flex-1 border-t border-dashed border-input" /><Plus className="h-4 w-4" />Sākt jaunu dokumentu šeit<span className="h-px flex-1 border-t border-dashed border-input" />
                    </button>
                  ))}
                  {isStart && <h3 className="mb-2 mt-1 flex items-center gap-2 text-sm font-bold"><Layers className="h-4 w-4 text-primary" />Dokuments {docIdx + 1}<span className="font-normal text-muted-foreground">· {docs[docIdx]?.length} lp.</span></h3>}
                  <div className="flex items-center gap-3 rounded-2xl bg-card p-2 shadow-card">
                    <PageImg page={p} className="h-20 w-15 shrink-0 rounded-lg" />
                    <span className="flex-1 font-semibold">Lapa {i + 1}</span>
                    <Btn variant="ghost" size="icon" aria-label="Rediģēt" onClick={() => nav.go({ name: "edit", pageId: p.id })}><Pencil className="h-4 w-4" /></Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <StepFooter step={2} hint={hint}>
        <Btn size="lg" disabled={blocked} onClick={cont}>Turpināt uz datiem<ArrowRight className="h-5 w-5" /></Btn>
      </StepFooter>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Darbības">
        <div className="flex flex-col pb-2">
          <MenuItem icon={Plus} label="Pievienot lapu" onClick={() => { setMenu(false); nav.go({ name: "capture" }); }} />
          <MenuItem icon={Images} label="Pievienot no galerijas" onClick={() => { setMenu(false); nav.pick(); }} />
          {d.pages.length > 1 && (d.splitMode
            ? <MenuItem icon={Layers} label="Apvienot vienā dokumentā" onClick={() => { setMenu(false); update((x) => ({ ...x, splitMode: false, splits: [], singleConfirmed: true })); }} />
            : <MenuItem icon={Scissors} label="Sadalīt vairākos dokumentos" onClick={() => { setMenu(false); update((x) => ({ ...x, splitMode: true })); }} />)}
        </div>
      </Sheet>
    </>
  );
}

function MenuItem({ icon: I, label, onClick, danger }: { icon: typeof Plus; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex min-h-[52px] items-center gap-3 rounded-xl px-2 text-left font-semibold hover:bg-muted", danger && "text-destructive")}>
      <I className="h-5 w-5" />{label}
    </button>
  );
}

/* ---------- 4. Fields ---------- */
function FieldsScreen({ nav }: { nav: Nav }) {
  const { current, update } = useStore();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [warn, setWarn] = useState(false);
  const [preview, setPreview] = useState<Page | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  if (!current) return null;
  const docs = splitDocs(current);
  const di = Math.min(current.activeDoc, docs.length - 1);
  const doc = docs[di];
  if (!doc) return null;
  const data = dataFor(current, doc);
  const setData = (fn: (x: DocData) => DocData) => update((d) => ({ ...d, data: { ...d.data, [doc[0]!.id]: fn(dataFor(d, doc)) } }));
  const counts = countChecks(data);

  const recognize = () => {
    setBusy(true); setStep(0);
    const msgs = [700, 1500, 2300];
    msgs.forEach((t, i) => setTimeout(() => setStep(i + 1), t));
    setTimeout(() => { setData(() => demoRecognition(doc[0]!)); setBusy(false); }, 2600);
  };
  const next = () => {
    if (di < docs.length - 1) {
      update((d) => ({ ...d, activeDoc: di + 1 }));
      mainRef.current?.scrollTo({ top: 0 });
    } else { update((d) => ({ ...d, stage: "pdf" })); nav.go({ name: "pdf" }); }
  };
  const skip = () => { setData((x) => ({ ...emptyData(), ...x, skipped: true, recognized: false })); next(); };
  const confirm = (force = false) => {
    if (!force && counts.check > 0) { setWarn(true); return; }
    setWarn(false); setData((x) => ({ ...x, confirmed: true, skipped: false })); next();
  };
  const setField = (k: FieldKey, value: string) => setData((x) => ({ ...x, fields: { ...x.fields, [k]: { ...x.fields[k], value, status: value ? "ok" : "missing" } } }));
  const markOk = (k: FieldKey) => setData((x) => ({ ...x, fields: { ...x.fields, [k]: { ...x.fields[k], status: "ok" } } }));
  const steps = ["Nolasa lapas", "Meklē numuru un datumus", "Meklē summu", "Gandrīz gatavs"];

  return (
    <>
      <Header title={docs.length > 1 ? `Dokuments ${di + 1} no ${docs.length}` : "Dokumenta dati"} sub={`${doc.length} ${doc.length === 1 ? "lapa" : "lapas"}`} onBack={() => {
        if (di > 0) update((d) => ({ ...d, activeDoc: di - 1 })); else nav.back();
      }} />
      <main ref={mainRef} className="flex-1 overflow-y-auto pb-8">
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 pb-1">
          {doc.map((p, i) => (
            <button key={p.id} onClick={() => setPreview(p)} aria-label={`Apskatīt lapu ${i + 1}`} className="relative shrink-0">
              <PageImg page={p} className={cn("rounded-xl shadow-card", doc.length === 1 ? "h-44 w-32" : "h-36 w-26")} />
              <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
              {busy && <span className="absolute inset-x-1 h-0.5 bg-primary shadow-cta animate-scanline" aria-hidden />}
            </button>
          ))}
        </div>

        {!data.recognized && !busy && (
          <section className="mx-4 mt-5 rounded-3xl bg-card p-5 shadow-card animate-rise">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Sparkles className="h-6 w-6" /></span>
            <h2 className="mt-4 text-lg font-bold">Atrast svarīgos datus</h2>
            <p className="mt-1 text-sm text-muted-foreground">Mēs atradīsim numuru, datumus un summu. Jūs tos tikai pārbaudīsiet.</p>
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-xs font-medium text-warning">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />Prototips: tiek parādīti iepriekš sagatavoti demonstrācijas dati, nevis jūsu dokumenta saturs.
            </p>
            <Btn variant="link" className="mt-3 h-11 px-0" onClick={skip}>Izlaist — saglabāt tikai skenējumu</Btn>
          </section>
        )}

        {busy && (
          <section className="mx-4 mt-5 rounded-3xl bg-card p-5 shadow-card" aria-live="polite">
            <h2 className="flex items-center gap-2 font-bold"><Loader2 className="h-5 w-5 animate-spin text-primary" />Atpazīst dokumentu…</h2>
            <ul className="mt-4 space-y-3">
              {steps.map((s, i) => (
                <li key={s} className={cn("flex items-center gap-3 text-sm transition-opacity", i <= step ? "opacity-100" : "opacity-35")}>
                  {i < step ? <CheckCircle2 className="h-5 w-5 text-success" /> : <span className="flex h-5 w-5 items-center justify-center"><span className={cn("h-2 w-2 rounded-full", i === step ? "bg-primary animate-pulse" : "bg-muted-foreground")} /></span>}
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.recognized && !busy && (
          <div className="px-4 animate-rise">
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Chip tone="warning">Demonstrācijas dati</Chip>
              {counts.check > 0 && <Chip tone="primary">{counts.check} jāpārbauda</Chip>}
              {counts.missing > 0 && <Chip tone="muted">{counts.missing} nav atrasti</Chip>}
              {counts.check === 0 && counts.missing === 0 && <Chip tone="success"><CheckCircle2 className="h-3.5 w-3.5" />Viss pārbaudīts</Chip>}
            </div>
            {data.demoFromPhoto && (
              <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">Jūsu fotoattēls prototipā netiek nolasīts. Aizpildiet vajadzīgos laukus paši vai izlaidiet šo soli.</p>
            )}

            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-bold">Dokumenta veids</legend>
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {DOC_TYPES.map((t) => (
                  <button key={t} onClick={() => setData((x) => ({ ...x, type: t }))} aria-pressed={data.type === t}
                    className={cn("h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition",
                      data.type === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{t}</button>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 flex flex-col gap-3">
              {FIELD_SETS[data.type].map((f) => (
                <FieldCard key={f.key} k={f.key} label={f.label} field={data.fields[f.key]} onChange={(v) => setField(f.key, v)} onOk={() => markOk(f.key)} />
              ))}
            </div>
            <Btn variant="link" className="mt-4 h-11 px-0" onClick={skip}>Izlaist datus — tikai skenējums</Btn>
          </div>
        )}
      </main>
      <StepFooter step={3}>
        {!data.recognized ? (
          <Btn size="lg" disabled={busy} onClick={recognize}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}Atpazīt dokumentu</Btn>
        ) : (
          <Btn size="lg" onClick={() => confirm()}>Apstiprināt un turpināt</Btn>
        )}
      </StepFooter>
      <Sheet open={warn} onClose={() => setWarn(false)} title="Daži lauki nav pārbaudīti">
        <p className="mb-5 text-sm text-muted-foreground">{counts.check} {counts.check === 1 ? "lauks vēl nav pārbaudīts" : "lauki vēl nav pārbaudīti"}. PDF failā tie tiks atzīmēti kā „Nav pārbaudīts”.</p>
        <div className="flex flex-col gap-2 pb-2">
          <Btn size="lg" onClick={() => setWarn(false)}>Pārbaudīt laukus</Btn>
          <Btn variant="ghost" size="lg" onClick={() => confirm(true)}>Turpināt tāpat</Btn>
        </div>
      </Sheet>
      <Sheet open={!!preview} onClose={() => setPreview(null)} title="Lapas priekšskatījums">
        {preview && <PageImg page={preview} className="mb-4 h-[60vh] rounded-2xl" />}
      </Sheet>
    </>
  );
}

function FieldCard({ k, label, field, onChange, onOk }: { k: FieldKey; label: string; field: DocData["fields"][FieldKey]; onChange: (v: string) => void; onOk: () => void }) {
  const [src, setSrc] = useState(false);
  const id = `f-${k}`;
  const status = field.status === "ok" ? { t: "success" as const, l: "Pārbaudīts", I: CheckCircle2 }
    : field.status === "check" ? { t: "primary" as const, l: "Pārbaudiet", I: Eye }
    : { t: "muted" as const, l: "Nav atrasts", I: AlertCircle };
  const mode = k === "amount" ? "decimal" : k === "date" || k === "due" ? "numeric" : "text";
  return (
    <div className={cn("rounded-2xl border bg-card p-3.5 shadow-card transition-colors", field.status === "check" ? "border-primary/40" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-muted-foreground">{label}</label>
        <Chip tone={status.t}><status.I className="h-3.5 w-3.5" />{status.l}</Chip>
      </div>
      {k === "currency" ? (
        <div className="mt-2 flex gap-2">
          {["EUR", "USD", "GBP"].map((c) => (
            <button key={c} onClick={() => onChange(c)} aria-pressed={field.value === c}
              className={cn("h-11 flex-1 rounded-xl border text-sm font-bold", field.value === c ? "border-primary bg-primary-soft text-accent-foreground" : "border-input")}>{c}</button>
          ))}
        </div>
      ) : (
        <input id={id} value={field.value} inputMode={mode} enterKeyHint="next"
          placeholder={k === "date" || k === "due" ? "dd.mm.gggg" : k === "amount" ? "0,00" : "Nav atrasts — ievadiet"}
          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 250)}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 h-12 w-full rounded-xl border border-input bg-background px-3 text-[17px] font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25" />
      )}
      <div className="mt-2 flex items-center justify-between">
        {field.source ? (
          <button className="flex h-8 items-center gap-1 text-xs font-medium text-muted-foreground" onClick={() => setSrc(!src)} aria-expanded={src}>
            Datu avots<ChevronDown className={cn("h-3.5 w-3.5 transition", src && "rotate-180")} />
          </button>
        ) : <span />}
        {field.status === "check" && (
          <button onClick={onOk} className="flex h-9 items-center gap-1.5 rounded-full bg-primary-soft px-3 text-xs font-bold text-accent-foreground"><CheckCircle2 className="h-4 w-4" />Pareizi</button>
        )}
      </div>
      {src && field.source && <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{field.source}</p>}
    </div>
  );
}

/* ---------- 5. PDF ---------- */
function PdfScreen({ nav }: { nav: Nav }) {
  const { current, update, state } = useStore();
  const docs = current ? splitDocs(current) : [];
  const anyInfo = current ? docs.some((g) => { const x = dataFor(current, g); return x.recognized && !x.skipped; }) : false;
  const [mode, setMode] = useState<"info" | "scan">(anyInfo && state.settings.defaultMode === "info" ? "info" : "scan");
  const [adv, setAdv] = useState(false);
  const [size, setSize] = useState<PdfOptions["size"]>("A4");
  const [quality, setQuality] = useState<PdfOptions["quality"]>("standard");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  if (!current) return null;
  const opts = (): PdfOptions => ({ withInfo: mode === "info", size, quality });

  const doDownload = async () => {
    setBusy(true);
    try {
      const names: string[] = [];
      for (let i = 0; i < docs.length; i++) {
        const data = dataFor(current, docs[i]!);
        const blob = await buildPdf(docs[i]!, data, opts());
        const n = pdfName(data, docs.length > 1 ? i : 0);
        download(blob, n); names.push(n);
      }
      update((d) => ({ ...d, exported: true, exportedNames: names, stage: "done" }));
      nav.go({ name: "done" });
    } catch { nav.toast("Neizdevās izveidot PDF. Mēģiniet vēlreiz."); }
    setBusy(false);
  };
  const doPreview = async () => {
    setBusy(true);
    try { const b = await buildPdf(docs[0]!, dataFor(current, docs[0]!), opts()); setPreviewUrl(URL.createObjectURL(b)); }
    catch { nav.toast("Priekšskatījumu neizdevās izveidot"); }
    setBusy(false);
  };

  return (
    <>
      <Header title="PDF gatavs saglabāšanai" onBack={nav.back} />
      <main className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col gap-3">
          {docs.map((g, i) => {
            const data = dataFor(current, g);
            const c = countChecks(data);
            const has = data.recognized && !data.skipped;
            return (
              <article key={g[0]!.id} className="flex gap-4 rounded-3xl bg-card p-4 shadow-card">
                <div className="relative h-28 w-22 shrink-0">
                  {g.slice(0, 3).map((p, j) => (
                    <div key={p.id} className="absolute inset-0" style={{ transform: `translate(${j * 5}px, ${j * -5}px)`, zIndex: 3 - j }}>
                      <PageImg page={p} className="h-full w-full rounded-lg shadow-card ring-1 ring-border" />
                    </div>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  {docs.length > 1 && <p className="text-xs font-semibold text-muted-foreground">Dokuments {i + 1}</p>}
                  <h2 className="truncate text-lg font-bold">{has ? `${data.type} ${data.fields.number.value}` : "Skenēts dokuments"}</h2>
                  <p className="text-sm text-muted-foreground">{g.length} {g.length === 1 ? "lapa" : "lapas"}{has && data.fields.amount.value ? ` · ${data.fields.amount.value} ${data.fields.currency.value}` : ""}</p>
                  <div className="mt-2">
                    {!has ? <Chip>Bez datiem</Chip> : c.check === 0 ? <Chip tone="success"><CheckCircle2 className="h-3.5 w-3.5" />Dati pārbaudīti</Chip> : <Chip tone="warning">{c.check} nav pārbaudīti</Chip>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-bold">Ko iekļaut PDF failā?</legend>
          <div className="flex flex-col gap-2.5" role="radiogroup">
            <Choice checked={mode === "info"} disabled={!anyInfo} onClick={() => setMode("info")} icon={FileCheck2}
              title="PDF ar informāciju" desc={anyInfo ? "Pirmajā lapā — kopsavilkums ar jūsu apstiprinātajiem datiem, pēc tam skenējums." : "Pieejams, ja dokumenta dati ir atpazīti."} />
            <Choice checked={mode === "scan"} onClick={() => setMode("scan")} icon={FileImage} title="Tikai skenējums" desc="Tikai nofotografētās lapas, bez papildu informācijas." />
          </div>
        </fieldset>

        <button onClick={() => setAdv(!adv)} aria-expanded={adv} className="mt-5 flex h-11 w-full items-center justify-between text-sm font-semibold text-muted-foreground">
          Papildu iestatījumi<ChevronDown className={cn("h-4 w-4 transition", adv && "rotate-180")} />
        </button>
        {adv && (
          <div className="space-y-4 rounded-2xl bg-card p-4 shadow-card animate-rise">
            <Segmented label="Lapas izmērs" value={size} onChange={setSize} options={[["A4", "A4"], ["Letter", "Letter"], ["fit", "Pēc foto"]]} />
            <Segmented label="Kvalitāte" value={quality} onChange={setQuality} options={[["standard", "Standarta"], ["high", "Augsta"]]} />
          </div>
        )}
        <p className="mt-5 flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-success" />PDF tiek izveidots šajā ierīcē un saglabāts mapē „Lejupielādes”.</p>
      </main>
      <StepFooter step={4}>
        <Btn variant="ghost" size="md" className="w-full" disabled={busy} onClick={doPreview}><Eye className="h-5 w-5" />Priekšskatīt</Btn>
        <Btn size="lg" disabled={busy} onClick={doDownload}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          {docs.length > 1 ? `Lejupielādēt ${docs.length} PDF` : "Lejupielādēt PDF"}
        </Btn>
      </StepFooter>
      <Sheet open={!!previewUrl} onClose={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} title="Priekšskatījums">
        {previewUrl && <iframe title="PDF priekšskatījums" src={previewUrl} className="mb-3 h-[62vh] w-full rounded-2xl border border-border bg-muted" />}
        {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="mb-3 block text-center text-sm font-semibold text-primary">Atvērt pilnā ekrānā</a>}
      </Sheet>
    </>
  );
}

function Choice({ checked, onClick, icon: I, title, desc, disabled }: { checked: boolean; onClick: () => void; icon: typeof Plus; title: string; desc: string; disabled?: boolean }) {
  return (
    <button role="radio" aria-checked={checked} disabled={disabled} onClick={onClick}
      className={cn("flex items-start gap-3 rounded-2xl border-2 bg-card p-4 text-left transition disabled:opacity-50", checked ? "border-primary" : "border-border")}>
      <I className={cn("mt-0.5 h-6 w-6 shrink-0", checked ? "text-primary" : "text-muted-foreground")} />
      <span className="flex-1"><span className="block font-bold">{title}</span><span className="mt-0.5 block text-sm text-muted-foreground">{desc}</span></span>
      <span className={cn("mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", checked ? "border-primary" : "border-input")}>
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </span>
    </button>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="flex rounded-xl bg-muted p-1">
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
            className={cn("h-10 flex-1 rounded-lg text-sm font-semibold transition", value === v ? "bg-card text-foreground shadow-card" : "text-muted-foreground")}>{l}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Done ---------- */
function DoneScreen({ nav }: { nav: Nav }) {
  const { current, start } = useStore();
  if (!current) return null;
  return (
    <>
      <main className="pt-safe flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-success-soft text-success animate-pop"><CheckCircle2 className="h-12 w-12" /></span>
        <h1 className="mt-6 text-3xl font-extrabold">Gatavs!</h1>
        <p className="mt-2 text-muted-foreground">PDF saglabāts jūsu ierīces lejupielādēs.</p>
        <ul className="mt-5 w-full space-y-2">
          {current.exportedNames.map((n) => (
            <li key={n} className="flex items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-card"><FileText className="h-5 w-5 text-primary" /><span className="truncate text-sm font-semibold">{n}</span></li>
          ))}
        </ul>
      </main>
      <footer className="pb-safe flex flex-col gap-2 px-4 pt-3">
        <Btn size="lg" onClick={() => { start(); nav.reset({ name: "home" }); nav.go({ name: "capture" }); }}><Camera className="h-5 w-5" />Skenēt nākamo dokumentu</Btn>
        <Btn variant="ghost" size="md" className="w-full" onClick={() => nav.reset({ name: "docs" })}>Uz dokumentiem</Btn>
      </footer>
    </>
  );
}

/* ---------- 6. Documents ---------- */
function DocsScreen({ nav }: { nav: Nav }) {
  const { state, open, remove } = useStore();
  const [menuFor, setMenuFor] = useState<Draft | null>(null);
  const list = state.drafts.filter((d) => d.pages.length);
  return (
    <>
      <Header title="Dokumenti" sub="Saglabāti tikai šajā ierīcē"
        right={<Btn variant="ghost" size="icon" aria-label="Iestatījumi" onClick={() => nav.go({ name: "settings" })}><Cog className="h-5 w-5" /></Btn>} />
      <main className="flex-1 overflow-y-auto px-4 pb-6">
        {!list.length ? (
          <div className="mt-20 flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary"><FileText className="h-7 w-7" /></span>
            <p className="mt-4 font-semibold">Vēl nav dokumentu</p>
            <p className="mt-1 max-w-[240px] text-sm text-muted-foreground">Noskenētie dokumenti parādīsies šeit, lai varētu turpināt vēlāk.</p>
            <Btn className="mt-6" onClick={() => nav.reset({ name: "home" })}><Camera className="h-5 w-5" />Skenēt dokumentu</Btn>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((d) => {
              const st = draftStatus(d);
              return (
                <article key={d.id} className="rounded-2xl bg-card p-3 shadow-card">
                  <div className="flex gap-3">
                    <PageImg page={d.pages[0]!} className="h-20 w-15 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-bold">{draftTitle(d)}</h2>
                      <p className="text-xs text-muted-foreground">{d.pages.length} lp. · atjaunots {relTime(d.updatedAt)}</p>
                      <Chip tone={st.tone} className="mt-2">{st.label}</Chip>
                    </div>
                    <Btn variant="ghost" size="icon" aria-label="Vairāk" onClick={() => setMenuFor(d)}><MoreVertical className="h-5 w-5" /></Btn>
                  </div>
                  {!d.exported && <Btn variant="soft" size="sm" className="mt-3 w-full" onClick={() => { open(d.id); resume(nav, d); }}>Turpināt<ArrowRight className="h-4 w-4" /></Btn>}
                </article>
              );
            })}
            <p className="mt-2 text-center text-xs text-muted-foreground">Lejupielādētie PDF faili atrodas jūsu ierīces mapē „Lejupielādes”.</p>
          </div>
        )}
      </main>
      <BottomNav nav={nav} active="docs" />
      <Sheet open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor ? draftTitle(menuFor) : ""}>
        {menuFor && (
          <div className="flex flex-col pb-2">
            <MenuItem icon={menuFor.exported ? Download : ArrowRight} label={menuFor.exported ? "Izveidot PDF vēlreiz" : "Turpināt"}
              onClick={() => { open(menuFor.id); const d = menuFor; setMenuFor(null); nav.go({ name: d.exported ? "pdf" : ({ capture: "capture", pages: "pages", fields: "fields", pdf: "pdf", done: "pdf" } as const)[d.stage] }); }} />
            <MenuItem icon={Layers} label="Pārbaudīt lapas" onClick={() => { open(menuFor.id); setMenuFor(null); nav.go({ name: "pages" }); }} />
            <MenuItem icon={Trash2} danger label="Dzēst no ierīces" onClick={() => { remove(menuFor.id); setMenuFor(null); nav.toast("Dokuments izdzēsts"); }} />
          </div>
        )}
      </Sheet>
    </>
  );
}

/* ---------- Settings ---------- */
function SettingsScreen({ nav }: { nav: Nav }) {
  const { state, setSettings, clearAll } = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Header title="Iestatījumi" onBack={nav.back} right={<span className="pr-3"><SaveBadge /></span>} />
      <main className="flex-1 space-y-4 overflow-y-auto px-4 pb-8">
        <section className="space-y-4 rounded-2xl bg-card p-4 shadow-card">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">{state.settings.theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}Izskats</p>
            <Segmented label="" value={state.settings.theme} onChange={(v) => setSettings({ theme: v })} options={[["light", "Gaišs"], ["dark", "Tumšs"]]} />
          </div>
          <Segmented label="Noklusējuma PDF" value={state.settings.defaultMode} onChange={(v) => setSettings({ defaultMode: v })} options={[["info", "Ar informāciju"], ["scan", "Tikai skenējums"]]} />
        </section>
        <Link to="/spec" className="flex min-h-14 items-center gap-3 rounded-2xl bg-card p-4 font-semibold shadow-card">
          <BookOpen className="h-5 w-5 text-primary" /><span className="flex-1">Dizaina specifikācija</span><ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
        <section className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-card">
          <p className="mb-1 font-semibold text-foreground">Par šo prototipu</p>
          Dizaina koncepts. Kamera un datu atpazīšana ir simulēta ar demonstrācijas datiem. Faili un melnraksti netiek sūtīti nekur — tie glabājas tikai šajā pārlūkā.
        </section>
        <Btn variant="dangerGhost" size="md" className="w-full" onClick={() => setConfirm(true)}><Trash2 className="h-5 w-5" />Dzēst visus dokumentus</Btn>
      </main>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Dzēst visus dokumentus?">
        <p className="mb-5 text-sm text-muted-foreground">Visi melnraksti tiks dzēsti no šīs ierīces. Jau lejupielādētie PDF paliks.</p>
        <div className="flex flex-col gap-2 pb-2">
          <Btn variant="danger" size="lg" onClick={() => { clearAll(); setConfirm(false); nav.toast("Visi dokumenti izdzēsti"); }}>Dzēst visu</Btn>
          <Btn variant="ghost" size="lg" onClick={() => setConfirm(false)}>Atcelt</Btn>
        </div>
      </Sheet>
    </>
  );
}
