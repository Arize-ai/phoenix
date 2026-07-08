import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import { css } from "@emotion/react";
import type { EditorView } from "@uiw/react-codemirror";
import CodeMirror, {
  type BasicSetupOptions,
  keymap,
} from "@uiw/react-codemirror";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Flex,
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { pierreDark, pierreLight } from "@phoenix/components/code";
import { useTheme } from "@phoenix/contexts";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { useSessionFilters } from "./SessionFiltersContext";
import { validateSessionFilterCondition } from "./sessionFilterValidation";

const codeMirrorCSS = css`
  flex: 1 1 auto;
  .cm-content {
    padding: var(--global-dimension-static-size-100) 0;
  }
  .cm-editor {
    background-color: transparent !important;
  }
  .cm-focused {
    outline: none;
  }
  .cm-selectionLayer .cm-selectionBackground {
    background: var(--global-color-cyan-400) !important;
  }
`;

const fieldCSS = css`
  border-width: var(--global-border-size-thin);
  border-style: solid;
  border-color: var(--global-input-field-border-color);
  border-radius: var(--global-rounding-small);
  background-color: var(--global-input-field-background-color);
  transition: all 0.2s ease-in-out;
  overflow-x: hidden;
  box-sizing: border-box;
  &:hover,
  &[data-is-focused="true"] {
    border-color: var(--global-input-field-border-color-active);
  }
  &[data-is-invalid="true"] {
    border-color: var(--global-color-danger);
  }
  .search-icon {
    margin-left: var(--global-dimension-static-size-100);
  }
`;

const basicSetupOptions: BasicSetupOptions = {
  lineNumbers: false,
  foldGutter: false,
  bracketMatching: true,
  syntaxHighlighting: true,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  defaultKeymap: false,
  searchKeymap: false,
};

type SessionFilterVocabularyTerm = {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly category: string;
};

function getCompletionOption(term: SessionFilterVocabularyTerm): Completion {
  return {
    label: term.name,
    type: term.type,
    detail: term.category,
    info: term.description,
  };
}

function getSessionFilterConditionCompletions(
  vocabulary: readonly SessionFilterVocabularyTerm[]
) {
  return function sessionFilterConditionCompletions(
    context: CompletionContext
  ): CompletionResult | null {
    const word = context.matchBefore(/[A-Za-z0-9_.'"[\]-]*/);
    if (!word) return null;

    if (word.from === word.to && !context.explicit) return null;

    return {
      from: word.from,
      options: vocabulary.map(getCompletionOption),
    };
  };
}

function getExtensions(vocabulary: readonly SessionFilterVocabularyTerm[]) {
  return [
    keymap.of([
      {
        key: "Enter",
        run: (_editorView: EditorView) => {
          return true;
        },
      },
    ]),
    python(),
    autocompletion({
      override: [getSessionFilterConditionCompletions(vocabulary)],
    }),
  ];
}

type SessionFilterConditionFieldProps = {
  onValidCondition: (condition: string) => void;
  vocabulary: readonly SessionFilterVocabularyTerm[];
  placeholder?: string;
};

export function SessionFilterConditionField(
  props: SessionFilterConditionFieldProps
) {
  const {
    onValidCondition,
    vocabulary,
    placeholder = "Filter sessions by condition",
  } = props;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { filterCondition, setFilterCondition } = useSessionFilters();
  const deferredFilterCondition = useDeferredValue(filterCondition);
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  const projectId = useTracingContext((state) => state.projectId);
  const filterConditionFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;

    void validateSessionFilterCondition(
      deferredFilterCondition,
      projectId
    ).then(
      (result) => {
        if (isCancelled) {
          return;
        }
        if (!result?.isValid) {
          setErrorMessage(result?.errorMessage ?? "Invalid filter condition");
          return;
        }
        setErrorMessage("");
        startTransition(() => {
          onValidCondition(
            deferredFilterCondition.trim() ? deferredFilterCondition : ""
          );
        });
      },
      (error: unknown) => {
        if (isCancelled) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to validate filter condition"
        );
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [onValidCondition, deferredFilterCondition, projectId]);

  const hasError = errorMessage !== "";
  const hasCondition = filterCondition !== "";
  return (
    <div
      data-is-focused={isFocused}
      data-is-invalid={hasError}
      className="session-filter-condition-field"
      css={fieldCSS}
      ref={filterConditionFieldRef}
    >
      <Flex direction="row" alignItems="center">
        <Icon svg={<Icons.Search />} className="search-icon" />
        <CodeMirror
          aria-label="Session filter condition"
          css={codeMirrorCSS}
          indentWithTab={false}
          basicSetup={basicSetupOptions}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={filterCondition}
          onChange={setFilterCondition}
          height="36px"
          width="100%"
          theme={codeMirrorTheme}
          placeholder={placeholder}
          extensions={getExtensions(vocabulary)}
        />
        <button
          aria-label="Clear session filter condition"
          css={css`
            margin-right: var(--global-dimension-static-size-100);
            color: var(--global-text-color-700);
            visibility: ${hasCondition ? "visible" : "hidden"};
          `}
          onClick={() => setFilterCondition("")}
          className="button--reset"
        >
          <Icon svg={<Icons.CloseCircle />} />
        </button>
      </Flex>
      <TooltipTrigger isOpen={hasError && isFocused}>
        <Tooltip placement="bottom" triggerRef={filterConditionFieldRef}>
          <Text color="danger">{errorMessage}</Text>
        </Tooltip>
      </TooltipTrigger>
    </div>
  );
}
