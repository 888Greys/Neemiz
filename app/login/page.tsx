import Link from "next/link";
import { Icon } from "@/components/icon";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4 text-on-surface">
      <div className="flex w-full max-w-sm flex-col">
        <div className="mb-10 text-center">
          <Link href="/" className="text-3xl font-black uppercase tracking-tight text-primary">NEEMIZ</Link>
        </div>
        <div className="mb-6 flex border-b border-outline-variant">
          <button className="flex-1 border-b-2 border-primary pb-3 text-center text-primary">Login</button>
          <button className="flex-1 pb-3 text-center text-on-surface-variant">Sign Up</button>
        </div>
        <form className="space-y-4">
          <Field id="identifier" label="Email or Phone" placeholder="Enter your credentials" type="text" />
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="password">Password</label>
            <div className="relative">
              <input id="password" className="w-full rounded-lg border border-outline-variant bg-surface-dim px-4 py-3 outline-none transition focus:border-secondary-container" placeholder="••••••••" type="password" />
              <button className="absolute inset-y-0 right-3 text-on-surface-variant" type="button"><Icon name="visibility_off" className="text-[20px]" /></button>
            </div>
            <div className="mt-2 text-right"><a className="text-sm text-primary" href="#">Forgot Password?</a></div>
          </div>
          <button className="w-full rounded-lg bg-primary-container py-3 font-semibold text-on-background transition hover:bg-primary" type="button">Sign In</button>
        </form>
        <div className="my-6 flex items-center"><div className="flex-grow border-t border-outline-variant" /><span className="px-4 text-xs uppercase tracking-widest text-on-surface-variant">or</span><div className="flex-grow border-t border-outline-variant" /></div>
        <div className="space-y-2">
          <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant py-3 transition hover:bg-surface-variant"><Icon name="language" className="text-[20px]" />Continue with Google</button>
          <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant py-3 transition hover:bg-surface-variant"><Icon name="phone_iphone" className="text-[20px]" />Continue with Apple</button>
        </div>
        <p className="mt-10 px-4 text-center text-sm text-on-surface-variant">By continuing, you agree to our <a className="text-on-surface underline" href="#">Terms of Service</a> and <a className="text-on-surface underline" href="#">Privacy Policy</a>.</p>
      </div>
    </main>
  );
}

function Field({ id, label, placeholder, type }: { id: string; label: string; placeholder: string; type: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor={id}>{label}</label>
      <input id={id} className="w-full rounded-lg border border-outline-variant bg-surface-dim px-4 py-3 outline-none transition focus:border-secondary-container" placeholder={placeholder} type={type} />
    </div>
  );
}
