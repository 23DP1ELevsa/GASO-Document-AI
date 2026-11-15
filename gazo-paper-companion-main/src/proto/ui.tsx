import { cva, type VariantProps } from "class-variance-authority";
import { ArrowLeft, Check, CloudOff, Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "./store";
import { pageSrc } from "./demo-pages";
import type { Page } from "./model";

export const btn = cva(
  "inline-flex select-none items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-cta hover:brightness-105",
        secondary: "bg-card text-foreground border border-border shadow-card hover:bg-muted",
        soft: "bg-primary-soft text-accent-foreground hover:brightness-[0.98]",
        ghost: "text-foreground hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
        danger: "bg-destructive text-destructive-foreground",
        dangerGhost: "text-destructive hover:bg-destructive-soft",
        camera: "bg-viewfinder-foreground/12 text-viewfinder-foreground backdrop-blur hover:bg-viewfinder-foreground/20",
      },
      size: {
        lg: "h-14 rounded-2xl px-6 text-[17px] w-full",
        md: "h-12 rounded-xl px-5 text-[15px]",
        sm: "h-11 rounded-xl px-3 text-sm",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof btn>;
export const Btn = forwardRef<HTMLButtonElement, BtnProps>(({ className, variant, size, ...p }, ref) => (
  <button ref={ref} type="button" className={cn(btn({ variant, size }), className)} {...p} />
));
Btn.displayName = "Btn";

export function Header({ title, onBack, right, sub }: { title: ReactNode; onBack?: () => void; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-background/90 backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-2">
        {onBack ? (
          <Btn variant="ghost" size="icon" aria-label="Atpakaļ" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Btn>
        ) : <span className="w-3" />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold leading-tight">{title}</h1>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function SaveBadge() {
  const { save } = useStore();
  if (save === "error") return <span className="flex items-center gap-1 text-xs font-medium text-destructive"><CloudOff className="h-3.5 w-3.5" />Nav saglabāts</span>;
  if (save === "saving") return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saglabā…</span>;
  if (save === "saved") return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-success" />Saglabāts ierīcē</span>;
  return null;
}

export const STEPS = ["Foto", "Lapas", "Dati", "PDF"];
export function StepFooter({ step, children, hint }: { step: number; children: ReactNode; hint?: ReactNode }) {
  return (
    <footer className="pb-safe sticky bottom-0 z-20 border-t border-border bg-card/95 px-4 pt-3 shadow-float backdrop-blur">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Solis {step} no 4 · <span className="text-foreground">{STEPS[step - 1]}</span>
        </span>
        <SaveBadge />
      </div>
      <div className="mb-3 flex gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={cn("h-1 flex-1 rounded-full transition-colors", i < step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
      {hint && <p className="mb-2 text-center text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-col gap-2">{children}</div>
    </footer>
  );
}

export function PageImg({ page, className }: { page: Page; className?: string }) {
  const rot = page.rotation % 360;
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-muted", className)}>
      <img
        src={pageSrc(page)}
        alt=""
        draggable={false}
        className="max-h-full max-w-full object-contain transition-transform duration-300"
        style={{ transform: `rotate(${rot}deg) scale(${rot % 180 ? 0.7 : 1})`, clipPath: page.cropped ? "inset(4%)" : undefined }}
      />
    </div>
  );
}

export function Chip({ tone = "muted", children, className }: { tone?: "success" | "warning" | "primary" | "muted" | "danger"; children: ReactNode; className?: string }) {
  const tones = {
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    primary: "bg-primary-soft text-accent-foreground",
    muted: "bg-muted text-muted-foreground",
    danger: "bg-destructive-soft text-destructive",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
      <button aria-label="Aizvērt" className="absolute inset-0 bg-foreground/35 animate-in fade-in" onClick={onClose} />
      <div className="pb-safe animate-sheet relative max-h-[88%] overflow-y-auto rounded-t-3xl bg-card px-5 pt-3 shadow-float">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Logo() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-cta" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M7 3h7l4 4v14H7z" /><path d="M10 12h5M10 16h3" /><path d="M3 8V5a2 2 0 0 1 2-2M3 16v3a2 2 0 0 0 2 2" />
      </svg>
    </span>
  );
}
