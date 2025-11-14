import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createHmac } from "https://deno.land/std@0.190.0/node/crypto.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[YOCO-WEBHOOK] ${step}${detailsStr}`);
};

const verifyYocoSignature = (payload: string, signature: string, secret: string): boolean => {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest("hex");
  return signature === expectedSignature;
};

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Webhook received");

    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("X-Yoco-Signature");
    
    if (!signature) {
      logStep("No signature provided");
      return new Response("No signature", { status: 400 });
    }

    // Verify webhook signature
    const webhookSecret = Deno.env.get("YOCO_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("Webhook secret not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    if (!verifyYocoSignature(rawBody, signature, webhookSecret)) {
      logStep("Invalid signature");
      return new Response("Invalid signature", { status: 403 });
    }

    const event = JSON.parse(rawBody);
    logStep("Event verified", { type: event.type, id: event.id });

    // Handle payment.succeeded event
    if (event.type === "payment.succeeded") {
      const payment = event.payload;
      const metadata = payment.metadata || {};
      const userId = metadata.supabase_user_id;
      const amountCents = payment.amount;

      if (!userId) {
        logStep("No user ID in metadata");
        return new Response("No user ID", { status: 400 });
      }

      logStep("Processing payment", { userId, amountCents });

      // Update user balance
      const { data, error } = await supabaseClient.rpc("update_user_points_safe", {
        user_uuid: userId,
        points_change: amountCents,
        transaction_type: "deposit",
        reference_id: payment.id,
        reference_type: "yoco_payment",
        currency_type: "real",
      });

      if (error) {
        logStep("Balance update failed", { error: error.message });
        throw error;
      }

      logStep("Balance updated successfully", { result: data });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
