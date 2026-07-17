import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("new admin console entry point", () => {
  it("adds a professional banner in the admin shell that opens the internal preview route", () => {
    const shell = readFileSync("components/admin-shell.tsx", "utf8");

    expect(shell).toContain("/admin/new");
    expect(shell).toContain("New admin console");
    expect(shell).toContain("Open new console");
  });

  it("provides an authenticated internal preview route with the lean five-page console", () => {
    const route = "app/admin/(panel)/new/page.tsx";
    const layout = "app/admin/(panel)/new/layout.tsx";
    const shell = "components/admin-v2/shell.tsx";
    const ops = "components/admin-v2/ops.tsx";
    const opsApi = "app/api/admin/ops/route.ts";

    expect(existsSync(route)).toBe(true);
    expect(existsSync(layout)).toBe(true);
    expect(existsSync(shell)).toBe(true);
    expect(existsSync(ops)).toBe(true);

    expect(readFileSync(route, "utf8")).toContain("money-cockpit");
    expect(readFileSync(layout, "utf8")).toContain("AdminV2Shell");
    expect(readFileSync(shell, "utf8")).toContain("/admin/new/money-cockpit");
    expect(readFileSync(shell, "utf8")).toContain("/admin/new/ops");
    expect(readFileSync(ops, "utf8")).toContain("Action Queue");
    expect(readFileSync(opsApi, "utf8")).toContain("Sports settlements");
  });
});
