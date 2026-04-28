export const GAME_OPTIONS = [
  "Valorant",
  "Counter-Strike 2",
  "League of Legends",
  "Rocket League",
  "Overwatch",
  "Marvel Rivals",
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
  Overwatch: [
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
};

export const DEFAULT_RANK_BY_GAME = {
  Valorant: "Diamond",
  "Counter-Strike 2": "Master Guardian",
  "League of Legends": "Emerald",
  "Rocket League": "Champion",
  Overwatch: "Diamond",
  "Marvel Rivals": "Diamond",
};

export function getRanksForGame(gameTitle) {
  return GAME_RANKS[gameTitle] || GAME_RANKS.Valorant;
}

export function getDefaultRankForGame(gameTitle) {
  return DEFAULT_RANK_BY_GAME[gameTitle] || getRanksForGame(gameTitle)[0];
}

export function getDefaultModeForGame(gameTitle) {
  return gameTitle === "Overwatch" || gameTitle === "Marvel Rivals" ? "6v6" : "5v5";
}
