import type { ReactNode } from "react";
import type { ReportStatus } from "../types";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-white ${className}`}>{children}</div>
  );
}

export function CardHead({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

const STATUS_STYLE: Record<ReportStatus | "error", string> = {
  ok: "bg-ink-50 text-ink-700 border-ink-100",
  attention: "bg-[#fdf3e2] text-attention border-[#f0dcb8]",
  blocked: "bg-[#fbeceb] text-blocked border-[#f3d3d0]",
  empty: "bg-paper text-muted border-line",
  error: "bg-[#fbeceb] text-blocked border-[#f3d3d0]",
};

const STATUS_MARK: Record<ReportStatus | "error", string> = {
  ok: "✅",
  attention: "⚠️",
  blocked: "⛔",
  empty: "ℹ️",
  error: "⛔",
};

export function StatusPill({
  status,
  children,
}: {
  status: ReportStatus | "error";
  children?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLE[status]}`}
    >
      <span aria-hidden>{STATUS_MARK[status]}</span>
      {children ?? status}
    </span>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warm" | "ink" }) {
  const tones = {
    neutral: "border-line bg-paper text-muted",
    warm: "border-champagne-deep bg-champagne-soft text-[#7a5a1a]",
    ink: "border-ink-100 bg-ink-50 text-ink-700",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "warm" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const variants = {
    primary: "bg-ink-900 text-champagne hover:bg-ink-800 disabled:bg-ink-900/40",
    warm: "bg-champagne text-ink-900 hover:bg-champagne-deep border border-champagne-deep",
    ghost: "border border-line bg-white text-ink-900 hover:bg-paper",
    danger: "border border-[#f3d3d0] bg-white text-blocked hover:bg-[#fbeceb]",
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-600 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink-900">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Typing() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-500" />
      ))}
    </span>
  );
}
