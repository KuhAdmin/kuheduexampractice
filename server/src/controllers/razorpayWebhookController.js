import { verifyWebhookSignature, processWebhookEvent } from "../services/razorpayWebhookService.js";

// req.body here is a raw Buffer (see app.js -- express.raw() is mounted on
// this route ahead of the global express.json()), not a parsed object.
export const handleRazorpayWebhook = async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody) || !verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ message: "Invalid webhook signature." });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ message: "Invalid JSON payload." });
  }

  try {
    await processWebhookEvent(payload);
    return res.status(200).json({ ok: true });
  } catch (error) {
    // Non-2xx so Razorpay retries -- this means the signature was valid but
    // something (e.g. a transient DB error) kept us from applying the event.
    console.error("Razorpay webhook processing failed", error);
    return res.status(500).json({ message: "Webhook processing failed." });
  }
};
