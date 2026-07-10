-- Speed up per-device account counting (device signup cap).
CREATE INDEX IF NOT EXISTS "login_devices_device_hash_idx" ON "login_devices"("device_hash");
