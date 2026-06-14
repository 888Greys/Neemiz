// MegaPay confirmations are sent to whatever we pass as `callback` in the STK
// request (env MEGAPAY_CALLBACK_URL, currently this path). The previous handler
// here read initiate-response field names (transaction_request_id /
// TransactionStatus) that never appear in the actual callback, so real
// confirmations were silently ignored and deposits only settled via the cron.
//
// Delegate to the canonical handler so this path parses MegaPay's real callback
// payload (ResponseCode / TransactionReference) and credits the wallet. Both
// URLs now share one correct implementation.
export { POST } from "@/app/api/wallet/deposit/megapay/callback/route";
