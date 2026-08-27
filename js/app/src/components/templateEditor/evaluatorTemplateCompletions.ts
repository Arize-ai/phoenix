import type {
  Completion,
  CompletionResult,
  CompletionSection,
} from "@codemirror/autocomplete";
import type { EditorView } from "@uiw/react-codemirror";

import type { MaterializedEvaluatorContext } from "@phoenix/components/evaluators/evaluatorContext";
import {
  buildEvaluatorContextCandidates,
  getEvaluatorContextMembers,
  HINT_COMPLETION_TYPE,
  toMemberDetail,
} from "@phoenix/components/evaluators/evaluatorContextCompletions";
import type { EvaluatorPathMember } from "@phoenix/components/evaluators/evaluatorPathCompletions";
import {
  capBrowsedMembers,
  EVALUATOR_ROOT_PATH_PATTERN,
  getEvaluatorPathCursor,
  getEvaluatorPathMembers,
  resolveEvaluatorPath,
  toMemberSection,
} from "@phoenix/components/evaluators/evaluatorPathCompletions";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { BARE_IDENTIFIER_PATTERN } from "@phoenix/utils/jsonUtils";

import { TemplateFormats } from "./constants";
import type { TemplateFormat } from "./types";

/** The repeat and empty-case wrappers a Mustache template can open. */
const BLOCK_SECTION: CompletionSection = { name: "Blocks", rank: 3 };

/** A drill level leads the menu it opened; blocks follow it. */
const TEMPLATE_MEMBER_SECTION_RANK = 1;

/** What the typeahead keeps matching against as the member name grows. */
const MEMBER_NAME_PATTERN = /^\w*$/;

/**
 * The menu shown inside a template variable while a project evaluator is being
 * authored: what the evaluator receives, what the record supplies, and the
 * level below whichever of them the cursor has drilled into.
 *
 * @param params - completion inputs
 * @param params.evaluationContext - the evaluator's materialized inputs
 * @param params.templateFormat - the format the template is written in
 * @param params.variable - the open template variable the cursor sits in
 * @param params.sectionStack - Mustache sections the cursor is nested inside
 */
export function getEvaluatorTemplateCompletions({
  evaluationContext,
  templateFormat,
  variable,
  sectionStack,
}: {
  evaluationContext: MaterializedEvaluatorContext;
  templateFormat: TemplateFormat;
  variable: { from: number; text: string };
  sectionStack: string[];
}): CompletionResult | null {
  const closingBrackets =
    templateFormat === TemplateFormats.Mustache ? "}}" : "}";

  // An f-string has no member syntax at all, so a typed dot leaves the menu
  // with nothing honest to offer.
  if (templateFormat !== TemplateFormats.Mustache) {
    return variable.text.includes(".") || variable.text.includes("[")
      ? null
      : toResult({
          from: variable.from,
          options: getRootOptions({
            evaluationContext,
            closingBrackets,
            templateFormat,
          }),
          validFor: MEMBER_NAME_PATTERN,
        });
  }

  if (variable.text.startsWith("#") || variable.text.startsWith("^")) {
    return getBlockCompletions({ evaluationContext, variable });
  }

  const cursor = getEvaluatorPathCursor(variable.text);
  if (cursor === null) {
    return null;
  }
  const from = variable.from + cursor.from;
  const section = getSectionItem({ evaluationContext, sectionStack });

  if (cursor.containerPath === "") {
    // Inside a section the names are the item's own — `messages[0].role`
    // reads as `role` while the block repeats it.
    return section === null
      ? toResult({
          from,
          options: getRootOptions({
            evaluationContext,
            closingBrackets,
            templateFormat,
          }),
          validFor: EVALUATOR_ROOT_PATH_PATTERN,
        })
      : toResult({
          from,
          options: toMemberOptions({
            members: getEvaluatorPathMembers(section.item, ""),
            evaluationContext,
            section: toMemberSection(
              section.path,
              TEMPLATE_MEMBER_SECTION_RANK
            ),
            closingBrackets,
            isBrowsing: cursor.partial === "",
          }),
          validFor: MEMBER_NAME_PATTERN,
        });
  }

  const members = getEvaluatorContextMembers({
    // Inside a section the path is read against the item the block repeats
    // over, not against the evaluator's own values.
    source: section === null ? evaluationContext.values : section.item,
    containerPath: cursor.containerPath,
  });
  return toResult({
    from,
    options: toMemberOptions({
      members,
      evaluationContext,
      section: toMemberSection(
        cursor.containerPath,
        TEMPLATE_MEMBER_SECTION_RANK
      ),
      closingBrackets,
      isBrowsing: cursor.partial === "",
    }),
    validFor: MEMBER_NAME_PATTERN,
  });
}

function toResult({
  from,
  options,
  validFor,
}: {
  from: number;
  options: Completion[];
  validFor: RegExp;
}): CompletionResult | null {
  return options.length === 0 ? null : { from, options, validFor };
}

/**
 * The shared candidate tree, written the way a template variable names things.
 *
 * An f-string keeps `{metadata.latency_ms}` as one literal schema property
 * rather than reducing it to `metadata`, so a dotted insert would declare a
 * variable nothing supplies; only the names the evaluator receives are honest
 * there. Mustache reads a dotted path, so it takes the whole tree.
 */
function getRootOptions({
  evaluationContext,
  closingBrackets,
  templateFormat,
}: {
  evaluationContext: MaterializedEvaluatorContext;
  closingBrackets: string;
  templateFormat: TemplateFormat;
}): Completion[] {
  const candidates = buildEvaluatorContextCandidates(evaluationContext);
  const addressable =
    templateFormat === TemplateFormats.Mustache
      ? candidates
      : candidates.filter((candidate) => !candidate.isNested);
  return addressable.map((candidate) => ({
    label: candidate.label,
    type: candidate.type,
    ...(candidate.detail ? { detail: candidate.detail } : {}),
    info: candidate.info,
    section: candidate.section,
    boost: candidate.boost,
    apply: applyTemplateInsertion(candidate.label, closingBrackets),
  }));
}

