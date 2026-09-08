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
  getTypedKey,
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

/** The level below a name typed in full sits after the name's own. */
const TEMPLATE_CONTINUATION_SECTION_RANK = 2;

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
  const typedKey = getTypedKey({ textBeforeCursor: variable.text, cursor });
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
            levelPath: section.path,
            evaluationContext,
            closingBrackets,
            isBrowsing: cursor.partial === "",
            typedKey,
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
      levelPath: containerPath,
      evaluationContext,
      closingBrackets,
      isBrowsing: cursor.partial === "",
      writesWholePath: reached !== null,
      typedKey,
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
      // One of the evaluator's own inputs is a finished variable even when it
      // holds an object: `{{input}}` is the common case, and its members have
      // rows of their own.
      apply: applyTemplateInsertion(
        candidate.label,
        closingBrackets,
        candidate.isNested && isStringKeyedObject(candidate.value)
      ),
    })
  );
}

/**
 * One level's rows: its members, and — when the cursor sits at the end of a
 * member name typed in full that holds more — the level below that name too.
 * `attributes` is a variable in its own right, and `attributes.llm` is one the
 * author can go on to without first typing the dot.
 */
function toMemberOptions({
  members,
  levelPath,
  evaluationContext,
  closingBrackets,
  isBrowsing,
  writesWholePath = false,
  typedKey,
}: {
  members: EvaluatorPathMember[];
  /** The whole path of the level the members belong to. */
  levelPath: string;
  evaluationContext: MaterializedEvaluatorContext;
  closingBrackets: string;
  isBrowsing: boolean;
  /** Whether a row names the level from the root rather than from its parent. */
  writesWholePath?: boolean;
  /** The member name the cursor sits at the end of, if it was typed whole. */
  typedKey: string | null;
}): Completion[] {
  // A template reads nested properties with a dot, so a member a dot cannot
  // name — an index, a key with a dot of its own — is left out rather than
  // offered as a path that would render nothing. A whole path has to be
  // dotted the whole way down.
  const isAddressable = (member: EvaluatorPathMember) =>
    !member.isIndex &&
    BARE_IDENTIFIER_PATTERN.test(member.key) &&
    (!writesWholePath || !member.path.includes("["));
  const addressable = members.filter(isAddressable);
  const shown = capBrowsedMembers({ members: addressable, isBrowsing });
  const section = toMemberSection(levelPath, TEMPLATE_MEMBER_SECTION_RANK);
  const options = shown.map((member, index) =>
    toMemberOption({
      member,
      name: writesWholePath ? member.path : member.key,
      section,
      boost: 100 - index,
      evaluationContext,
      closingBrackets,
      // A name typed in full is already the variable; accepting it again ends
      // the variable rather than reopening what its row already shows.
      drills:
        isStringKeyedObject(member.value) &&
        (writesWholePath || member.key !== typedKey),
    })
  );
  const typed = addressable.find(
    (member) => member.key === typedKey && isStringKeyedObject(member.value)
  );
  if (typed !== undefined) {
    const below = toMemberSection(
      typed.path,
      TEMPLATE_CONTINUATION_SECTION_RANK
    );
    const continued = capBrowsedMembers({
      members: getEvaluatorPathMembers(typed.value, typed.path).filter(
        isAddressable
      ),
      isBrowsing: true,
    });
    continued.forEach((member, index) => {
      options.push(
        toMemberOption({
          member,
          name: writesWholePath ? member.path : `${typed.key}.${member.key}`,
          section: below,
          boost: 100 - index,
          evaluationContext,
          closingBrackets,
          drills: isStringKeyedObject(member.value),
        })
      );
    });
  }
  return options;
}

function toMemberOption({
  member,
  name,
  section,
  boost,
  evaluationContext,
  closingBrackets,
  drills,
}: {
  member: EvaluatorPathMember;
  name: string;
  section: CompletionSection;
  boost: number;
  evaluationContext: MaterializedEvaluatorContext;
  closingBrackets: string;
  drills: boolean;
}): Completion {
  const detail = toMemberDetail({ member, evaluationContext });
  return {
    label: name,
    type: toMemberCompletionType(member.value),
    ...(detail ? { detail } : {}),
    section,
    boost,
    apply: applyTemplateInsertion(name, closingBrackets, drills),
  };
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
 * The cursor stays at the end of the name, inside the braces, as it does in
 * any code editor: leaving is the author's act — Right, End, or typing the
 * braces over the ones already there — and a name that holds more reopens the
 * menu on itself. Braces already there are left in place rather than written
 * again, so the editor still knows it closed them and types over them.
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
    const closing = afterCursor === closingBrackets ? "" : closingBrackets;
    view.dispatch({
      changes: { from, to, insert: `${insertText}${closing}` },
      selection: { anchor: from + insertText.length },
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
