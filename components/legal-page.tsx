import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { COMPANY, companyAddressOneLine } from "@/lib/company";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <article className="mx-auto w-full max-w-3xl px-5 py-10 md:px-8 md:py-14">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {COMPANY.legalName}
        </p>
        <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">{title}</h1>
        <p className="mt-2 text-[12px] text-slate-500">Last updated: {updated}</p>

        <div className="prose-legal mt-8 space-y-6 text-[14px] leading-relaxed text-slate-300">
          {children}
        </div>

        <div className="mt-10 border-t border-white/[0.06] pt-6 text-[12px] text-slate-500">
          <p>
            Operated by <span className="text-slate-300">{COMPANY.legalName}</span>
            {" "}({COMPANY.companyNumber}). Registered office: {companyAddressOneLine()}.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/terms" className="text-slate-400 transition hover:text-white">Terms</Link>
            <Link href="/privacy" className="text-slate-400 transition hover:text-white">Privacy</Link>
            <Link href="/responsible-gaming" className="text-slate-400 transition hover:text-white">Responsible Gaming</Link>
            <Link href="/about" className="text-slate-400 transition hover:text-white">About</Link>
          </p>
        </div>
      </article>
    </AppShell>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-black text-white">{title}</h2>
      <div className="space-y-3 text-slate-400">{children}</div>
    </section>
  );
}
