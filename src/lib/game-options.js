export const GAME_OPTIONS = [
  "Valorant",
  "Counter-Strike 2",
  "League of Legends",
  "Rocket League",
  "Overwatch 2",
  "Marvel Rivals",
  "Deadlock",
  "SSBU",
  "Honor of Kings",
];

export const MODE_OPTIONS = ["6v6", "5v5", "3v3", "2v2", "1v1"];

export const GAME_RANKS = {
  Valorant: ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"],
  "Counter-Strike 2": [
    "Silver",
    "Gold Nova",
    "Master Guardian",
    "Distinguished Master Guardian",
    "Legendary Eagle",
    "Supreme Master",
    "Global Elite",
    "Premier",
  ],
  "League of Legends": ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Challenger"],
  "Rocket League": [
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
    "Champion",
    "Grand Champion",
    "Supersonic Legend",
  ],
  "Overwatch 2": [
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
    "Master",
    "Grandmaster",
    "Champion",
    "Top 500",
  ],
  "Marvel Rivals": [
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
    "Grandmaster",
    "Celestial",
    "Eternity",
    "One Above All",
  ],
  Deadlock: [
    "Initiate",
    "Seeker",
    "Alchemist",
    "Arcanist",
    "Ritualist",
    "Emissary",
    "Archon",
    "Oracle",
    "Phantom",
    "Ascendant",
    "Eternus",
  ],
  SSBU: ["Beginner", "Intermediate", "Advanced", "Elite Smash", "PR Level", "Top Player"],
  "Honor of Kings": [
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
    "Master",
    "Grandmaster",
    "Mythic",
  ],
};

export const DEFAULT_RANK_BY_GAME = {
  Valorant: "Diamond",
  "Counter-Strike 2": "Master Guardian",
  "League of Legends": "Emerald",
  "Rocket League": "Champion",
  "Overwatch 2": "Diamond",
  "Marvel Rivals": "Diamond",
  Deadlock: "Emissary",
  SSBU: "Elite Smash",
  "Honor of Kings": "Diamond",
};

export function getRanksForGame(gameTitle) {
  if (gameTitle === "Overwatch") return GAME_RANKS["Overwatch 2"];
  return GAME_RANKS[gameTitle] || GAME_RANKS.Valorant;
}

export function getDefaultRankForGame(gameTitle) {
  if (gameTitle === "Overwatch") return DEFAULT_RANK_BY_GAME["Overwatch 2"];
  return DEFAULT_RANK_BY_GAME[gameTitle] || getRanksForGame(gameTitle)[0];
}

export function getDefaultModeForGame(gameTitle) {
  if (gameTitle === "Rocket League") return "3v3";
  if (gameTitle === "Overwatch" || gameTitle === "Overwatch 2" || gameTitle === "Marvel Rivals") return "6v6";
  if (gameTitle === "SSBU") return "1v1";
  return "5v5";
}

export function getModesForGame(gameTitle) {
  if (gameTitle === "Rocket League") return ["3v3", "2v2", "1v1"];
  if (gameTitle === "Overwatch" || gameTitle === "Overwatch 2" || gameTitle === "Marvel Rivals") return ["6v6"];
  if (gameTitle === "SSBU") return ["1v1", "2v2", "4v4", "5v5"];
  return ["5v5"];
}
