import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[YOCO-DEPOSIT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse request body
    const { amountCents } = await req.json();
    if (!amountCents || amountCents < 100) {
      throw new Error("Minimum deposit is R1.00 (100 cents)");
    }
    if (amountCents > 1000000) {
      throw new Error("Maximum deposit is R10,000.00 (1000000 cents)");
    }
    logStep("Deposit amount validated", { amountCents });

    // Create Yoco checkout session
    const yocoResponse = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("YOCO_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: "ZAR",
        cancelUrl: `${req.headers.get("origin")}/transactions?deposit=cancelled`,
        successUrl: `${req.headers.get("origin")}/transactions?deposit=success`,
        metadata: {
          supabase_user_id: user.id,
          transaction_type: "deposit",
          amount_cents: amountCents.toString(),
        },
      }),
    });

    if (!yocoResponse.ok) {
      const errorData = await yocoResponse.text();
      logStep("Yoco API error", { status: yocoResponse.status, error: errorData });
      throw new Error(`Yoco API error: ${errorData}`);
    }

    const yocoData = await yocoResponse.json();
    logStep("Yoco checkout created", { checkoutId: yocoData.id, redirectUrl: yocoData.redirectUrl });

    return new Response(JSON.stringify({ url: yocoData.redirectUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
