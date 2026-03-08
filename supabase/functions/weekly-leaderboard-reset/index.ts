import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all active leaderboard groups
    const { data: groups, error: groupsError } = await supabase
      .from("leaderboard_groups")
      .select("id, name");

    if (groupsError) throw groupsError;

    const results: any[] = [];

    for (const group of groups || []) {
      // Get current season number for this group
      const { data: currentSeason } = await supabase
        .from("leaderboard_seasons")
        .select("id, season_number")
        .eq("group_id", group.id)
        .eq("is_active", true)
        .single();

      const nextSeasonNumber = currentSeason
        ? currentSeason.season_number + 1
        : 1;

      // Close current season if exists
      if (currentSeason) {
        await supabase
          .from("leaderboard_seasons")
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq("id", currentSeason.id);
      }

      // Get top 3 players in this group by points
      const { data: groupUsers } = await supabase
        .from("user_leaderboard_assignments")
        .select("user_id")
        .eq("group_id", group.id);

      if (!groupUsers || groupUsers.length === 0) continue;

      const userIds = groupUsers.map((u) => u.user_id);

      const { data: topPlayers } = await supabase
        .from("users")
        .select("id, username, points")
        .in("id", userIds)
        .order("points", { ascending: false })
        .limit(3);

      // Create new season
      const { data: newSeason, error: seasonError } = await supabase
        .from("leaderboard_seasons")
        .insert({
          season_number: nextSeasonNumber,
          group_id: group.id,
          is_active: true,
        })
        .select("id")
        .single();

      if (seasonError) throw seasonError;

      // Record top 3 results for the CLOSING season
      if (currentSeason && topPlayers) {
        for (let i = 0; i < topPlayers.length; i++) {
          const player = topPlayers[i];

          // Get bet stats
          const { count: totalBets } = await supabase
            .from("bets")
            .select("*", { count: "exact", head: true })
            .eq("user_id", player.id)
            .eq("currency_type", "virtual");

          const { count: totalWins } = await supabase
            .from("bets")
            .select("*", { count: "exact", head: true })
            .eq("user_id", player.id)
            .eq("result", "win")
            .eq("currency_type", "virtual");

          await supabase.from("season_results").insert({
            season_id: currentSeason.id,
            user_id: player.id,
            username: player.username,
            final_rank: i + 1,
            final_points: player.points,
            total_bets: totalBets || 0,
            total_wins: totalWins || 0,
          });
        }
      }

      // Reset weekly_points for all users in this group
      for (const userId of userIds) {
        await supabase
          .from("users")
          .update({ weekly_points: 0 })
          .eq("id", userId);
      }

      results.push({
        group: group.name,
        season: nextSeasonNumber,
        topPlayers: topPlayers?.map((p) => p.username) || [],
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Weekly reset error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
