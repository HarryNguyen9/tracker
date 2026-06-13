import type { getSql, WorldCupMatchRow } from "./db";
import type { NormalizedWorldCupMatch } from "./football-data";

type Sql = ReturnType<typeof getSql>;

export async function loadWorldCupMatchRows(sql: Sql) {
  return (await sql`
    select id, provider, provider_match_id, match_number, stage, group_name, home_team, away_team,
           home_score, away_score, kickoff_at, venue, city, status, winner, last_synced_at, updated_at
    from world_cup_matches
    order by kickoff_at asc nulls last, match_number asc nulls last
  `) as WorldCupMatchRow[];
}

export async function upsertWorldCupMatches(sql: Sql, matches: NormalizedWorldCupMatch[]) {
  for (const match of matches) {
    await sql`
      insert into world_cup_matches (
        provider, provider_match_id, match_number, stage, group_name, home_team, away_team,
        home_score, away_score, kickoff_at, venue, city, status, winner, raw_data, last_synced_at, updated_at
      )
      values (
        ${match.provider}, ${match.providerMatchId}, ${match.matchNumber}, ${match.stage}, ${match.groupName},
        ${match.homeTeam}, ${match.awayTeam}, ${match.homeScore}, ${match.awayScore}, ${match.kickoffAt},
        ${match.venue}, ${match.city}, ${match.status}, ${match.winner}, ${match.rawData}::jsonb, now(), now()
      )
      on conflict (provider, provider_match_id)
      do update set
        match_number = excluded.match_number,
        stage = excluded.stage,
        group_name = excluded.group_name,
        home_team = excluded.home_team,
        away_team = excluded.away_team,
        home_score = excluded.home_score,
        away_score = excluded.away_score,
        kickoff_at = excluded.kickoff_at,
        venue = excluded.venue,
        city = excluded.city,
        status = excluded.status,
        winner = excluded.winner,
        raw_data = excluded.raw_data,
        last_synced_at = now(),
        updated_at = now()
    `;
  }
}
