import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${COMPANY.brand}, operated by ${COMPANY.legalName}.`,
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="11 July 2026">
      <LegalSection title="1. Agreement">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the {COMPANY.brand} website,
          apps, and related services (the &quot;Platform&quot;). The Platform is operated by{" "}
          <strong className="text-slate-200">{COMPANY.legalName}</strong> (Company No. {COMPANY.companyNumber}),
          a private limited company incorporated in Kenya.
        </p>
        <p>
          By creating an account or using the Platform, you agree to these Terms and our Privacy Policy.
          If you do not agree, do not use the Platform.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          You must be at least <strong className="text-slate-200">18 years old</strong> and legally able to
          enter into binding contracts in your jurisdiction. You are responsible for ensuring that online
          betting, gaming, and related products are lawful where you live. We may refuse, suspend, or close
          accounts that fail age or eligibility checks.
        </p>
      </LegalSection>

      <LegalSection title="3. Account & security">
        <p>
          You must provide accurate registration details and keep your login credentials confidential.
          You are responsible for activity under your account. Notify us immediately at{" "}
          <a className="text-[#087cff] hover:underline" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>{" "}
          if you suspect unauthorised access. We may require identity, phone, or other verification before
          deposits, withdrawals, or certain features.
        </p>
      </LegalSection>

      <LegalSection title="4. Products">
        <p>
          {COMPANY.brand} may offer sports betting, crash games, predictions, P2P trading, binary/forex-style
          markets, wallet services, and other products. Features may change, be limited by region, or be
          unavailable without notice. Odds, multipliers, and market availability can change until a bet or
          order is accepted.
        </p>
      </LegalSection>

      <LegalSection title="5. Wallet, deposits & withdrawals">
        <p>
          Funds in your Smart Wallet may be held as local currency balance and/or crypto balances as shown
          in the app. Deposits and withdrawals are subject to method availability, minimums, fees, network
          conditions, and compliance checks. Crypto transfers are irreversible once broadcast; always confirm
          asset and network before sending. We are not responsible for funds sent to the wrong address or network.
        </p>
        <p>
          We may delay or refuse withdrawals where we reasonably suspect fraud, chargebacks, AML risk,
          bonus abuse, or Terms breaches, or where required by law.
        </p>
      </LegalSection>

      <LegalSection title="6. Fair play & prohibited conduct">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Use bots, scripts, or multi-accounting to abuse promotions or markets</li>
          <li>Collude, manipulate markets, or exploit obvious pricing/system errors</li>
          <li>Use the Platform for money laundering or other illegal activity</li>
          <li>Harass other users or abuse P2P escrow / chat features</li>
        </ul>
        <p>
          We may void bets, reverse credits, freeze balances, and close accounts where we reasonably believe
          these rules were broken.
        </p>
      </LegalSection>

      <LegalSection title="7. Bonuses & promotions">
        <p>
          Promotional offers are subject to their own rules (eligibility, wagering, expiry, device limits).
          Abuse of promotions may result in forfeiture of bonus funds and related winnings.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p>
          The {COMPANY.brand} name, logos, UI, and content are owned by {COMPANY.legalName} or its licensors.
          You may not copy, scrape, or commercially exploit the Platform without written permission.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimers & liability">
        <p>
          The Platform is provided on an &quot;as available&quot; basis. Betting and trading involve risk of loss.
          To the fullest extent permitted by law, {COMPANY.legalName} is not liable for indirect, incidental,
          or consequential damages, or for losses caused by network outages, third-party payment rails,
          blockchain congestion, or force majeure. Our aggregate liability for any claim relating to the
          Platform is limited to the fees you paid us in the three months before the claim, or KES 10,000,
          whichever is greater.
        </p>
      </LegalSection>

      <LegalSection title="10. Suspension & termination">
        <p>
          You may stop using the Platform at any time. We may suspend or terminate access for Terms breaches,
          legal risk, or operational reasons. Upon closure, eligible withdrawable balances may be returned
          subject to verification and applicable law.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update these Terms from time to time. Material changes will be reflected by updating the
          &quot;Last updated&quot; date on this page. Continued use after changes constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing law">
        <p>
          These Terms are governed by the laws of Kenya. Courts in Kenya have exclusive jurisdiction,
          without prejudice to mandatory consumer protections that may apply in your country of residence.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Legal and general enquiries:{" "}
          <a className="text-[#087cff] hover:underline" href={`mailto:${COMPANY.emails.business}`}>
            {COMPANY.emails.business}
          </a>
          <br />
          Partnerships:{" "}
          <a className="text-[#087cff] hover:underline" href={`mailto:${COMPANY.emails.partners}`}>
            {COMPANY.emails.partners}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
