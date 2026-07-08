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

    expect(existsSync(route)).toBe(true);

    const source = readFileSync(route, "utf8");
    expect(source).toContain("AdminShell");
    expect(source).toContain("10900649296411941705");
    expect(source).toContain("Owner Cockpit");
    expect(source).toContain("Withdrawals & Approvals");
  });
});
