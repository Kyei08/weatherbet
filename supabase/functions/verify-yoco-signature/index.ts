import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-YOCO-SIGNATURE] ${step}${detailsStr}`);
};

const computeSignature = async (payload: string, secret: string): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Request received");

    const { payload, signature, generateSignature } = await req.json();

    if (!payload) {
      return new Response(
        JSON.stringify({ error: "Payload is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get webhook secret
    const webhookSecret = Deno.env.get("YOCO_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("Webhook secret not configured");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If generateSignature is true, generate and return a test signature
    if (generateSignature) {
      logStep("Generating test signature");
      const testSignature = await computeSignature(payload, webhookSecret);
      
      return new Response(
        JSON.stringify({
          signature: testSignature,
          message: "Test signature generated successfully",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Otherwise, verify the provided signature
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Signature is required for verification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Verifying signature");
    const expectedSignature = await computeSignature(payload, webhookSecret);
    const valid = signature === expectedSignature;

    logStep("Verification result", { valid });

    return new Response(
      JSON.stringify({
        valid,
        message: valid 
          ? "Signature is valid and matches the expected HMAC SHA-256 hash"
          : "Signature is invalid - does not match expected HMAC SHA-256 hash",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
