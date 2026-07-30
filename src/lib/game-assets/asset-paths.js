const LEAGUE_CHAMPION_FILE_ALIASES = {
  aurelionsol: "AurelionSol",
  belveth: "Belveth",
  chogath: "Chogath",
  drmundo: "DrMundo",
  jarvaniv: "JarvanIV",
  kaisa: "Kaisa",
  khazix: "Khazix",
  kogmaw: "KogMaw",
  ksante: "KSante",
  leesin: "LeeSin",
  masteryi: "MasterYi",
  missfortune: "MissFortune",
  monkeyking: "MonkeyKing",
  nunuandwillump: "Nunu",
  nunuwillump: "Nunu",
  reksai: "RekSai",
  renataglasc: "Renata",
  tahmkench: "TahmKench",
  twistedfate: "TwistedFate",
  velkoz: "Velkoz",
  wukong: "MonkeyKing",
  xinzhao: "XinZhao",
};

const VALORANT_AGENT_FILE_ALIASES = {
  kayo: "kayo",
  "kay/o": "kayo",
};

const TEAM_MARVEL_HERO_FILE_ALIASES = {
  cloakdagger: "cloak-and-dagger",
  cloakanddagger: "cloak-and-dagger",
  doctorstrange: "doctor-strange",
  humantorch: "human-torch",
  invisiblewoman: "invisible-woman",
  ironfist: "iron-fist",
  ironman: "iron-man",
  jeff: "jeff-the-land-shark",
  jeffthelandshark: "jeff-the-land-shark",
  misterfantastic: "mister-fantastic",
  moonknight: "moon-knight",
  peniparker: "peni-parker",
  rocketraccoon: "rocket-raccoon",
  scarletwitch: "scarlet-witch",
  spiderman: "spider-man",
  starlord: "star-lord",
  thepunisher: "the-punisher",
  thething: "the-thing",
  wintersoldier: "winter-soldier",
};

const DASHBOARD_MARVEL_HERO_FILE_ALIASES = {
  ...TEAM_MARVEL_HERO_FILE_ALIASES,
  blackcat: "black_cat",
  elsabloodstone: "elsa_bloodstone",
  rocket: "rocket-raccoon",
  whitefox: "white_fox",
};

const DEADLOCK_HERO_FILE_ALIASES = {
  graytalon: "grey-talon",
  greytalon: "grey-talon",
  ladygeist: "lady-geist",
  mcginnis: "mcginnis",
  moandkrill: "mo-krill",
  mokrill: "mo-krill",
  theboss: "the-boss",
  thedoorman: "the-doorman",
};

function compactPickKey(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function toChampionFileStem(name = "") {
  const key = compactPickKey(name);
  if (!key) return "";
  return LEAGUE_CHAMPION_FILE_ALIASES[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

export function toAgentFileStem(name = "") {
  const key = String(name).toLowerCase().replace(/[^a-z0-9/]/g, "");
  if (!key) return "";
  return VALORANT_AGENT_FILE_ALIASES[key] || key.replace(/\//g, "");
}

export function toMarvelHeroFileStem(name = "", { variant = "team" } = {}) {
  const key = compactPickKey(name);
  if (!key) return "";
  const aliases = variant === "dashboard" ? DASHBOARD_MARVEL_HERO_FILE_ALIASES : TEAM_MARVEL_HERO_FILE_ALIASES;
  return aliases[key] || String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function toDeadlockHeroFileStem(name = "") {
  const key = compactPickKey(String(name).replace(/&/g, "and"));
  if (!key) return "";
  return DEADLOCK_HERO_FILE_ALIASES[key] || String(name).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getPickImagePath(gameTitle, pick, { marvelVariant = "team" } = {}) {
  if (!pick) return "";
  if (gameTitle === "League of Legends") return `/lol/champions/${toChampionFileStem(pick)}.png`;
  if (gameTitle === "Valorant") return `/valorant/agents/${toAgentFileStem(pick)}.png`;
  if (gameTitle === "Marvel Rivals") return `/marvel-rivals/heroes/${toMarvelHeroFileStem(pick, { variant: marvelVariant })}_avatar.png`;
  if (gameTitle === "Deadlock") return `/deadlock/heroes/${toDeadlockHeroFileStem(pick)}.png`;
  return "";
}
