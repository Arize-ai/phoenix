/**
 * The composition root: the one place the capability contracts meet their
 * real, system-backed implementations. Kept separate from the contract
 * barrel (`index.ts`) so modules the wiring depends on — like the clack
 * prompter — can themselves import contracts from `../deps` without forming
 * a cycle.
 */

import { createClackPrompter } from "../ui/clackPrompter";
import { createSystemClipboardWriter } from "./clipboard";
import { createSystemClock } from "./clock";
import { captureRunContext } from "./context";
import { fetchDocs } from "./docs";
import { createSystemOAuthLogin } from "./oauthLogin";
import { createPhoenixClientFactory } from "./phoenixClient";
import { createSystemProcessRunner } from "./processes";
import type { SetupDeps } from "./index";

export function buildDefaultDeps({
  apiUrl,
}: {
  /** Hidden --api-url dev override — see {@link createPhoenixClientFactory}. */
  apiUrl?: string;
} = {}): SetupDeps {
  const processes = createSystemProcessRunner();
  return {
    context: captureRunContext(),
    prompter: createClackPrompter(),
    processes,
    clock: createSystemClock(),
    // The clipboard is itself composed from the process runner: pbcopy & co
    // are subprocesses.
    writeClipboard: createSystemClipboardWriter(processes.exec),
    createClient: createPhoenixClientFactory({ apiUrl }),
    fetchDocs,
    oauthLogin: createSystemOAuthLogin({ apiUrl, fetchImpl: fetch }),
  };
}
