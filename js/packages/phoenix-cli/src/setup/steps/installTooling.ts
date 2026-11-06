/**
 * Install the tooling: the global `px` CLI, and the Phoenix skills.
 *
 * Runs after traces are verified — the peak-motivation moment — and offers
 * the tooling that turns "traces are flowing" into "I can look at them":
 * a global `px` install when setup is running without `px` on PATH
 * (the `npx @arizeai/phoenix-cli setup` case), and the Phoenix skills for
 * the user's coding agent via `npx skills add` (no `--skill` pins — the
 * skills CLI's own picker lists the repo's skills and target agents). Both
 * installs are spawned on the terminal so their own output and prompts show
 * through; failures are non-fatal warnings with the command to retry by hand.
 */

import * as COPY from "../copy";
import type { CommandSpec, SetupDeps } from "../deps";
import { selectBoolean } from "../ui/selectBoolean";

const CLI_INSTALL_SPEC: Omit<CommandSpec, "cwd"> = {
  command: "npm",
  args: ["install", "-g", "@arizeai/phoenix-cli"],
};

/**
 * `npx skills add`, as spawned. The leading `-y` is npx's own — install the
 * `skills` package without asking.
 *
 * Unattended, the skills CLI needs its `--yes` too: it is interactive by
 * default (a skill picker, an agent picker, a final confirm) and a missing TTY
 * does not suppress those prompts, so without the flag a headless run hangs on
 * stdin. With it, the installer takes every skill in the repo for the agents it
 * detects. Interactively we leave it off, so the user drives those pickers.
 */
function skillsAddSpec(unattended: boolean): Omit<CommandSpec, "cwd"> {
  return {
    command: "npx",
    args: [
      "-y",
      "skills",
      "add",
      COPY.SKILLS_SOURCE,
      ...(unattended ? ["--yes"] : []),
    ],
  };
}

type ToolingOfferCopy = (typeof COPY.TOOLING)[keyof typeof COPY.TOOLING];

/** What an install offer did — reported in the setup summary. */
export type ToolingOutcome = "installed" | "failed" | "declined" | "skipped";

export interface ToolingResult {
  cli: ToolingOutcome;
  skills: ToolingOutcome;
}

/**
 * Install, honoring a decision the caller already made. `decided` short-circuits
 * the prompt: `true` installs (`--skills`), `false` skips (`--no-skills`), and
 * `undefined` asks — so a headless run, which has no terminal to ask on, must
 * arrive here already decided.
 */
async function offerInstall(
  deps: Pick<SetupDeps, "context" | "processes" | "prompter">,
  copy: ToolingOfferCopy,
  spec: Omit<CommandSpec, "cwd">,
  decided?: boolean
): Promise<ToolingOutcome> {
  const optedIn =
    decided ??
    (await selectBoolean({
      prompter: deps.prompter,
      message: copy.message,
      yesLabel: copy.yes,
      noLabel: copy.no,
    }));
  if (!optedIn) {
    return "declined";
  }
  const { exitCode } = await deps.processes.spawnInteractive({
    ...spec,
    cwd: deps.context.cwd,
  });
  deps.prompter.line(exitCode === 0 ? copy.installed : copy.failed);
  return exitCode === 0 ? "installed" : "failed";
}

export async function offerToolingInstalls(
  deps: Pick<SetupDeps, "context" | "processes" | "prompter">,
  {
    pxOnPath,
    skills,
    canPrompt,
  }: {
    /** Started at setup launch so the probe never blocks this prompt. */
    pxOnPath: Promise<boolean>;
    /** `--skills` / `--no-skills`; undefined means ask (when we can). */
    skills?: boolean;
    /** False in a headless run: there is no terminal to ask on. */
    canPrompt: boolean;
  }
): Promise<ToolingResult> {
  // The global CLI install is prompt-only — it is offered when `px` is missing
  // (an `npx` run), and skipped outright when we cannot ask, because installing
  // a global npm package is not something to do to an unattended caller.
  const cli =
    !canPrompt || (await pxOnPath)
      ? "skipped"
      : await offerInstall(deps, COPY.TOOLING.cli, CLI_INSTALL_SPEC);

  // With no prompt to fall back on, an unflagged skills install defaults to
  // going ahead: the only reason to invoke this lane unattended is to install.
  // `--no-skills` still declines. This default lives here, next to `canPrompt`,
  // rather than in each caller.
  const skillsOutcome = await offerInstall(
    deps,
    COPY.TOOLING.skills,
    skillsAddSpec(!canPrompt),
    canPrompt ? skills : (skills ?? true)
  );
  return { cli, skills: skillsOutcome };
}
