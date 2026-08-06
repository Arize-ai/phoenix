/**
 * GitHub PR Status Extension
 *
 * Shows the pull request associated with the current git branch in the footer
 * status bar. The PR reference is a clickable (OSC 8) hyperlink to the PR page.
 *
 * When the branch is part of a `gh stack` (stacked diffs), the footer also
 * shows the position within the stack, e.g. `2/4` (bottom → top).
 *
 * Refreshes on session start, after each turn, after git/gh bash commands,
 * and on a periodic timer. Manual refresh via `/pr`.
 */

import { isToolCallEventType, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "github-pr";
const POLL_INTERVAL_MS = 30_000;

interface PrInfo {
	number: number;
	url: string;
	state: string;
}

interface StackBranch {
	name: string;
	isCurrent: boolean;
	isMerged: boolean;
	pr?: PrInfo;
}

interface StackView {
	trunk: string;
	currentBranch: string;
	branches: StackBranch[];
}

/** Wrap text in an OSC 8 terminal hyperlink so it is clickable. */
function hyperlink(url: string, text: string): string {
	return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

async function exec(
	pi: ExtensionAPI,
	command: string,
	args: string[],
	signal?: AbortSignal,
): Promise<{ stdout: string; code: number } | null> {
	try {
		const result = await pi.exec(command, args, { signal, timeout: 8000 });
		return { stdout: result.stdout ?? "", code: result.code ?? 0 };
	} catch {
		return null;
	}
}

async function getCurrentBranch(pi: ExtensionAPI): Promise<string | null> {
	const res = await exec(pi, "git", ["rev-parse", "--abbrev-ref", "HEAD"]);
	if (!res || res.code !== 0) return null;
	const branch = res.stdout.trim();
	return branch && branch !== "HEAD" ? branch : null;
}

type Theme = ExtensionContext["ui"]["theme"];

/** Try to resolve the current branch's PR + stack position via `gh stack`. */
async function getStackStatus(pi: ExtensionAPI, theme: Theme): Promise<string | null> {
	const res = await exec(pi, "gh", ["stack", "view", "--json"]);
	if (!res || res.code !== 0 || !res.stdout.trim()) return null;

	let view: StackView;
	try {
		view = JSON.parse(res.stdout) as StackView;
	} catch {
		return null;
	}
	if (!Array.isArray(view.branches) || view.branches.length === 0) return null;

	const index = view.branches.findIndex((b) => b.isCurrent);
	if (index === -1) return null;

	const current = view.branches[index];
	if (!current.pr) return null;

	// Stack positions are 1-based, ordered bottom (closest to trunk) → top.
	const position = index + 1;
	const total = view.branches.length;
	const stackLabel = total > 1 ? ` [${position}/${total}]` : "";
	return formatStatus(current.pr, stackLabel, theme);
}

/** Fallback: resolve a PR for the current branch via `gh pr view`. */
async function getSinglePrStatus(pi: ExtensionAPI, theme: Theme): Promise<string | null> {
	const res = await exec(pi, "gh", ["pr", "view", "--json", "number,url,state"]);
	if (!res || res.code !== 0 || !res.stdout.trim()) return null;

	try {
		const pr = JSON.parse(res.stdout) as PrInfo;
		if (!pr.number || !pr.url) return null;
		return formatStatus(pr, "", theme);
	} catch {
		return null;
	}
}

function formatStatus(pr: PrInfo, stackLabel: string, theme: Theme): string {
	const link = theme.fg("accent", hyperlink(pr.url, `PR #${pr.number}`));
	const merged = pr.state && pr.state.toUpperCase() === "MERGED" ? " (merged)" : "";
	return `${link}${theme.fg("dim", `${stackLabel}${merged}`)}`;
}

export default function (pi: ExtensionAPI) {
	let lastStatus: string | null = null;
	let refreshing = false;
	let pollTimer: NodeJS.Timeout | undefined;
	// Tool call ids for bash commands that touch git/gh and may change PR state.
	const gitTouchingCalls = new Set<string>();

	async function refresh(ctx: ExtensionContext): Promise<void> {
		if (!ctx.hasUI || refreshing) return;
		refreshing = true;
		try {
			const branch = await getCurrentBranch(pi);
			if (!branch) {
				if (lastStatus !== null) {
					ctx.ui.setStatus(STATUS_KEY, "");
					lastStatus = null;
				}
				return;
			}

			const theme = ctx.ui.theme;
			const status = (await getStackStatus(pi, theme)) ?? (await getSinglePrStatus(pi, theme));
			const next = status ?? ""; // empty clears the footer entry
			if (next !== lastStatus) {
				ctx.ui.setStatus(STATUS_KEY, next);
				lastStatus = next;
			}
		} finally {
			refreshing = false;
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		await refresh(ctx);
		if (ctx.hasUI && !pollTimer) {
			pollTimer = setInterval(() => void refresh(ctx), POLL_INTERVAL_MS);
			// Do not keep the process alive solely for this poll.
			pollTimer.unref?.();
		}
	});

	pi.on("session_shutdown", async () => {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = undefined;
		}
	});

	pi.on("turn_end", async (_event, ctx) => {
		await refresh(ctx);
	});

	// Flag bash commands that touch git/gh so we can refresh once they finish.
	pi.on("tool_call", async (event) => {
		if (isToolCallEventType("bash", event)) {
			if (/\b(git|gh)\b/.test(event.input.command ?? "")) {
				gitTouchingCalls.add(event.toolCallId);
			}
		}
	});

	// Refresh promptly after git/gh operations that may change branch or PR state.
	pi.on("tool_execution_end", async (event, ctx) => {
		if (!gitTouchingCalls.delete(event.toolCallId)) return;
		await refresh(ctx);
	});

	pi.registerCommand("pr", {
		description: "Refresh the GitHub PR shown in the footer",
		handler: async (_args, ctx) => {
			lastStatus = null; // force re-set even if unchanged
			await refresh(ctx);
			ctx.ui.notify(lastStatus ? "PR status refreshed" : "No PR found for current branch", "info");
		},
	});
}
