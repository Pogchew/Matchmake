const ROLE_ALIASES = new Map([
  ["toplane", "top"],
  ["jg", "jungle"],
  ["jungler", "jungle"],
  ["middle", "mid"],
  ["midlane", "mid"],
  ["adcarry", "adc"],
  ["attackdamagecarry", "adc"],
  ["bot", "adc"],
  ["botlane", "adc"],
  ["bottom", "adc"],
  ["bottomlane", "adc"],
  ["sup", "support"],
  ["supp", "support"],
]);

function normalizeRoleKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  return ROLE_ALIASES.get(normalized) || normalized;
}

export function orderCompositionRows(rows = [], roleOrder = []) {
  if (!Array.isArray(rows) || rows.length < 2 || !roleOrder.length) return rows;

  const roleRanks = new Map(
    roleOrder.map((role, index) => [normalizeRoleKey(role), index])
  );

  return rows
    .map((row, index) => {
      const roleKey = [row?.role, row?.position, row?.lane]
        .map(normalizeRoleKey)
        .find((key) => roleRanks.has(key));

      return {
        index,
        rank: roleKey ? roleRanks.get(roleKey) : roleOrder.length,
        row,
      };
    })
    .sort((first, second) => first.rank - second.rank || first.index - second.index)
    .map((entry) => entry.row);
}
