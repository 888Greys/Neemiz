import { describe, it, expect } from "vitest";
import { classifyAdminChange, type AdminAuditRow } from "@/lib/admin/admin-change-alerts";

const base: AdminAuditRow = {
  id: "aud_1", email: null, username: null, old_admin: "false", new_admin: "true",
  app: "postgrest", ip: "::1", created_at: new Date("2026-07-06T14:31:56Z"),
};

describe("classifyAdminChange", () => {
  it("flags a grant to a NON-allowlisted email as critical (josemuthama-class)", () => {
    const c = classifyAdminChange({ ...base, email: "josemuthama200@gmail.com" });
    expect(c.allowlisted).toBe(false);
    expect(c.critical).toBe(true);
    expect(c.from).toBe("false");
    expect(c.to).toBe("true");
  });

  it("does NOT flag a grant to an allowlisted owner", () => {
    const c = classifyAdminChange({ ...base, email: "goodhope229@gmail.com" });
    expect(c.allowlisted).toBe(true);
    expect(c.critical).toBe(false);
  });

  it("never marks a revoke (to=false) as critical", () => {
    const c = classifyAdminChange({ ...base, email: "josemuthama200@gmail.com", old_admin: "true", new_admin: "false" });
    expect(c.critical).toBe(false);
    expect(c.to).toBe("false");
  });

  it("formats the timestamp and source", () => {
    const c = classifyAdminChange({ ...base, email: "x@y.com" });
    expect(c.at).toBe("2026-07-06 14:31:56");
    expect(c.app).toBe("postgrest");
    expect(c.ip).toBe("::1");
  });
});
