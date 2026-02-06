import { supabase } from "@/integrations/supabase/client";

interface SendNotificationParams {
  userId: string;
  title: string;
  body: string;
  url?: string;
  referenceId?: string;
  referenceType?: string;
}

/**
 * Send a push notification to a user via the edge function.
 * Also creates an in-app notification as fallback.
 */
export async function sendPushNotification({
  userId,
  title,
  body,
  url,
  referenceId,
  referenceType,
}: SendNotificationParams): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        user_id: userId,
        title,
        body,
        url,
        reference_id: referenceId,
        reference_type: referenceType,
      },
    });

    if (error) {
      console.error("Error sending push notification:", error);
      return false;
    }

    console.log("Push notification result:", data);
    return data?.success ?? false;
  } catch (error) {
    console.error("Failed to send push notification:", error);
    return false;
  }
}

/**
 * Send an auto-cashout triggered notification
 */
export async function sendAutoCashoutNotification({
  userId,
  betId,
  betType,
  ruleType,
  thresholdValue,
  cashoutAmount,
}: {
  userId: string;
  betId: string;
  betType: string;
  ruleType: string;
  thresholdValue: number;
  cashoutAmount: number;
}): Promise<boolean> {
  const ruleDescriptions: Record<string, string> = {
    percentage_above: `profit reached ${thresholdValue}%`,
    percentage_below: `profit dropped to ${thresholdValue}%`,
    weather_bonus_above: `weather bonus hit ${thresholdValue}%`,
    weather_bonus_below: `weather bonus fell to ${thresholdValue}%`,
    time_bonus_above: `time bonus reached ${thresholdValue}%`,
    amount_above: `value reached ${cashoutAmount}`,
  };

  const ruleDesc = ruleDescriptions[ruleType] || `threshold of ${thresholdValue}`;

  return sendPushNotification({
    userId,
    title: "🤖 Auto Cash-Out Triggered!",
    body: `Your ${betType} was automatically cashed out for ${cashoutAmount} points because ${ruleDesc}.`,
    url: "/cashout",
    referenceId: betId,
    referenceType: `auto_cashout_${betType}`,
  });
}
