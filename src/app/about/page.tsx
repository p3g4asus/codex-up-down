import { FeedbackBanner } from "@/components/feedback-banner";
import { PageShell } from "@/components/page-shell";
import { ProtectedDeleteCodeForm } from "@/components/protected-delete-code-form";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/app-info";

export default function AboutPage() {
  return (
    <PageShell
      title="About"
      description="Informazioni applicazione e versione installata."
    >
      <FeedbackBanner />
      <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
        <h2 className="text-2xl font-semibold text-slate-950">{APP_NAME}</h2>
        <p className="mt-2 text-sm uppercase tracking-[0.2em] text-slate-500">{APP_TAGLINE}</p>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{APP_DESCRIPTION}</p>

        <div className="mt-6 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
          Versione: {APP_VERSION}
        </div>

        <ProtectedDeleteCodeForm />
      </section>
    </PageShell>
  );
}
