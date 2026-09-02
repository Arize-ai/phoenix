import type {
  Completion,
  CompletionResult,
  CompletionSection,
} from "@codemirror/autocomplete";
import { startCompletion } from "@codemirror/autocomplete";
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
  reachEvaluatorContainerPath,
  resolveEvaluatorPath,
  toMemberCompletionType,
  toMemberSection,
  toWholePathValidFor,
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

  if (
    templateFormat === TemplateFormats.Mustache &&
    (variable.text.startsWith("#") || variable.text.startsWith("^"))
  ) {
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
      ? toRootResult({
          from,
          options: getRootOptions({ evaluationContext, closingBrackets }),
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

  // Inside a section the path is read against the item the block repeats
  // over, not against the evaluator's own values.
  const source = section === null ? evaluationContext.values : section.item;
  // A section's names are the item's own, so nothing there has a home under
  // `metadata` to be read back into.
  const reached =
    section === null
      ? reachEvaluatorContainerPath({
          source,
          containerPath: cursor.containerPath,
          rootPaths: buildEvaluatorContextCandidates(evaluationContext).map(
            (candidate) => candidate.label
          ),
        })
      : null;
  const containerPath = reached ?? cursor.containerPath;
  // A list has no member a dot can name — Mustache reaches its items with a
  // block — so the dot after one offers the block instead of nothing.
  const container = resolveEvaluatorPath({ source, path: containerPath });
  if (container.status === "resolved" && Array.isArray(container.value)) {
    return templateFormat === TemplateFormats.Mustache
      ? toBlockResult({
          from: variable.from,
          path: containerPath,
          value: container.value,
        })
      : null;
  }
  const members = getEvaluatorContextMembers({ source, containerPath });
  return toResult({
    // A row that fills the home back in writes the whole path, so it replaces
    // what the author wrote rather than extending it.
    from: reached === null ? from : variable.from,
    options: toMemberOptions({
      members,
      evaluationContext,
      section: toMemberSection(containerPath, TEMPLATE_MEMBER_SECTION_RANK),
      closingBrackets,
      isBrowsing: cursor.partial === "",
      writesWholePath: reached !== null,
    }),
    // A whole-path row is matched against the whole path, which the written
    // name and its dot sit inside; a second dot leaves that level.
    validFor:
      reached === null ? MEMBER_NAME_PATTERN : EVALUATOR_ROOT_PATH_PATTERN,
  });
}

/** The top level's menu, which stays open only while a dot still leads into it. */
function toRootResult({
  from,
  options,
}: {
  from: number;
  options: Completion[];
}): CompletionResult | null {
  return toResult({
    from,
    options,
    validFor: toWholePathValidFor({
      pattern: EVALUATOR_ROOT_PATH_PATTERN,
      labels: options.map((option) => option.label),
    }),
  });
}

function toResult({
  from,
  options,
  validFor,
}: {
  from: number;
  options: Completion[];
  validFor: CompletionResult["validFor"];
}): CompletionResult | null {
  return options.length === 0 ? null : { from, options, validFor };
}

/**
 * The shared candidate tree, written the way a template variable names things.
 * Both formats read a dotted path by its root, so both take the whole tree.
 */
function getRootOptions({
  evaluationContext,
  closingBrackets,
}: {
  evaluationContext: MaterializedEvaluatorContext;
  closingBrackets: string;
}): Completion[] {
  return buildEvaluatorContextCandidates(evaluationContext).map(
    (candidate) => ({
      label: candidate.label,
      type: candidate.type,
      ...(candidate.detail ? { detail: candidate.detail } : {}),
      ...(candidate.info ? { info: candidate.info } : {}),
      section: candidate.section,
      boost: candidate.boost,
      // One of the evaluator's own inputs is accepted whole even when it holds
      // an object: `{{input}}` is the common case, and its members have rows of
      // their own.
      apply: applyTemplateInsertion(
        candidate.label,
        closingBrackets,
        candidate.isNested && isStringKeyedObject(candidate.value)
      ),
    })
  );
}

function toMemberOptions({
  members,
  evaluationContext,
  section,
  closingBrackets,
  isBrowsing,
  writesWholePath = false,
}: {
  members: EvaluatorPathMember[];
  evaluationContext: MaterializedEvaluatorContext;
  section: CompletionSection;
  closingBrackets: string;
  isBrowsing: boolean;
  /** Whether a row names the level from the root rather than from its parent. */
  writesWholePath?: boolean;
}): Completion[] {
  // A template reads nested properties with a dot, so a member a dot cannot
  // name — an index, a key with a dot of its own — is left out rather than
  // offered as a path that would render nothing. A whole path has to be
  // dotted the whole way down.
  const addressable = members.filter(
    (member) =>
      !member.isIndex &&
      BARE_IDENTIFIER_PATTERN.test(member.key) &&
      (!writesWholePath || !member.path.includes("["))
  );
  const shown = capBrowsedMembers({ members: addressable, isBrowsing });
  return shown.map((member, index) => {
    const detail = toMemberDetail({ member, evaluationContext });
    const name = writesWholePath ? member.path : member.key;
    return {
      label: name,
      type: toMemberCompletionType(member.value),
      ...(detail ? { detail } : {}),
      section,
      boost: 100 - index,
      apply: applyTemplateInsertion(
        name,
        closingBrackets,
        isStringKeyedObject(member.value)
      ),
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
    // The same tree the variable menu offers, kept to what a block can wrap.
    for (const candidate of buildEvaluatorContextCandidates(
      evaluationContext
    )) {
      if (Array.isArray(candidate.value)) {
        options.push(
          toBlockCompletion({
            path: candidate.label,
            blockPrefix,
            detail: toBlockDetail({ blockPrefix, value: candidate.value }),
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

/** Both wrappers for one list, replacing whatever the author dotted into it. */
function toBlockResult({
  from,
  path,
  value,
}: {
  from: number;
  path: string;
  value: unknown[];
}): CompletionResult {
  return {
    from,
    options: ["#", "^"].map((blockPrefix) =>
      toBlockCompletion({
        path,
        blockPrefix,
        detail: toBlockDetail({ blockPrefix, value }),
      })
    ),
    // The typed path ends in a dot the labels do not carry, so the rows are
    // shown as they are rather than matched against it.
    filter: false,
    validFor: /^[\w.]*$/,
  };
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

/**
 * Writes a name into the variable, closing it if the braces are not there.
 *
 * A nested object is not a finished variable: the cursor stays inside after a
 * dot and the level below opens. A leaf is accepted whole, with the cursor past
 * the braces where the prose continues.
 */
function applyTemplateInsertion(
  insertText: string,
  closingBrackets: string,
  drills = false
) {
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
    const name = drills ? `${insertText}.` : insertText;
    view.dispatch({
      changes: { from, to: actualTo, insert: `${name}${closingBrackets}` },
      selection: {
        anchor: from + name.length + (drills ? 0 : closingBrackets.length),
      },
    });
    if (drills) {
      startCompletion(view);
    }
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
