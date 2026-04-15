/**
 * link-quality evaluator
 *
 * Grades an agent response on whether documentation links are well-formed and
 * rooted at the canonical Phoenix docs domain. Intended for experiments that
 * exercise the PXI agent system prompt.
 *
 * Decision order (first match wins):
 *   1. no-links      — no markdown links or bare URLs at all
 *   2. relative-only — only `[text](/path)` links, zero absolute URLs
 *   3. bare-url      — raw `https://...` without markdown wrapping
 *   4. wrong-prefix  — absolute URLs outside the allowed prefix list
 *   5. valid         — every absolute URL is inside the allowed prefix list
 */
import { asExperimentEvaluator } from "@arizeai/phoenix-client/experiments";

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const RELATIVE_MARKDOWN_LINK_RE = /\[([^\]]+)\]\((\/[^\s)]+)\)/g;
const BARE_URL_RE = /(?<!\]\()https?:\/\/[^\s)]+/g;

const DEFAULT_ALLOWED_ABSOLUTE_PREFIXES = [
  "https://arize.com/docs/phoenix",
  "http://localhost:6006",
] as const;

export type LinkQualityLabel =
  | "no-links"
  | "relative-only"
  | "bare-url"
  | "wrong-prefix"
  | "valid";

export interface LinkQualityEvaluatorOptions {
  /**
   * Optional override of the evaluator name surfaced in Phoenix. Defaults to
   * "link-quality".
   */
  name?: string;
  /**
   * Absolute URL prefixes that count as valid documentation links. Defaults to
   * the public Phoenix docs domain and the local Phoenix UI host.
   */
  allowedPrefixes?: readonly string[];
}

export function createLinkQualityEvaluator(
  options: LinkQualityEvaluatorOptions = {}
) {
  const allowedPrefixes =
    options.allowedPrefixes ?? DEFAULT_ALLOWED_ABSOLUTE_PREFIXES;

  return asExperimentEvaluator({
    name: options.name ?? "link-quality",
    kind: "CODE",
    evaluate: ({ output }) => {
      const text = typeof output === "string" ? output : "";
      const absoluteMarkdown = [...text.matchAll(MARKDOWN_LINK_RE)].map(
        (m) => m[2]
      );
      const relativeMarkdown = [
        ...text.matchAll(RELATIVE_MARKDOWN_LINK_RE),
      ].map((m) => m[2]);
      const bareUrls = text.match(BARE_URL_RE) ?? [];
      const absoluteUrls = [...absoluteMarkdown, ...bareUrls];

      if (absoluteUrls.length === 0 && relativeMarkdown.length === 0) {
        return {
          score: 0,
          label: "no-links" satisfies LinkQualityLabel,
          explanation: "response contained no links",
        };
      }
      if (absoluteUrls.length === 0) {
        return {
          score: 0,
          label: "relative-only" satisfies LinkQualityLabel,
          explanation: `all ${relativeMarkdown.length} links are relative: ${relativeMarkdown.slice(0, 3).join(", ")}`,
        };
      }
      if (bareUrls.length > 0 && absoluteMarkdown.length === 0) {
        return {
          score: 0,
          label: "bare-url" satisfies LinkQualityLabel,
          explanation: `${bareUrls.length} bare URL(s), no markdown links`,
        };
      }
      const offenders = absoluteUrls.filter(
        (url) => !allowedPrefixes.some((prefix) => url.startsWith(prefix))
      );
      if (offenders.length > 0) {
        return {
          score: 0,
          label: "wrong-prefix" satisfies LinkQualityLabel,
          explanation: `${offenders.length}/${absoluteUrls.length} urls outside allowed prefixes: ${offenders.slice(0, 3).join(", ")}`,
        };
      }
      return {
        score: 1,
        label: "valid" satisfies LinkQualityLabel,
        explanation: `absolute=${absoluteMarkdown.length} bare=${bareUrls.length} relative=${relativeMarkdown.length}`,
      };
    },
  });
}

export const linkQualityEvaluator = createLinkQualityEvaluator();
