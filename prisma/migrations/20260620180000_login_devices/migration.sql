-- Remember browser devices so security alerts are sent only for a new device.
CREATE TABLE "login_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "last_location" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "login_devices_user_id_device_hash_key" ON "login_devices"("user_id", "device_hash");

ALTER TABLE "login_devices" ADD CONSTRAINT "login_devices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
