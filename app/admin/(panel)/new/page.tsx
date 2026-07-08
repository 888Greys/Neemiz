import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/icon";

const STITCH_PROJECT_ID = "10900649296411941705";
const STITCH_PROJECT_URL = `https://stitch.withgoogle.com/projects/${STITCH_PROJECT_ID}`;

const screens = [
  {
    title: "Owner Cockpit",
    detail: "Platform health, money movement, market performance, alerts, and owner queue.",
    status: "Ready",
    href: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1NjE2Yzc4NTMzYjkwOTY4YjY3ZDlhMmE4NjMyEgsSBxC32JvWkggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDkwMDY0OTI5NjQxMTk0MTcwNQ&filename=&opi=89354086",
    image: "https://lh3.googleusercontent.com/aida/AP1WRLuHvWG4I-odTFAo2hYssCbUMUbEbWYy9iFWazR52zW6UHOzoDTLU74oS9Ww6cJcG8uivM4kN0oRn69Df7gaAzGTO-SlzBfporqR9IXkKI8-YBMWrFgt6WDWgHCbIhhdg1JFfvAvKhVTfIbdqmbfFiRta1_IAKZkp2DWuVwHTwgvjZnrNJc8e-V7B6qlSRb819wRKwHEDGB123ESKwHeVtC3WemvPucfFyeJf0eENO1s8ikxIQdOy4EKNk9f",
  },
  {
    title: "Players Overview",
    detail: "Growth, acquisition health, player base metrics, and player performance summaries.",
    status: "Ready",
    href: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1NjE3N2M5ODE5ZTkwNGU3NGFhZWQ5MmJiNWM4EgsSBxC32JvWkggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDkwMDY0OTI5NjQxMTk0MTcwNQ&filename=&opi=89354086",
    image: "https://lh3.googleusercontent.com/aida/AP1WRLvs7pVMk41fszrbSbd9voiymMiohcVz66PYWQtS7a-rPk1C-RJ_PmeqFa2FI_1GWtydx7m1TckrCFxWXOW72x4XczoRdy-fJmG2Z4Rns7lz_3C1OMEF45RuXWfT-ZaZLoZcTv1sBpEdQr4fIzuu2_nx4jVOJJeTVJaL7MUWSGFl877pdBjQnNQliM8hAOJw_w4JnDuMScqHoVGdZabglIrcuXYbkiNtWpuW_tv0nswNwdKsfFqBeBNsTCnc",
  },
  {
    title: "Players Directory",
    detail: "Search, sort, inspect, and act on user accounts from one dense operations view.",
    status: "Ready",
    href: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1NjE3ODYyMmU1ZWUwM2IxYmQ5NTVjMGRmMmZkEgsSBxC32JvWkggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDkwMDY0OTI5NjQxMTk0MTcwNQ&filename=&opi=89354086",
    image: "https://lh3.googleusercontent.com/aida/AP1WRLuP12kGFKiGZoxdLPnMRucRfYoMOlQOlax0DlnyCFi4VXl5dr0B7r8U_JAjC2aJ4wPjejH7-LSVs3Vzcfxzreh5VZQVhnSWzuK_Ug-8XVLqKiLQ8qXmgI0_djMXKREsSmcMeC-PZjexXxVDZ1TlBpXHErx5VA7j6koTfnX_4buU9Cra8kR6Nss_vPC5Ge51aVkaH5jKSRhm8eorP7TJu-zo8x2y0BI2noOCXFXJ2SB92tlLLN9UZysdoi8",
  },
  {
    title: "P2P Ops",
    detail: "KYC, disputes, deposits, crypto addresses, and merchant operations triage.",
    status: "Ready",
    href: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1NjE3OGNiYjk1M2YwMjNiZThlZTExMWM3NmQzEgsSBxC32JvWkggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDkwMDY0OTI5NjQxMTk0MTcwNQ&filename=&opi=89354086",
    image: "https://lh3.googleusercontent.com/aida/AP1WRLtoZozcb7l8hfS7-VabTKZkkBJg00AosASbuIF05Ry06h4bKC1wl9ny86HRY87XcaZuj86yUyqdgimuK25SV0eB0BcSxZ7E21oTMiOcDL8A1bJXHwkmENKBs23L3UgGsoYtk8JULooU34UH5amjT88-93iQFwpeiHsAOZPgq3H1lO6CZWu6oEEu23UcFfl4sHfHeHzoT063nZbUP5I9RCzUoUYZV2Premx9tSz2UGUcvrVmQ37noxQzbaJX",
  },
  {
    title: "Withdrawals & Approvals",
    detail: "Withdrawal approval queue, risk signals, provider details, and history filters.",
    status: "Ready",
    href: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1NjE3OTk0MWY3OGUwNDRmNWRlYjg5MWU4ZGMzEgsSBxC32JvWkggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDkwMDY0OTI5NjQxMTk0MTcwNQ&filename=&opi=89354086",
    image: "https://lh3.googleusercontent.com/aida/AP1WRLvFvtK4FfdCQgue5R2Y6qt0EslgjBMztQpi-5lkw9SvPrcDecvCFlEgNBxVcnxH9gFHN0St85tkY3UwYTGrxyNAFruGRVTcnok_7D20WAckUN9HWLspxwm7dxTQDOTJDRY3AXHeQclDNQXJ6jyBnmWFJEaI52qIf-rDbYryMZAuoQSm8fu6dTzW2QaOfHZrGi32rFeIbGTgwIbzF9OaopvjsfjGLVPj95dpFdFzEmnPOtvjwa2WKcPKDhhi",
  },
];

