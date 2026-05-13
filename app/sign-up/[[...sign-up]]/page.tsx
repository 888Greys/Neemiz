import { SignUp } from "@clerk/nextjs";
import { ClerkAuthShell } from "@/components/clerk-auth-shell";

export default function SignUpPage() {
  return (
    <ClerkAuthShell>
      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full",
            cardBox: "w-full shadow-none",
            card: "w-full rounded-2xl border border-white/10 bg-[#111116] shadow-2xl shadow-black/30",
            headerTitle: "text-xl font-black text-white",
            headerSubtitle: "text-sm text-slate-300",
            socialButtonsBlockButton: "border-white/10 bg-transparent text-white hover:bg-white/[0.04]",
            dividerLine: "bg-white/10",
            dividerText: "text-slate-300",
            formFieldLabel: "text-sm font-bold text-white",
            formFieldInput: "h-10 rounded-lg border-0 bg-[#24242a] text-white placeholder:text-slate-400 focus:ring-1 focus:ring-violet-500",
            formButtonPrimary: "h-11 rounded-lg bg-white text-sm font-bold text-black hover:bg-slate-200",
            footer: "bg-[#17171d] border-t border-white/10 rounded-b-2xl",
            footerActionText: "text-slate-300",
            footerActionLink: "font-bold text-white hover:text-violet-300",
          },
        }}
        forceRedirectUrl="/dashboard"
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
      />
    </ClerkAuthShell>
  );
}
