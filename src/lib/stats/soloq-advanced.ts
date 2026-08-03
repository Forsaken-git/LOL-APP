import type {
  SoloQAdvancedMetrics,
  SoloQChampStat,
  SoloQPatchStat,
  SoloQVolumeWindow,
} from "@/lib/stats/soloq-advanced-types";
import type { PlayerRegion } from "@/lib/player-accounts-shared";
import { championDisplayName } from "@/lib/champions";

type MatchRow = {
  accountId: string;
  playedAt: Date;
  gameVersion: string;
  champion: string;
  win: boolean;
  cs: number;
  gold: number;
  damage: number;
  durationSec: number;
  teamDamage: number | null;
  role: string | null;
  visionScore: number | null;
  controlWardsBought: number | null;
};

type SnapshotRow = {
  accountId: string;
  capturedAt: Date;
  tier: string;
  rank: string;
  lp: number;
};

type AccountRow = {
  id: string;
  region: PlayerRegion;
  summonerName: string;
};

const SPAM_WINDOW = 10;
const FATIGUE_RECENT = 5;
const FATIGUE_MIN_BASELINE = 5;

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function winRate(wins: number, games: number): number {
  if (games <= 0) return 0;
  return Math.round((wins / games) * 100);
}

function patchLabel(gameVersion: string): string {
  const parts = gameVersion.split(".");
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
  return gameVersion;
}

const TIER_LP: Record<string, number> = {
  IRON: 0,
  BRONZE: 400,
  SILVER: 800,
  GOLD: 1200,
  PLATINUM: 1600,
  EMERALD: 2000,
  DIAMOND: 2400,
  MASTER: 2800,
  GRANDMASTER: 2800,
  CHALLENGER: 2800,
};

const DIV_LP: Record<string, number> = {
  IV: 0,
  III: 100,
  II: 200,
  I: 300,
};

function approxLp(tier: string, rank: string, lp: number): number {
  const t = TIER_LP[tier.toUpperCase()] ?? 0;
  const high =
    ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier.toUpperCase());
  if (high) return t + lp;
  return t + (DIV_LP[rank.toUpperCase()] ?? 0) + lp;
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return round(Math.sqrt(variance), 3);
}

function volumeWindows(matches: MatchRow[]): SoloQVolumeWindow[] {
  const now = Date.now();
  return [7, 30].map((days) => {
    const cutoff = now - days * 86_400_000;
    const slice = matches.filter((m) => m.playedAt.getTime() >= cutoff);
    const wins = slice.filter((m) => m.win).length;
    return {
      days,
      games: slice.length,
      wins,
      losses: slice.length - wins,
      winRate: winRate(wins, slice.length),
    };
  });
}

function isSupportMatchRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.toUpperCase();
  return r === "UTILITY" || r === "SUPPORT";
}

