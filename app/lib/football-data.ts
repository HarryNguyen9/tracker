import type { WorldCupMatchStatus } from "./types";

const footballDataBaseUrl = "https://api.football-data.org/v4";

type FootballDataTeam = {
  name?: string | null;
  shortName?: string | null;
  tla?: string | null;
};

type FootballDataMatch = {
  id: number;
  utcDate?: string | null;
  status?: string | null;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  homeTeam?: FootballDataTeam | null;
  awayTeam?: FootballDataTeam | null;
  score?: {
    winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime?: {
      home?: number | null;
      away?: number | null;
    } | null;
  } | null;
};

type FootballDataMatchesResponse = {
  matches?: FootballDataMatch[];
};

export type NormalizedWorldCupMatch = {
  provider: "football-data";
  providerMatchId: string;
  matchNumber: number | null;
  stage: string | null;
  groupName: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: string | null;
  venue: string | null;
  city: string | null;
  status: WorldCupMatchStatus;
  winner: string | null;
  rawData: string;
};

function teamName(team: FootballDataTeam | null | undefined) {
  return team?.name ?? team?.shortName ?? team?.tla ?? null;
}

function normalizeStatus(status: string | null | undefined): WorldCupMatchStatus {
  if (status === "IN_PLAY" || status === "PAUSED") {
    return "live";
  }
  if (status === "FINISHED") {
    return "finished";
  }
  if (status === "POSTPONED" || status === "SUSPENDED") {
    return "postponed";
  }
  if (status === "CANCELED") {
    return "cancelled";
  }
  return "scheduled";
}

function normalizeWinner(match: FootballDataMatch) {
  const winner = match.score?.winner;
  if (winner === "HOME_TEAM") {
    return teamName(match.homeTeam);
  }
  if (winner === "AWAY_TEAM") {
    return teamName(match.awayTeam);
  }
  if (winner === "DRAW") {
    return "Draw";
  }
  return null;
}

export function normalizeFootballDataMatch(match: FootballDataMatch): NormalizedWorldCupMatch {
  return {
    provider: "football-data",
    providerMatchId: String(match.id),
    matchNumber: match.matchday ?? null,
    stage: match.stage ?? null,
    groupName: match.group ?? null,
    homeTeam: teamName(match.homeTeam),
    awayTeam: teamName(match.awayTeam),
    homeScore: match.score?.fullTime?.home ?? null,
    awayScore: match.score?.fullTime?.away ?? null,
    kickoffAt: match.utcDate ?? null,
    venue: null,
    city: null,
    status: normalizeStatus(match.status),
    winner: normalizeWinner(match),
    rawData: JSON.stringify(match),
  };
}

export async function fetchWorldCupMatches() {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    throw new Error("FOOTBALL_DATA_API_KEY is not configured.");
  }

  const url = new URL(`${footballDataBaseUrl}/competitions/WC/matches`);
  url.searchParams.set("season", "2026");

  const response = await fetch(url, {
    headers: { "X-Auth-Token": token },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("World Cup provider rate limit reached. Try again later.");
    }
    if (response.status === 403 || response.status === 401) {
      throw new Error("World Cup provider rejected the API key.");
    }
    throw new Error(`World Cup provider request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as FootballDataMatchesResponse;
  return (data.matches ?? []).map(normalizeFootballDataMatch);
}
