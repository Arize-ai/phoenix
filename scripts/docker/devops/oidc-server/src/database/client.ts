import { Client } from "pg";
import type { User } from "../types/index.js";

export class DatabaseClient {
  private static readonly DEFAULT_USER: User = {
    id: "3",
    email: "testuser@arize.com",
    name: "Test User",
    role: "admin",
    groups: ["phoenix-admins", "full-access"],
  };

  // Polling intervals
  private static readonly FAST_POLL_MS = 500; // 500ms when waiting for migrations
  private static readonly NORMAL_POLL_MS = 5000; // 5 seconds once tables are ready

  private client: Client;
  private connected = false;
  private tablesReady = false;
  private users: User[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.client = new Client({
      host: process.env.DB_HOST || "db",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "postgres",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
    });
    this.users = [DatabaseClient.DEFAULT_USER];
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.connected = true;
      const dbConnected = {
        timestamp: new Date().toISOString(),
        event: "database_connected",
        host: process.env.DB_HOST || "db",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "postgres",
      };
      console.log(JSON.stringify(dbConnected));

      await this.fetchUsers();
      this.startPolling();
    } catch (error) {
      const dbConnectionFailed = {
        timestamp: new Date().toISOString(),
        event: "database_connection_failed",
        error: error instanceof Error ? error.message : String(error),
        host: process.env.DB_HOST || "db",
        port: parseInt(process.env.DB_PORT || "5432"),
      };
      console.log(JSON.stringify(dbConnectionFailed));

      this.fallbackToNoUsers();
    }
  }

  private async fetchUsers(): Promise<void> {
    if (!this.connected) {
      const dbNotConnected = {
        timestamp: new Date().toISOString(),
        event: "database_fetch_skipped",
        reason: "not_connected",
      };
      console.log(JSON.stringify(dbNotConnected));
      return;
    }

    try {
      const startTime = Date.now();
      const result = await this.client.query(
        `SELECT u.id, u.email, u.username, u.created_at, u.updated_at, ur.name as role_name 
         FROM users u 
         LEFT JOIN user_roles ur ON u.user_role_id = ur.id 
         WHERE u.auth_method = 'OAUTH2' 
         ORDER BY u.created_at`
      );
      const queryTime = Date.now() - startTime;

      // Tables are ready if we get here without error
      const wasWaitingForTables = !this.tablesReady;
      if (!this.tablesReady) {
        this.tablesReady = true;
        const tablesReady = {
          timestamp: new Date().toISOString(),
          event: "database_tables_ready",
          note: "Migrations complete, switching to normal polling interval",
        };
        console.log(JSON.stringify(tablesReady));
        // Switch to normal polling interval
        this.restartPolling(DatabaseClient.NORMAL_POLL_MS);
      }

      const previousCount = this.users.length;
      const previousEmails = this.users.map((u) => u.email).sort();

      if (result.rows.length === 0) {
        this.users = [DatabaseClient.DEFAULT_USER];
      } else {
        this.users = result.rows.map((row) => ({
          id: row.id.toString(),
          email: row.email,
          name: row.username || row.email.split("@")[0],
          role: this.getRoleForUser(row),
          groups: this.getGroupsForUser(row),
        }));
      }

      const currentEmails = this.users.map((u) => u.email).sort();
      const hasChanges =
        previousCount !== this.users.length ||
        JSON.stringify(previousEmails) !== JSON.stringify(currentEmails);

      if (hasChanges || wasWaitingForTables) {
        const added = currentEmails.filter(
          (email) => !previousEmails.includes(email)
        );
        const removed = previousEmails.filter(
          (email) => !currentEmails.includes(email)
        );

        const userChangeDetected = {
          timestamp: new Date().toISOString(),
          event: "user_change_detected",
          query_time_ms: queryTime,
          user_count: {
            previous: previousCount,
            current: this.users.length,
          },
          changes: {
            added: added,
            removed: removed,
          },
          current_users:
            this.users.length > 0
              ? this.users.map((user, i) => {
                  const dbUser = result.rows.find(
                    (row) => row.id.toString() === user.id
                  );
                  return {
                    index: i + 1,
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role_name: dbUser?.role_name,
                    oauth_role: user.role,
                    groups: user.groups,
                    groups_count: user.groups.length,
                    created_date: dbUser?.created_at
                      ?.toISOString()
                      .split("T")[0],
                  };
                })
              : [],
        };
        console.log(JSON.stringify(userChangeDetected));
      } else {
        if (Date.now() % (120 * 5000) < 5000) {
          const userPollHealthCheck = {
            timestamp: new Date().toISOString(),
            event: "user_poll_health_check",
            user_count: this.users.length,
            query_time_ms: queryTime,
            poll_interval_note: "logged_every_10_minutes",
          };
          console.log(JSON.stringify(userPollHealthCheck));
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isTableNotFound = errorMessage.includes("does not exist");

      if (isTableNotFound && !this.tablesReady) {
        // Tables not ready yet (migrations not complete) - keep fast polling
        const waitingForMigrations = {
          timestamp: new Date().toISOString(),
          event: "waiting_for_migrations",
          error: errorMessage,
          poll_interval_ms: DatabaseClient.FAST_POLL_MS,
          note: "Using default user until migrations complete",
        };
        console.log(JSON.stringify(waitingForMigrations));
      } else {
        const dbQueryFailed = {
          timestamp: new Date().toISOString(),
          event: "database_query_failed",
          error: errorMessage,
          connection_status: this.connected,
          current_user_count: this.users.length,
          action: "keeping_existing_users",
        };
        console.log(JSON.stringify(dbQueryFailed));
      }
    }
  }

  private startPolling(): void {
    // Start with fast polling if tables aren't ready yet
    const intervalMs = this.tablesReady
      ? DatabaseClient.NORMAL_POLL_MS
      : DatabaseClient.FAST_POLL_MS;

    this.pollingInterval = setInterval(async () => {
      await this.fetchUsers();
    }, intervalMs);

    const pollingStarted = {
      timestamp: new Date().toISOString(),
      event: "user_polling_started",
      interval_ms: intervalMs,
      tables_ready: this.tablesReady,
      mode: this.tablesReady ? "normal" : "waiting_for_migrations",
      next_poll_time: new Date(Date.now() + intervalMs).toISOString(),
    };
    console.log(JSON.stringify(pollingStarted));
  }

  private restartPolling(intervalMs: number): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      await this.fetchUsers();
    }, intervalMs);

    const pollingRestarted = {
      timestamp: new Date().toISOString(),
      event: "polling_interval_changed",
      new_interval_ms: intervalMs,
      reason: "tables_now_ready",
    };
    console.log(JSON.stringify(pollingRestarted));
  }

  private fallbackToNoUsers(): void {
    this.users = [DatabaseClient.DEFAULT_USER];

    const fallbackMode = {
      timestamp: new Date().toISOString(),
      event: "fallback_to_default_user",
      reason: "database_unavailable",
      user_count: 1,
      default_user: DatabaseClient.DEFAULT_USER.email,
      action: "starting_reconnection_polling",
    };
    console.log(JSON.stringify(fallbackMode));

    setInterval(async () => {
      if (!this.connected) {
        try {
          await this.client.connect();
          this.connected = true;

          const dbReconnected = {
            timestamp: new Date().toISOString(),
            event: "database_reconnected",
            action: "resuming_user_fetch",
          };
          console.log(JSON.stringify(dbReconnected));

          await this.fetchUsers();
        } catch (error) {}
      } else {
        await this.fetchUsers();
      }
    }, DatabaseClient.FAST_POLL_MS);
  }

  private getGroupsForUser(row: any): string[] {
    const roleName = row.role_name?.toUpperCase();

    const roleGroups: { [roleName: string]: string[] } = {
      ADMIN: ["phoenix-admins", "full-access"],
      MEMBER: ["phoenix-members", "write-access"],
      VIEWER: ["phoenix-viewers", "read-access"],
    };

    const defaultGroups = ["phoenix-users", "authenticated"];

    const roleSpecificGroups = roleGroups[roleName] || ["phoenix-users"];

    return [...defaultGroups, ...roleSpecificGroups];
  }

  private getRoleForUser(row: any): string {
    const roleName = row.role_name?.toUpperCase();

    const roleMapping: { [roleName: string]: string } = {
      ADMIN: "admin",
      MEMBER: "editor",
      VIEWER: "viewer",
    };

    return roleMapping[roleName] || "viewer";
  }

  getUsers(): User[] {
    return this.users;
  }

  async close(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    if (this.connected) {
      await this.client.end();
      this.connected = false;

      const dbClosed = {
        timestamp: new Date().toISOString(),
        event: "database_connection_closed",
        reason: "graceful_shutdown",
      };
      console.log(JSON.stringify(dbClosed));
    }
  }
}
