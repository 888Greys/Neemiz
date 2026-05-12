import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface p-4 text-on-surface">
      <div className="mb-8 text-center">
        <Link href="/" className="text-3xl font-black uppercase tracking-tight text-primary">
          NEEMIZ
        </Link>
        <p className="mt-2 text-sm text-on-surface-variant">Sign in to your account</p>
      </div>
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#4edea3",
            colorBackground: "#171f33",
            colorText: "#dae2fd",
            colorTextSecondary: "#bbcabf",
            colorInputBackground: "#0b1326",
            colorInputText: "#dae2fd",
            borderRadius: "0.5rem",
            fontFamily: "var(--font-inter), sans-serif",
          },
          elements: {
            card: "bg-surface-container border border-outline-variant shadow-xl",
            headerTitle: "text-on-surface font-black tracking-tight",
            headerSubtitle: "text-on-surface-variant",
            formButtonPrimary:
              "bg-primary-container text-on-primary-container hover:bg-primary transition font-semibold",
            formFieldInput:
              "bg-surface-dim border-outline-variant text-on-surface focus:border-primary",
            formFieldLabel: "text-on-surface-variant text-xs uppercase tracking-widest font-bold",
            footerActionLink: "text-primary hover:text-primary-fixed",
            identityPreviewText: "text-on-surface",
            identityPreviewEditButton: "text-primary",
            dividerLine: "bg-outline-variant",
            dividerText: "text-on-surface-variant",
            socialButtonsBlockButton:
              "border-outline-variant bg-surface-container text-on-surface hover:bg-surface-variant transition",
            socialButtonsBlockButtonText: "text-on-surface",
          },
        }}
      />
    </main>
  );
}
