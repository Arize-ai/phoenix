/**
 * The team allowlist: anyone NOT on it is treated as an "outside user" whose
 * comments need a reply.
 */
const TEAM = [
  "anticorrelator",
  "axiomofjoy",
  "cephalization",
  "ehutt",
  "jimbobbennett",
  "mikeldking",
  "Nancy-Chauhan",
  "PatriciaArnedo",
  "rickarize",
  "RogerHYang",
  "seldo",
  "yfrigui2",
];

/** Case-insensitive membership set for fast lookups during a sync. */
export function teamSet(): Set<string> {
  return new Set(TEAM.map((login) => login.toLowerCase()));
}
