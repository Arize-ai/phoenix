import { SEED_ORG } from "./config.ts";
import { getCachedMembership, setCachedMembership } from "./db.ts";
import { fetchOrgMembership } from "./github.ts";

/** Org membership rarely changes — cache each answer for a week. */
const TTL_MS = 7 * 86_400_000;

/**
 * Is `login` a member of the monitored org? Answers from the local cache when
 * fresh, otherwise asks GitHub and records the result. On an indeterminate API
 * response we keep any prior answer rather than flapping.
 */
export async function isOrgMember(
  login: string,
  now: number
): Promise<boolean> {
  const cached = getCachedMembership(login);
  if (cached && now - Date.parse(cached.checked_at) < TTL_MS) {
    return cached.is_member;
  }
  const result = await fetchOrgMembership(SEED_ORG, login);
  if (result === null) return cached ? cached.is_member : false;
  setCachedMembership(login, result, new Date(now).toISOString());
  return result;
}
