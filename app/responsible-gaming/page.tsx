import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Responsible Gaming",
  description: `Responsible gaming guidance for ${COMPANY.brand}.`,
};

export default function ResponsibleGamingPage() {
  return (
    <LegalPage title="Responsible Gaming" updated="11 July 2026">
      <LegalSection title="Play for entertainment">
        <p>
          {COMPANY.brand} is for adults who choose to bet or trade for entertainment. Never stake money you
          cannot afford to lose. Outcomes are uncertain — treat losses as the cost of entertainment, not as
          something to &quot;chase&quot; back.
        </p>
      </LegalSection>

      <LegalSection title="18+ only">
        <p>
          You must be 18 or older. We may request age verification. Accounts belonging to minors will be closed
          and balances handled in line with our Terms and applicable law.
        </p>
      </LegalSection>

      <LegalSection title="Healthy habits">
        <ul className="list-disc space-y-1 pl-5">
          <li>Set a budget before you play and stick to it</li>
          <li>Take regular breaks; avoid playing when upset, tired, or under the influence</li>
          <li>Do not borrow money to bet or trade</li>
          <li>Keep betting separate from essential expenses (rent, food, school fees)</li>
        </ul>
      </LegalSection>

      <LegalSection title="Warning signs">
        <p>Seek help if you:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Spend more time or money than planned</li>
          <li>Hide activity from family or friends</li>
          <li>Feel anxious, irritable, or depressed about gambling</li>
          <li>Chase losses or bet to escape problems</li>
        </ul>
      </LegalSection>

      <LegalSection title="Support">
        <p>
          If you need help controlling your play, contact us at{" "}
          <a className="text-[#087cff] hover:underline" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>{" "}
          to discuss account limits or closure. You can also reach out to local counselling services or
          organisations that specialise in problem gambling in your country.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
