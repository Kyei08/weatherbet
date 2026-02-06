import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  url?: string;
  reference_id?: string;
  reference_type?: string;
}

// Convert VAPID key to Uint8Array for web push
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Create JWT for VAPID authentication
async function createVapidJwt(audience: string, subject: string, privateKey: string): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const privateKeyData = base64UrlToUint8Array(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsignedToken}.${signatureB64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_id, title, body, url, reference_id, reference_type }: PushPayload = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabaseClient
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found for user:", user_id);
      // Still create in-app notification
      await supabaseClient.from("notifications").insert({
        user_id,
        title,
        message: body,
        type: "auto_cashout",
        reference_id,
        reference_type,
      });

      return new Response(
        JSON.stringify({ success: true, push_sent: 0, notification_created: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

    const pushPayload = JSON.stringify({
      title,
      body,
      url: url || "/cashout",
      referenceId: reference_id,
      referenceType: reference_type,
    });

    let successCount = 0;
    const failedEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const endpointUrl = new URL(sub.endpoint);
        const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

        // For web push, we need to send to the push service
        // This is a simplified implementation - for production, use a proper web-push library
        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
            Authorization: `vapid t=${await createVapidJwt(audience, "mailto:support@weatherbet.app", vapidPrivateKey)}, k=${vapidPublicKey}`,
          },
          body: pushPayload,
        });

        if (response.ok || response.status === 201) {
          successCount++;
        } else if (response.status === 404 || response.status === 410) {
          // Subscription expired, remove it
          failedEndpoints.push(sub.endpoint);
          await supabaseClient
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        } else {
          console.error(`Push failed for endpoint: ${response.status} ${response.statusText}`);
        }
      } catch (pushError) {
        console.error("Error sending push to endpoint:", pushError);
      }
    }

    // Always create in-app notification
    await supabaseClient.from("notifications").insert({
      user_id,
      title,
      message: body,
      type: "auto_cashout",
      reference_id,
      reference_type,
    });

    return new Response(
      JSON.stringify({
        success: true,
        push_sent: successCount,
        push_failed: failedEndpoints.length,
        notification_created: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
