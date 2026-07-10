import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { COMPANY, companyAddressLines } from "@/lib/company";

export const metadata: Metadata = {
  title: "About",
  description: `About ${COMPANY.brand} and ${COMPANY.legalName}.`,
};

export default function AboutPage() {
  return (
    <LegalPage title={`About ${COMPANY.brand}`} updated="11 July 2026">
      <LegalSection title="Who we are">
        <p>
          {COMPANY.brand} is a multi-product platform for sports betting, crash games, predictions,
          P2P trading, binary and forex-style markets, and a unified Smart Wallet — built for players who
          want one balance across every market.
        </p>
        <p>
          The Platform is operated by <strong className="text-slate-200">{COMPANY.legalName}</strong>,
          a private limited company incorporated in Kenya on {COMPANY.incorporated}.
        </p>
      </LegalSection>

      <LegalSection title="Company details">
        <dl className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <dt className="text-slate-500">Legal name</dt>
          <dd className="text-slate-200">{COMPANY.legalName}</dd>
          <dt className="text-slate-500">Company No.</dt>
          <dd className="text-slate-200">{COMPANY.companyNumber}</dd>
          <dt className="text-slate-500">KRA PIN</dt>
          <dd className="text-slate-200">{COMPANY.kraPin}</dd>
          <dt className="text-slate-500">Registered office</dt>
          <dd className="text-slate-200">
            {companyAddressLines().map((line) => (
              <span key={line} className="block">{line}</span>
            ))}
          </dd>
        </dl>
      </LegalSection>

      <LegalSection title="Contact">
        <ul className="space-y-1">
          <li>
            Business:{" "}
            <a className="text-[#087cff] hover:underline" href={`mailto:${COMPANY.emails.business}`}>
              {COMPANY.emails.business}
            </a>
          </li>
          <li>
            Partners:{" "}
            <a className="text-[#087cff] hover:underline" href={`mailto:${COMPANY.emails.partners}`}>
              {COMPANY.emails.partners}
            </a>
          </li>
          <li>
            Telegram:{" "}
            <a
              className="text-[#087cff] hover:underline"
              href={COMPANY.social.telegram}
              target="_blank"
              rel="noopener noreferrer"
            >
              @nezeemofficial
            </a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Policies">
        <p className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/terms" className="text-[#087cff] hover:underline">Terms of Service</Link>
          <Link href="/privacy" className="text-[#087cff] hover:underline">Privacy Policy</Link>
          <Link href="/responsible-gaming" className="text-[#087cff] hover:underline">Responsible Gaming</Link>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
