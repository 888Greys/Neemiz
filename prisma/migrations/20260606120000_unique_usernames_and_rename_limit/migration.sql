ALTER TABLE "users" ADD COLUMN "username_changed_at" TIMESTAMP(3);

UPDATE "users"
SET "username" = LOWER("username")
WHERE "username" IS NOT NULL;

WITH duplicate_usernames AS (
  SELECT
    "id",
    "username",
    ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "created_at", "id") AS duplicate_number
  FROM "users"
  WHERE "username" IS NOT NULL
)
UPDATE "users" AS u
SET "username" = LEFT(d."username", 14) || RIGHT(REPLACE(u."id", '-', ''), 6)
FROM duplicate_usernames AS d
WHERE u."id" = d."id" AND d.duplicate_number > 1;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
