import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${COMPANY.brand}, operated by ${COMPANY.legalName}.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="11 July 2026">
      <LegalSection title="1. Who we are">
        <p>
          This Privacy Policy explains how <strong className="text-slate-200">{COMPANY.legalName}</strong>{" "}
          (&quot;we&quot;, &quot;us&quot;) collects and uses personal data when you use {COMPANY.brand}.
          Company No. {COMPANY.companyNumber}. Registered office: KCB Building, Room 3, Tembo Road,
          Nyeri Town, Nyeri, Kenya.
        </p>
      </LegalSection>

      <LegalSection title="2. Data we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Account data: email, username, phone number, password hashes / auth identifiers</li>
          <li>Identity & compliance data when required (e.g. KYC documents, device signals)</li>
          <li>Transaction data: deposits, withdrawals, bets, P2P orders, wallet activity</li>
          <li>Technical data: IP address, device/browser info, approximate location, cookies</li>
          <li>Support communications and Telegram / email correspondence you send us</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use data">
        <p>We use personal data to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide and secure the Platform (accounts, wallet, markets, support)</li>
          <li>Process payments and crypto transfers</li>
          <li>Detect fraud, abuse, multi-accounting, and money-laundering risk</li>
          <li>Meet legal, tax, and regulatory obligations</li>
          <li>Send service notices; marketing only where permitted and with opt-out</li>
          <li>Improve product performance and user experience</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Legal bases">
        <p>
          Depending on the context, we process data because it is necessary to perform our contract with you,
          to comply with law, for legitimate interests (security, fraud prevention, product improvement),
          or with your consent where required.
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing">
        <p>
          We may share data with payment processors, crypto infrastructure providers, cloud/hosting vendors,
          analytics and security tools, professional advisers, and authorities when legally required.
          We do not sell your personal data.
        </p>
      </LegalSection>

      <LegalSection title="6. International transfers">
        <p>
          Service providers may process data outside Kenya. Where we transfer data internationally, we take
          steps appropriate to the risk and applicable law.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention">
        <p>
          We keep account and transaction records for as long as your account is active and thereafter as
          needed for legal, tax, dispute, and fraud-prevention purposes (often several years after closure).
        </p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          We use technical and organisational measures to protect data (encryption in transit, access controls,
          monitoring). No method of transmission or storage is 100% secure.
        </p>
      </LegalSection>

      <LegalSection title="9. Your choices">
        <p>
          Subject to law, you may request access, correction, or deletion of personal data, or object to
          certain processing. Contact{" "}
          <a className="text-[#087cff] hover:underline" href={`mailto:${COMPANY.emails.business}`}>
            {COMPANY.emails.business}
          </a>
          . Some data must be retained for compliance and cannot be deleted on request.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          The Platform is not directed to anyone under 18. We do not knowingly collect data from minors.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update this Policy periodically. The &quot;Last updated&quot; date at the top will change when we do.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Privacy enquiries:{" "}
          <a className="text-[#087cff] hover:underline" href={`mailto:${COMPANY.emails.business}`}>
            {COMPANY.emails.business}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