function toMemberOptions({
  members,
  evaluationContext,
  section,
  closingBrackets,
  isBrowsing,
}: {
  members: EvaluatorPathMember[];
  evaluationContext: MaterializedEvaluatorContext;
  section: CompletionSection;
  closingBrackets: string;
  isBrowsing: boolean;
}): Completion[] {
  // Mustache reads nested properties with a dot and has no subscript syntax,
  // so a member it cannot name is left out rather than offered as a path that
  // would render nothing.
  const addressable = members.filter(
    (member) => !member.isIndex && BARE_IDENTIFIER_PATTERN.test(member.key)
  );
  const shown = capBrowsedMembers({ members: addressable, isBrowsing });
  return shown.map((member, index) => {
    const detail = toMemberDetail({ member, evaluationContext });
    return {
      label: member.key,
      type: "variable",
      ...(detail ? { detail } : {}),
      section,
      boost: 100 - index,
      apply: applyTemplateInsertion(member.key, closingBrackets),
    };
  });
}

function getBlockCompletions({
  evaluationContext,
  variable,
}: {
  evaluationContext: MaterializedEvaluatorContext;
  variable: { from: number; text: string };
}): CompletionResult | null {
  const blockPrefix = variable.text[0];
  const cursor = getEvaluatorPathCursor(variable.text.slice(1));
  if (cursor === null) {
    return null;
  }

  const options: Completion[] = [];
  if (cursor.containerPath === "") {
    for (const [name, value] of Object.entries(evaluationContext.values)) {
      if (Array.isArray(value)) {
        options.push(
          toBlockCompletion({
            path: name,
            blockPrefix,
            detail: toBlockDetail({ blockPrefix, value }),
          })
        );
      }
    }
  } else {
    for (const member of getEvaluatorContextMembers({
      source: evaluationContext.values,
      containerPath: cursor.containerPath,
    })) {
      // Mustache names a block with a dotted path or not at all.
      if (
        Array.isArray(member.value) &&
        !member.isIndex &&
        !member.path.includes("[")
      ) {
        options.push(
          toBlockCompletion({
            path: member.path,
            blockPrefix,
            detail: toBlockDetail({ blockPrefix, value: member.value }),
          })
        );
      }
    }
  }

  // The typed `#`/`^` is part of what the row replaces, so the menu matches
  // from the brace rather than from the name.
  return options.length === 0
    ? null
    : { from: variable.from, options, validFor: /^[#^][\w.]*$/ };
}

function toBlockCompletion({
  path,
  blockPrefix,
  detail,
}: {
  path: string;
  blockPrefix: string;
  detail: string;
}): Completion {
  return {
    label: `${blockPrefix}${path}`,
    type: HINT_COMPLETION_TYPE,
    detail,
    section: BLOCK_SECTION,
    info:
      blockPrefix === "#"
        ? `Repeats for each item in ${path}.`
        : `Renders when ${path} is empty.`,
    apply: applyBlockInsertion(path, blockPrefix),
  };
}

function toBlockDetail({
  blockPrefix,
  value,
}: {
  blockPrefix: string;
  value: unknown[];
}): string {
  return blockPrefix === "#" ? `${value.length} items` : "if empty";
}

/** The item a section repeats over, when the cursor is inside one. */
function getSectionItem({
  evaluationContext,
  sectionStack,
}: {
  evaluationContext: MaterializedEvaluatorContext;
  sectionStack: string[];
}): { path: string; item: Record<string, unknown> } | null {
  const sectionPath = sectionStack[sectionStack.length - 1];
  if (sectionPath === undefined) {
    return null;
  }
  const resolution = resolveEvaluatorPath({
    source: evaluationContext.values,
    path: sectionPath,
  });
  if (resolution.status !== "resolved") {
    return null;
  }
  const item = Array.isArray(resolution.value)
    ? resolution.value[0]
    : resolution.value;
  return isStringKeyedObject(item) ? { path: sectionPath, item } : null;
}

/** Writes a name into the variable, closing it if the braces are not there. */
function applyTemplateInsertion(insertText: string, closingBrackets: string) {
  return (
    view: EditorView,
    _completion: Completion,
    from: number,
    to: number
  ) => {
    const afterCursor = view.state.doc.sliceString(
      to,
      Math.min(to + closingBrackets.length, view.state.doc.length)
    );
    const actualTo =
      afterCursor === closingBrackets ? to + closingBrackets.length : to;
    const insertion = `${insertText}${closingBrackets}`;
    view.dispatch({
      changes: { from, to: actualTo, insert: insertion },
      selection: { anchor: from + insertion.length },
    });
  };
}

/** Writes the whole block, leaving the cursor between its tags. */
function applyBlockInsertion(path: string, blockPrefix: string) {
  return (
    view: EditorView,
    _completion: Completion,
    from: number,
    to: number
  ) => {
    const afterCursor = view.state.doc.sliceString(
      to,
      Math.min(to + 2, view.state.doc.length)
    );
    const actualTo = afterCursor === "}}" ? to + 2 : to;
    const openTag = `${blockPrefix}${path}`;
    const insertion = `${openTag}}}{{/${path}}}`;
    view.dispatch({
      changes: { from, to: actualTo, insert: insertion },
      selection: { anchor: from + openTag.length + 2 },
    });
  };
}
