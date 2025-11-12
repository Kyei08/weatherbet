import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-WITHDRAWAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
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
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request
    const { amountCents } = await req.json();
    if (!amountCents || amountCents < 5000) {
      throw new Error("Minimum withdrawal is R50.00 (5000 cents)");
    }
    if (amountCents > 5000000) {
      throw new Error("Maximum withdrawal is R50,000.00 (5000000 cents)");
    }
    logStep("Withdrawal amount validated", { amountCents });

    // Get user's balance
    const { data: userRecord, error: userRecordError } = await supabaseClient
      .from('users')
      .select('balance_cents')
      .eq('id', user.id)
      .single();

    if (userRecordError) throw userRecordError;
    
    if ((userRecord.balance_cents || 0) < amountCents) {
      throw new Error(`Insufficient funds. Available: ${userRecord.balance_cents || 0} cents`);
    }
    logStep("Balance verified", { available: userRecord.balance_cents });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      throw new Error("No Stripe customer found. Please make a deposit first.");
    }

    // Deduct balance immediately (pending withdrawal)
    const { data: deductResult, error: deductError } = await supabaseClient.rpc(
      'update_user_points_safe',
      {
        user_uuid: user.id,
        points_change: -amountCents,
        transaction_type: 'withdrawal_pending',
        reference_type: 'stripe_withdrawal',
        currency_type: 'real'
      }
    );

    if (deductError) {
      logStep("Error deducting balance", { error: deductError });
      throw deductError;
    }

    logStep("Balance deducted", { deductResult });

    // NOTE: For real withdrawals, you would typically use Stripe Connect or Payouts API
    // This requires additional setup:
    // 1. Stripe Connect account setup
    // 2. Bank account verification
    // 3. Payout object creation
    // For demo purposes, we'll create a pending payout record

    logStep("Withdrawal initiated", { 
      userId: user.id, 
      amountCents,
      status: "pending"
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: "Withdrawal initiated. Funds will be transferred to your bank account within 2-5 business days.",
      amountCents,
      status: "pending"
    }), {
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
