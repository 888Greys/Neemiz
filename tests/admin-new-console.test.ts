import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("new admin console entry point", () => {
  it("adds a professional banner in the admin shell that opens the internal preview route", () => {
    const shell = readFileSync("components/admin-shell.tsx", "utf8");

    expect(shell).toContain("/admin/new");
    expect(shell).toContain("New admin console");
    expect(shell).toContain("Open new console");
  });

  it("provides an authenticated internal preview route backed by the Stitch screens", () => {
    const route = "app/admin/(panel)/new/page.tsx";
    const layout = "app/admin/(panel)/new/layout.tsx";
    const shell = "components/admin-v2/shell.tsx";
    const withdrawals = "components/admin-v2/withdrawals.tsx";

    expect(existsSync(route)).toBe(true);
    expect(existsSync(layout)).toBe(true);
    expect(existsSync(shell)).toBe(true);
    expect(existsSync(withdrawals)).toBe(true);

    expect(readFileSync(route, "utf8")).toContain("AdminV2Cockpit");
    expect(readFileSync(layout, "utf8")).toContain("AdminV2Shell");
    expect(readFileSync(shell, "utf8")).toContain("Owner Cockpit");
    expect(readFileSync(withdrawals, "utf8")).toContain("Withdrawals");
  });
});
