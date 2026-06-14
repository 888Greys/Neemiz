CREATE TABLE IF NOT EXISTS "security_user_audit" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "action" TEXT NOT NULL,
    "changed_fields" TEXT[] NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB NOT NULL,
    "db_user" TEXT NOT NULL DEFAULT current_user,
    "application_name" TEXT DEFAULT current_setting('application_name', true),
    "client_addr" INET DEFAULT inet_client_addr(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "security_user_audit_user_id_created_at_idx"
    ON "security_user_audit" ("user_id", "created_at" DESC);

CREATE OR REPLACE FUNCTION audit_sensitive_user_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_admin = FALSE AND NEW.is_active = TRUE AND NEW.wallet_balance = 0 THEN
            RETURN NEW;
        END IF;
        fields := ARRAY['record_created'];
    ELSE
        IF OLD.is_admin IS DISTINCT FROM NEW.is_admin THEN
            fields := array_append(fields, 'is_admin');
        END IF;
        IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            fields := array_append(fields, 'is_active');
        END IF;
        IF OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance THEN
            fields := array_append(fields, 'wallet_balance');
        END IF;
        IF OLD.totp_enabled IS DISTINCT FROM NEW.totp_enabled THEN
            fields := array_append(fields, 'totp_enabled');
        END IF;
        IF cardinality(fields) = 0 THEN
            RETURN NEW;
        END IF;
    END IF;

    INSERT INTO "security_user_audit" (
        "user_id",
        "username",
        "email",
        "action",
        "changed_fields",
        "old_values",
        "new_values"
    ) VALUES (
        NEW.id,
        NEW.username,
        NEW.email,
        lower(TG_OP),
        fields,
        CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
            'is_admin', OLD.is_admin,
            'is_active', OLD.is_active,
            'wallet_balance', OLD.wallet_balance,
            'totp_enabled', OLD.totp_enabled
        ) END,
        jsonb_build_object(
            'is_admin', NEW.is_admin,
            'is_active', NEW.is_active,
            'wallet_balance', NEW.wallet_balance,
            'totp_enabled', NEW.totp_enabled
        )
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "users_sensitive_audit_trigger" ON "users";
CREATE TRIGGER "users_sensitive_audit_trigger"
AFTER INSERT OR UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION audit_sensitive_user_changes();

REVOKE ALL ON TABLE "security_user_audit" FROM PUBLIC;
