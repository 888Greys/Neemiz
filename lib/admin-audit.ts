import { db } from "@/lib/db";

export async function logAdminAction(args: {
  adminId: string;
  action: string;
  targetId?: string;
  metadata?: any;
  ipAddress?: string | null;
}) {
  try {
    await db.adminAuditLog.create({
      data: {
        adminId: args.adminId,
        action: args.action,
        targetId: args.targetId,
        metadata: args.metadata || {},
        ipAddress: args.ipAddress,
      },
    });
  } catch (e) {
    console.error("[logAdminAction] failed to log admin action", e);
  }
}
