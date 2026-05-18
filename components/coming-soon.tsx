import { Icon } from "@/components/icon";

type Props = { icon: string; title: string; description: string };

export function ComingSoon({ icon, title, description }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-24 text-center animate-fade-up"
      style={{ animationDuration: "0.5s" }}
    >
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#1e2028] animate-pulse-ring">
        <Icon name={icon} fill className="text-[42px] text-slate-500" />
      </div>
      <h2 className="text-2xl font-black text-white">{title}</h2>
      <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">{description}</p>
      <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1e2028] px-5 py-2 text-xs font-black uppercase tracking-widest text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-live-dot" />
        Coming soon
      </span>
    </div>
  );
}
