/**
 * Offer to point `px` at the project setup just connected.
 *
 * Because setup *is* px, everything here is in-process — the profile
 * (including the API key, when auth is on) is written through px's own
 * settings module (`~/.px/settings.json`, dir 0700, file 0600). No argv or
 * subprocess ever carries the secret. Any failure is a non-fatal warning;
 * setup proceeds regardless.
 */

import {
  getSettingsPath,
  getStoredActiveProfile,
  loadSettings,
  saveSettings,
  SettingsFileError,
  type ProfileEntry,
  type SettingsFile,
} from "../../settings";
import * as COPY from "../copy";
import type { SetupDeps } from "../deps";
import { SetupCancelledError } from "../errors";
import { redactForDisplay } from "../util/redact";
import type { Connection } from "./establishConnection";

/** `local` for localhost, else the host with dots and colons → dashes. */
export function profileNameForEndpoint(endpoint: string): string {
  // URL.hostname keeps the brackets on IPv6 literals (e.g. "[::1]").
  const host = new URL(endpoint).hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return "local";
  }
  return host.replace(/^\[|\]$/g, "").replace(/[.:]/g, "-");
}

export interface PxProfileArgs {
  connection: Connection;
  /** Override the settings file path (tests). */
  settingsPath?: string;
}

export async function offerPxProfile(
  deps: Pick<SetupDeps, "prompter">,
  { connection, settingsPath }: PxProfileArgs
): Promise<void> {
  // Strict, and on its own: a settings file whose contents don't parse must not
  // degrade to the empty profiles record a lenient load returns, which the save
  // below would then write over whatever the user had. A file that is simply
  // absent is not an error — the load returns fresh settings for it.
  let settings: SettingsFile;
  try {
    settings = loadSettings({ settingsPath, strict: true });
  } catch (error) {
    // Only a file we can't parse gets sent here. `px profile create`, the
    // remedy the generic failure suggests, loads the same file the same strict
    // way — so for this one failure it is no remedy at all, and the file itself
    // is what has to be dealt with.
    if (error instanceof SettingsFileError) {
      deps.prompter.line(
        COPY.PX_PROFILE.unreadableSettings(
          settingsPath ?? getSettingsPath(),
          redactForDisplay(error.message)
        )
      );
      return;
    }
    deps.prompter.line(COPY.PX_PROFILE.failed(redactForDisplay(String(error))));
    return;
  }

  try {
    const active = getStoredActiveProfile(settings);

    // A fully-configured active profile pointing elsewhere is a conflict —
    // ask before switching, never clobber silently. A partially configured
    // profile (missing endpoint or project) is non-conflicting.
    const conflicting =
      active !== undefined &&
      Boolean(active.entry.endpoint) &&
      Boolean(active.entry.project) &&
      (active.entry.endpoint !== connection.endpoint ||
        active.entry.project !== connection.projectName);

    const optedIn = await deps.prompter.select<boolean>(
      conflicting && active
        ? {
            message: COPY.PX_PROFILE.conflictMessage(
              active.name,
              active.entry.endpoint ?? ""
            ),
            options: [
              { value: false, label: COPY.PX_PROFILE.conflictNo },
              { value: true, label: COPY.PX_PROFILE.conflictYes },
            ],
          }
        : {
            message: COPY.PX_PROFILE.optInMessage,
            options: [
              { value: true, label: COPY.PX_PROFILE.optInYes },
              { value: false, label: COPY.PX_PROFILE.optInNo },
            ],
          }
    );
    if (!optedIn) {
      return;
    }

    const profileName = profileNameForEndpoint(connection.endpoint);
    const entry: ProfileEntry = {
      endpoint: connection.endpoint,
      project: connection.projectName,
    };
    if (connection.apiKey) {
      entry.apiKey = connection.apiKey;
    }
    settings.profiles[profileName] = {
      ...settings.profiles[profileName],
      ...entry,
    };
    settings.activeProfile = profileName;
    saveSettings(settings, { settingsPath });
    deps.prompter.line(COPY.PX_PROFILE.created(profileName));
  } catch (error) {
    if (error instanceof SetupCancelledError) {
      throw error;
    }
    deps.prompter.line(COPY.PX_PROFILE.failed(redactForDisplay(String(error))));
  }
}
