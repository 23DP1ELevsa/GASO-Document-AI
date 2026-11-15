import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import spec from "../../DESIGN_SPEC.md?raw";

export const Route = createFileRoute("/spec")({
  head: () => ({
    meta: [
      { title: "Dizaina specifikācija — GASO Dokumenti" },
      { name: "description", content: "Dizaina žetoni, ekrānu karte, teksti un Vue komponentu kartējums GASO Document AI mobilajai lietotnei." },
      { property: "og:title", content: "Dizaina specifikācija — GASO Dokumenti" },
      { property: "og:description", content: "Mobilās UX koncepta īstenošanas ceļvedis izstrādātājiem." },
    ],
  }),
  component: SpecPage,
});

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong>
    : p.startsWith("`") ? <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{p.slice(1, -1)}</code>
    : p,
  );
}

function render(md: string) {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  const at = (k: number) => lines[k] ?? "";
  let i = 0;
  while (i < lines.length) {
    const l = at(i);
    if (l.startsWith("```")) {
      const buf: string[] = []; i++;
      while (i < lines.length && !at(i).startsWith("```")) buf.push(at(i++));
      out.push(<pre key={i} className="my-4 overflow-x-auto rounded-xl bg-muted p-3 text-xs leading-relaxed">{buf.join("\n")}</pre>);
    } else if (l.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && at(i).startsWith("|")) {
        if (!/^\|[-|\s]+\|$/.test(at(i))) rows.push(at(i).slice(1, -1).split("|").map((c) => c.trim()));
        i++;
      }
      i--;
      out.push(
        <div key={i} className="my-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted"><tr>{(rows[0] ?? []).map((c, j) => <th key={j} className="p-2.5 font-semibold">{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.slice(1).map((r, k) => <tr key={k} className="border-t border-border">{r.map((c, j) => <td key={j} className="p-2.5 align-top">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    } else if (l.startsWith("# ")) out.push(<h1 key={i} className="mb-4 text-2xl font-extrabold tracking-tight">{l.slice(2)}</h1>);
    else if (l.startsWith("## ")) out.push(<h2 key={i} className="mb-2 mt-10 text-xl font-bold">{l.slice(3)}</h2>);
    else if (l.startsWith("### ")) out.push(<h3 key={i} className="mb-2 mt-6 font-bold text-primary">{l.slice(4)}</h3>);
    else if (l.startsWith("> ")) out.push(<blockquote key={i} className="my-4 rounded-xl border-l-4 border-warning bg-warning-soft p-4 text-sm">{inline(l.slice(2))}</blockquote>);
    else if (l.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && at(i).startsWith("- ")) items.push(at(i++).slice(2));
      i--;
      out.push(<ul key={i} className="my-2 list-disc space-y-1.5 pl-5 text-[15px]">{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>);
    } else if (l.trim()) out.push(<p key={i} className="my-2 text-[15px] leading-relaxed">{inline(l)}</p>);
    i++;
  }
  return out;
}

function SpecPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
          <Link to="/" aria-label="Atpakaļ uz prototipu" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="font-bold">Dizaina specifikācija</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{render(spec)}</main>
    </div>
  );
}
