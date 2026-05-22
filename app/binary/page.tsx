import { AppShell } from "@/components/app-shell";
import { BinaryClient } from "@/components/binary/binary-client";

export default function BinaryPage() {
  return (
    <AppShell mainBg="bg-[#050506]">
      <BinaryClient />
    </AppShell>
  );
}
