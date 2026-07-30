import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  getPickImagePath,
  toAgentFileStem,
  toChampionFileStem,
  toDeadlockHeroFileStem,
  toMarvelHeroFileStem,
} from "../src/lib/game-assets/asset-paths.js";
import { MARVEL_RIVALS_HERO_OPTIONS } from "../src/lib/game-assets/marvel-rivals-hero-assets.js";
import { LEAGUE_CHAMPION_OPTIONS } from "../src/lib/game-assets/generated-character-options.js";
import { normalizeLeagueChampionName } from "../src/lib/game-assets/league-champions.js";

assert.equal(toChampionFileStem("K'Sante"), "KSante", "League aliases retain the existing asset stem");
assert.equal(toChampionFileStem("Wukong"), "MonkeyKing", "League aliases retain legacy champion file names");
assert.equal(toChampionFileStem("Renata Glasc"), "Renata", "League aliases retain Renata's existing asset stem");
assert.equal(toChampionFileStem("Nunu & Willump"), "Nunu", "League aliases retain Nunu's existing asset stem");
assert.equal(toAgentFileStem("KAY/O"), "kayo", "Valorant aliases normalize KAY/O");
assert.equal(toMarvelHeroFileStem("Cloak & Dagger"), "cloak-and-dagger", "Marvel aliases normalize punctuation");
assert.equal(toMarvelHeroFileStem("Black Cat"), "black-cat", "Team Marvel aliases preserve the existing fallback stem");
assert.equal(toMarvelHeroFileStem("Black Cat", { variant: "dashboard" }), "black_cat", "Dashboard Marvel aliases preserve the current dashboard stem");
assert.equal(toDeadlockHeroFileStem("Gray Talon"), "grey-talon", "Deadlock aliases retain the existing asset spelling");
assert.equal(toDeadlockHeroFileStem("Mo & Krill"), "mo-krill", "Deadlock aliases normalize ampersands");

assert.equal(getPickImagePath("League of Legends", "K'Sante"), "/lol/champions/KSante.png");
assert.equal(getPickImagePath("League of Legends", "Locke"), "/lol/champions/Locke.png");
assert.equal(getPickImagePath("Valorant", "KAY/O"), "/valorant/agents/kayo.png");
assert.equal(getPickImagePath("Marvel Rivals", "Cloak & Dagger"), "/marvel-rivals/heroes/cloak-and-dagger_avatar.png");
assert.equal(getPickImagePath("Marvel Rivals", "Black Cat", { marvelVariant: "dashboard" }), "/marvel-rivals/heroes/black_cat_avatar.png");
assert.equal(getPickImagePath("Deadlock", "Gray Talon"), "/deadlock/heroes/grey-talon.png");
assert.equal(getPickImagePath("Overwatch 2", "Tracer"), "", "unsupported game has no asset path");
assert.equal(MARVEL_RIVALS_HERO_OPTIONS.length, 42, "canonical Marvel hero options retain the dashboard roster");
assert.deepEqual([...new Set(MARVEL_RIVALS_HERO_OPTIONS)], MARVEL_RIVALS_HERO_OPTIONS, "canonical Marvel hero options are unique");
assert.ok(MARVEL_RIVALS_HERO_OPTIONS.includes("Cloak & Dagger"), "canonical Marvel hero options retain punctuated names");
assert.equal(LEAGUE_CHAMPION_OPTIONS.length, 173, "League options match Riot Data Dragon 16.14.1");
assert.deepEqual([...new Set(LEAGUE_CHAMPION_OPTIONS)], LEAGUE_CHAMPION_OPTIONS, "League champion options are unique");
assert.ok(LEAGUE_CHAMPION_OPTIONS.includes("Locke"), "League options include Locke");
assert.equal(normalizeLeagueChampionName("Leblanc"), "LeBlanc", "League names normalize to selector casing");
assert.equal(normalizeLeagueChampionName("Renata"), "Renata Glasc", "League aliases normalize to the selector name");
assert.equal(normalizeLeagueChampionName("Not a champion"), "", "unknown League names do not enter saved reviews");

for (const relativePath of [
  getPickImagePath("League of Legends", "K'Sante"),
  getPickImagePath("Valorant", "KAY/O"),
  getPickImagePath("Deadlock", "Gray Talon"),
  getPickImagePath("League of Legends", "Locke"),
]) {
  await fs.access(path.join(process.cwd(), "public", relativePath));
}

for (const champion of LEAGUE_CHAMPION_OPTIONS) {
  await fs.access(path.join(process.cwd(), "public", getPickImagePath("League of Legends", champion)));
}

await fs.access(path.join(process.cwd(), "public", "lol", "reference", "league-champion-reference.png"));

console.log("Game asset path tests passed.");
