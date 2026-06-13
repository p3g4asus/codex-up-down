"use client";

type PrintButtonProps = {
  label?: string;
};

export function PrintButton({ label = "Stampa report" }: PrintButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 print:hidden"
    >
      {label}
    </button>
  );
}
