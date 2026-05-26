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
  "Wukong", "Xayah", "Xerath", "Xin Zhao", "Yasuo", "Yone", "Yorick", "Yunara", "Zaahen",
  "Zac", "Zed", "Zeri", "Ziggs", "Zilean", "Zoe", "Zyra",
] as const;

export type Champion = (typeof CHAMPIONS)[number];

export function championImageUrl(name: string): string {
  const key = name
    .replace(/['.\s]/g, "")
    .replace("Wukong", "MonkeyKing")
    .replace("Nunu", "Nunu")
    .replace("RenataGlasc", "Renata")
    .replace("DrMundo", "DrMundo")
    .replace("LeeSin", "LeeSin")
    .replace("MasterYi", "MasterYi")
    .replace("TwistedFate", "TwistedFate")
    .replace("JarvanIV", "JarvanIV")
    .replace("AurelionSol", "AurelionSol")
    .replace("TahmKench", "TahmKench")
    .replace("MissFortune", "MissFortune")
    .replace("KaiSa", "Kaisa")
    .replace("KhaZix", "Khazix")
    .replace("ChoGath", "Chogath")
    .replace("KogMaw", "KogMaw")
    .replace("RekSai", "RekSai")
    .replace("VelKoz", "Velkoz")
    .replace("BelVeth", "Belveth");
  return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${key}.png`;
}