export const metadata = { title: "New admin console · Nezeem Admin" };

export default async function NewAdminConsolePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AdminShell adminEmail={user?.email ?? ""}>
      <div className="admin-page">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-300/20 bg-blue-400/10 text-blue-300">
                <Icon name="auto_awesome" size={15} />
              </span>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Preview workspace</p>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white">New admin console</h1>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">
              Review the redesigned Nezeem operations screens before the production console is replaced.
              These previews are generated from Stitch and mapped to the real admin modules.
            </p>
          </div>
          <a
            href={STITCH_PROJECT_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-black text-slate-300 transition hover:border-blue-400/30 hover:text-white"
          >
            Open Stitch project <Icon name="open_in_new" size={13} />
          </a>
        </header>

        <section className="admin-panel mb-5 border-blue-400/15 bg-blue-500/[0.035] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-black text-white">Rollout status</p>
              <p className="mt-1 text-[10px] font-semibold text-slate-500">
                Design preview only. Production data and admin actions still live in the current console.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-amber-400/20 bg-amber-400/[0.08] px-2 py-1 text-[10px] font-black text-amber-300">
              <Icon name="construction" size={12} /> Not live yet
            </span>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          {screens.map((screen) => (
            <article key={screen.title} className="admin-panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div>
                  <h2 className="text-[13px] font-black text-white">{screen.title}</h2>
                  <p className="mt-0.5 text-[10px] text-slate-600">{screen.detail}</p>
                </div>
                <span className="rounded-md border border-emerald-400/20 bg-emerald-400/[0.07] px-2 py-1 text-[9px] font-black text-emerald-300">
                  {screen.status}
                </span>
              </div>
              <a href={screen.href} target="_blank" rel="noreferrer" className="group block">
                <div className="aspect-[16/10] overflow-hidden bg-[#08090b]">
                  <img
                    src={screen.image}
                    alt={`${screen.title} preview`}
                    className="h-full w-full object-cover object-top opacity-90 transition duration-200 group-hover:scale-[1.015] group-hover:opacity-100"
                  />
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-[10px] font-black text-blue-300">
                  <span>Open generated HTML</span>
                  <Icon name="arrow_forward" size={13} />
                </div>
              </a>
            </article>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
