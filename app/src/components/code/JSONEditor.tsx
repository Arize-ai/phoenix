import React, { useEffect, useMemo, useRef, useState } from "react";
import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView, hoverTooltip } from "@codemirror/view";
import { githubLight } from "@uiw/codemirror-theme-github";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import {
  handleRefresh,
  jsonCompletion,
  jsonSchemaHover,
  jsonSchemaLinter,
  stateExtensions,
} from "codemirror-json-schema";
import { JSONSchema7 } from "json-schema";
import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts";

/**
 * The two variables below are used to initialize the JSON editor.
 * This is necessary because code mirror needs to calculate its dimensions to initialize properly.
 * When it is rendered outside of the viewport, the dimensions may not always be calculated correctly.
 * Below we use a combination of an intersection observer and a delay to ensure that the editor is initialized correctly.
 */
/**
 * The delay in milliseconds before initializing the JSON editor.
 * This is to ensure that the dom is ready before initializing the editor.
 */
const JSON_EDITOR_INITIALIZATION_DELAY = 1;
/**
 * The minimum height of the container for the JSON editor prior to initialization.
 * After initialization, the height will be set to auto and grow to fit the editor.
 */
const JSON_EDITOR_MIN_HEIGHT = "400px";

export type JSONEditorProps = Omit<
  ReactCodeMirrorProps,
  "theme" | "extensions" | "editable"
> & {
  /**
   * JSON Schema to use for validation, if provided will enable JSON Schema validation with tooltips in the editor
   */
  jsonSchema?: JSONSchema7;
};

export function JSONEditor(props: JSONEditorProps) {
  const { theme } = useTheme();
  const { jsonSchema, ...restProps } = props;
  const [isVisible, setIsVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const codeMirrorTheme = theme === "light" ? githubLight : nord;
  const extensions = useMemo(() => {
    const baseExtensions = [
      json(),
      EditorView.lineWrapping,
      linter(jsonParseLinter()),
    ];
    if (jsonSchema) {
      baseExtensions.push(
        linter(jsonSchemaLinter(), { needsRefresh: handleRefresh }),
        jsonLanguage.data.of({
          autocomplete: jsonCompletion(),
        }),
        hoverTooltip(jsonSchemaHover()),
        stateExtensions(jsonSchema)
      );
    }
    return baseExtensions;
  }, [jsonSchema]);

  /**
   * The two useEffect hooks below are used to initialize the JSON editor.
   * This is necessary because code mirror needs to calculate its dimensions to initialize properly.
   * When it is rendered outside of the viewport, the dimensions may not always be calculated correctly,
   * resulting in the editor being invisible or cut off when it is scrolled into view.
   * Below we use a combination of an intersection observer and a delay to ensure that the editor is initialized correctly.
   * For a related issue @see https://github.com/codemirror/dev/issues/1076
   */
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    const current = containerRef.current;

    return () => {
      if (current) {
        observer.unobserve(current);
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible && !isInitialized) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setIsInitialized(true);
      }, JSON_EDITOR_INITIALIZATION_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, isVisible]);

  return (
    <div
      ref={containerRef}
      css={css`
        min-height: ${!isInitialized ? JSON_EDITOR_MIN_HEIGHT : "auto"};
      `}
    >
      <CodeMirror
        value={props.value}
        extensions={extensions}
        editable
        theme={codeMirrorTheme}
        {...restProps}
      />
    </div>
  );
}
