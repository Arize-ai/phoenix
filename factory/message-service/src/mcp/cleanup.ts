import { getDatabase } from "@/db/client";
import { sql } from "kysely";

/** Delete expired OAuth grants without changing their sessions or Slack threads. */
export async function deleteExpiredMcpGrants(): Promise<void> {
  await getDatabase()
    .deleteFrom("mcp_oauth_grants")
    .where("expires_at", "<=", sql<Date>`current_timestamp`)
    .execute();
}
