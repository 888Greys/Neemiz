-- Flag order-event messages (payment marked, released, cancelled, disputed, …)
-- so the chat can render them as centred "System message" blocks instead of
-- normal chat bubbles. Existing rows default to false (regular messages).
ALTER TABLE "p2p_messages" ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;