function championStats(matches: MatchRow[]): SoloQChampStat[] {
  const map = new Map<
    string,
    {
      games: number;
      wins: number;
      csPerMin: number;
      visionScore: number;
      visionPerMin: number;
      controlWards: number;
      visionGames: number;
      dmgPerGold: number;
      supportGames: number;
    }
  >();

  for (const m of matches) {
    const name = championDisplayName(m.champion);
    const mins = Math.max(m.durationSec / 60, 1 / 60);
    const cur = map.get(name) ?? {
      games: 0,
      wins: 0,
      csPerMin: 0,
      visionScore: 0,
      visionPerMin: 0,
      controlWards: 0,
      visionGames: 0,
      dmgPerGold: 0,
      supportGames: 0,
    };
    cur.games += 1;
    if (m.win) cur.wins += 1;
    cur.csPerMin += m.cs / mins;
    cur.dmgPerGold += m.gold > 0 ? m.damage / m.gold : 0;
    if (m.visionScore != null) {
      cur.visionScore += m.visionScore;
      cur.visionPerMin += m.visionScore / mins;
      cur.controlWards += m.controlWardsBought ?? 0;
      cur.visionGames += 1;
    }
    if (isSupportMatchRole(m.role)) cur.supportGames += 1;
    map.set(name, cur);
  }

  return [...map.entries()]
    .map(([champion, s]) => ({
      champion,
      games: s.games,
      wins: s.wins,
      winRate: winRate(s.wins, s.games),
      avgCsPerMin: round(s.csPerMin / s.games, 1),
      avgVisionScore:
        s.visionGames > 0 ? round(s.visionScore / s.visionGames, 1) : null,
      avgVisionPerMin:
        s.visionGames > 0 ? round(s.visionPerMin / s.visionGames, 1) : null,
      avgControlWardsBought:
        s.visionGames > 0 ? round(s.controlWards / s.visionGames, 1) : null,
      avgDamagePerGold: round(s.dmgPerGold / s.games, 3),
      primarilySupport: s.supportGames / s.games >= 0.5,
    }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate);
}

function patchStats(matches: MatchRow[]): SoloQPatchStat[] {
  const map = new Map<string, { games: number; wins: number }>();
  for (const m of matches) {
    const patch = patchLabel(m.gameVersion);
    const cur = map.get(patch) ?? { games: 0, wins: 0 };
    cur.games += 1;
    if (m.win) cur.wins += 1;
    map.set(patch, cur);
  }
  return [...map.entries()]
    .map(([patch, s]) => ({
      patch,
      games: s.games,
      wins: s.wins,
      winRate: winRate(s.wins, s.games),
    }))
    .sort((a, b) => b.patch.localeCompare(a.patch, undefined, { numeric: true }));
}

function spamMetrics(matches: MatchRow[]) {
  const sorted = [...matches].sort(
    (a, b) => b.playedAt.getTime() - a.playedAt.getTime(),
  );
  const window = Math.min(SPAM_WINDOW, sorted.length);
  const recent = sorted.slice(0, window);
  const counts = new Map<string, number>();
  for (const m of recent) {
    const name = championDisplayName(m.champion);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let topChampion: string | null = null;
  let topCount = 0;
  for (const [champ, count] of counts) {
    if (count > topCount) {
      topCount = count;
      topChampion = champ;
    }
  }

  let longestStreak = 0;
  let longestStreakChampion: string | null = null;
  let streak = 0;
  let prev: string | null = null;
  for (const m of sorted) {
    const name = championDisplayName(m.champion);
    if (name === prev) {
      streak += 1;
    } else {
      prev = name;
      streak = 1;
    }
    if (streak > longestStreak) {
      longestStreak = streak;
      longestStreakChampion = name;
    }
  }

  return {
    topChampion,
    shareLastN: window > 0 && topChampion ? round(topCount / window, 2) : null,
    window,
    longestStreak,
    longestStreakChampion,
  };
}

function fatigueMetrics(matches: MatchRow[]) {
  const sorted = [...matches].sort(
    (a, b) => b.playedAt.getTime() - a.playedAt.getTime(),
  );
  if (sorted.length < FATIGUE_RECENT) return null;

  const recent = sorted.slice(0, FATIGUE_RECENT);
  const champCounts = new Map<string, number>();
  for (const m of recent) {
    const name = championDisplayName(m.champion);
    champCounts.set(name, (champCounts.get(name) ?? 0) + 1);
  }
  let focus: string | null = null;
  let focusCount = 0;
  for (const [champ, count] of champCounts) {
    if (count > focusCount) {
      focus = champ;
      focusCount = count;
    }
  }
  if (!focus || focusCount < 3) return null;

  const recentOnChamp = recent.filter(
    (m) => championDisplayName(m.champion) === focus,
  );
  const recentWins = recentOnChamp.filter((m) => m.win).length;
  const recentWinRate = winRate(recentWins, recentOnChamp.length);

  const baselineGames = sorted.filter(
    (m) => championDisplayName(m.champion) === focus,
  );
  if (baselineGames.length < FATIGUE_MIN_BASELINE) {
    return {
      champion: focus,
      recentGames: recentOnChamp.length,
      recentWinRate,
      baselineWinRate: null,
      flag: false,
    };
  }
  const baselineWins = baselineGames.filter((m) => m.win).length;
  const baselineWinRate = winRate(baselineWins, baselineGames.length);
  const flag =
    recentOnChamp.length >= 3 && recentWinRate <= baselineWinRate - 15;

  return {
    champion: focus,
    recentGames: recentOnChamp.length,
    recentWinRate,
    baselineWinRate,
    flag,
  };
}

function mmrVelocity(snapshots: SnapshotRow[]) {
  const sorted = [...snapshots].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime(),
  );
  if (sorted.length === 0) {
    return {
      sampleCount: 0,
      lpDelta: null,
      lpPerDay: null,
      from: null,
      to: null,
    };
  }
  const from = sorted[0]!;
  const to = sorted[sorted.length - 1]!;
  const fromLp = approxLp(from.tier, from.rank, from.lp);
  const toLp = approxLp(to.tier, to.rank, to.lp);
  const lpDelta = toLp - fromLp;
  const days = Math.max(
    (to.capturedAt.getTime() - from.capturedAt.getTime()) / 86_400_000,
    1 / 24,
  );

  return {
    sampleCount: sorted.length,
    lpDelta,
    lpPerDay: sorted.length >= 2 ? round(lpDelta / days, 1) : null,
    from: {
      tier: from.tier,
      rank: from.rank,
      lp: from.lp,
      at: from.capturedAt.toISOString(),
    },
    to: {
      tier: to.tier,
      rank: to.rank,
      lp: to.lp,
      at: to.capturedAt.toISOString(),
    },
  };
}

/** Pure aggregation over SoloQ Match-V5 cache + rank snapshots (no LCU/team data). */
export function aggregateSoloQAdvanced(input: {
  accounts: AccountRow[];
  matches: MatchRow[];
  snapshots: SnapshotRow[];
  lastSyncedAt: Date | null;
}): SoloQAdvancedMetrics {
  const { accounts, matches, snapshots, lastSyncedAt } = input;

  let csPerMinSum = 0;
  let visionScoreSum = 0;
  let visionPerMinSum = 0;
  let controlWardsSum = 0;
  let visionN = 0;
  let goldPerMinSum = 0;
  let dmgPerMinSum = 0;
  let goldEffSum = 0;
  let damageShareSum = 0;
  let damageShareN = 0;
  let timed = 0;
  let supportGames = 0;

  for (const m of matches) {
    const mins = Math.max(m.durationSec / 60, 1 / 60);
    csPerMinSum += m.cs / mins;
    goldPerMinSum += m.gold / mins;
    dmgPerMinSum += m.damage / mins;
    if (m.visionScore != null) {
      visionScoreSum += m.visionScore;
      visionPerMinSum += m.visionScore / mins;
      controlWardsSum += m.controlWardsBought ?? 0;
      visionN += 1;
    }
    if (isSupportMatchRole(m.role)) supportGames += 1;
    if (m.gold > 0) {
      goldEffSum += m.damage / m.gold;
      timed += 1;
    }
    if (m.teamDamage != null && m.teamDamage > 0) {
      damageShareSum += m.damage / m.teamDamage;
      damageShareN += 1;
    }
  }

  const n = matches.length;
  const sorted = [...matches].sort(
    (a, b) => b.playedAt.getTime() - a.playedAt.getTime(),
  );
  const consistency = stdDev(
    sorted.slice(0, 20).map((m) => (m.win ? 1 : 0)),
  );

  const byAccount = new Map<string, number>();
  for (const m of matches) {
    byAccount.set(m.accountId, (byAccount.get(m.accountId) ?? 0) + 1);
  }

  return {
    source: "soloq_riot",
    matchCount: n,
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    supportFocus: n > 0 && supportGames / n >= 0.4,
    averages: {
      csPerMin: n > 0 ? round(csPerMinSum / n, 1) : null,
      visionScore: visionN > 0 ? round(visionScoreSum / visionN, 1) : null,
      visionPerMin: visionN > 0 ? round(visionPerMinSum / visionN, 1) : null,
      controlWardsBought:
        visionN > 0 ? round(controlWardsSum / visionN, 1) : null,
      goldPerMin: n > 0 ? round(goldPerMinSum / n, 0) : null,
      damagePerMin: n > 0 ? round(dmgPerMinSum / n, 0) : null,
      goldEfficiency: timed > 0 ? round(goldEffSum / timed, 3) : null,
      damageShare: damageShareN > 0 ? round(damageShareSum / damageShareN, 3) : null,
    },
    volume: {
      windows: volumeWindows(matches),
      consistencyStdDev: consistency,
    },
    spam: spamMetrics(matches),
    fatigue: fatigueMetrics(matches),
    patchAdaptability: patchStats(matches),
    champions: championStats(matches).slice(0, 12),
    mmrVelocity: mmrVelocity(snapshots),
    accounts: accounts.map((a) => ({
      accountId: a.id,
      region: a.region,
      summonerName: a.summonerName,
      matchCount: byAccount.get(a.id) ?? 0,
    })),
  };
}
