import {
  CHAMPION_IMAGE_KEYS,
  DDRAGON_VERSION,
} from "@/lib/champion-image-keys.generated";

export { DDRAGON_VERSION };

export const CHAMPIONS = [
  "Aatrox", "Ahri", "Akali", "Akshan", "Alistar", "Ambessa", "Amumu", "Anivia",
  "Annie", "Aphelios", "Ashe", "Aurelion Sol", "Aurora", "Azir", "Bard", "Bel'Veth",
  "Blitzcrank", "Brand", "Braum", "Briar", "Caitlyn", "Camille", "Cassiopeia",
  "Cho'Gath", "Corki", "Darius", "Diana", "Draven", "Dr. Mundo", "Ekko", "Elise",
  "Evelynn", "Ezreal", "Fiddlesticks", "Fiora", "Fizz", "Galio", "Gangplank", "Garen",
  "Gnar", "Gragas", "Graves", "Gwen", "Hecarim", "Heimerdinger", "Hwei", "Illaoi",
  "Irelia", "Ivern", "Janna", "Jarvan IV", "Jax", "Jayce", "Jhin", "Jinx", "K'Sante",
  "Kai'Sa", "Kalista", "Karma", "Karthus", "Kassadin", "Katarina", "Kayle", "Kayn",
  "Kennen", "Kha'Zix", "Kindred", "Kled", "Kog'Maw", "LeBlanc", "Lee Sin", "Leona",
  "Lillia", "Lissandra", "Lucian", "Lulu", "Lux", "Malphite", "Malzahar", "Maokai",
  "Master Yi", "Mel", "Milio", "Miss Fortune", "Mordekaiser", "Morgana", "Naafiri",
  "Nami", "Nasus", "Nautilus", "Neeko", "Nidalee", "Nilah", "Nocturne", "Nunu",
  "Olaf", "Orianna", "Ornn", "Pantheon", "Poppy", "Pyke", "Qiyana", "Quinn", "Rakan",
  "Rammus", "Rek'Sai", "Rell", "Renata Glasc", "Renekton", "Rengar", "Riven", "Rumble",
  "Ryze", "Samira", "Sejuani", "Senna", "Seraphine", "Sett", "Shaco", "Shen", "Shyvana",
  "Singed", "Sion", "Sivir", "Skarner", "Smolder", "Sona", "Soraka", "Swain", "Sylas",
  "Syndra", "Tahm Kench", "Taliyah", "Talon", "Taric", "Teemo", "Thresh", "Tristana",
  "Trundle", "Tryndamere", "Twisted Fate", "Twitch", "Udyr", "Urgot", "Varus", "Vayne",
  "Veigar", "Vel'Koz", "Vex", "Vi", "Viego", "Viktor", "Vladimir", "Volibear", "Warwick",
  "Wukong", "Xayah", "Xerath", "Xin Zhao", "Yasuo", "Yone", "Yorick", "Yuumi", "Yunara", "Zaahen",
  "Zac", "Zed", "Zeri", "Ziggs", "Zilean", "Zoe", "Zyra",
] as const;

export type Champion = (typeof CHAMPIONS)[number];

const LOWER_KEY_CACHE = new Map<string, string>();
const KEY_TO_DISPLAY = new Map<string, string>();

for (const name of CHAMPIONS) {
  const key = lookupImageKey(name);
  if (key && !KEY_TO_DISPLAY.has(key)) {
    KEY_TO_DISPLAY.set(key, name);
  }
}

function lookupImageKey(name: string): string | undefined {
  const direct = CHAMPION_IMAGE_KEYS[name];
  if (direct) return direct;

  const cached = LOWER_KEY_CACHE.get(name);
  if (cached) return cached;

  const lowered = name.toLowerCase();
  for (const [label, key] of Object.entries(CHAMPION_IMAGE_KEYS)) {
    if (label.toLowerCase() === lowered) {
      LOWER_KEY_CACHE.set(name, key);
      return key;
    }
  }

  return undefined;
}

/** Last-resort key when a stored champion string is not in the Data Dragon map. */
function fallbackImageKey(name: string): string {
  return name
    .replace(/['.\s]/g, "")
    .replace(/^Wukong$/i, "MonkeyKing")
    .replace(/^Renata\s*Glasc$/i, "Renata")
    .replace(/^KaiSa$/i, "Kaisa")
    .replace(/^KhaZix$/i, "Khazix")
    .replace(/^ChoGath$/i, "Chogath")
    .replace(/^VelKoz$/i, "Velkoz")
    .replace(/^BelVeth$/i, "Belveth")
    .replace(/^LeBlanc$/i, "Leblanc");
}

/** Resolve a champion display name (or internal id) to a Data Dragon image file key. */
export function championImageKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Unknown";

  return lookupImageKey(trimmed) ?? fallbackImageKey(trimmed);
}

export function championImageUrl(name: string): string {
  const key = championImageKey(name);
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${encodeURIComponent(key)}.png`;
}

/** Best-effort user-facing champion label from display/internal id input. */
export function championDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Unknown";

  const key = lookupImageKey(trimmed);
  if (!key) return trimmed;

  return KEY_TO_DISPLAY.get(key) ?? trimmed;
}
