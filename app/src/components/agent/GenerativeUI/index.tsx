import { css } from "@emotion/react";
import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
  type DataPart,
} from "@json-render/react";

import { ErrorBoundary } from "@phoenix/components/exception";

import {
  JSON_RENDER_DATA_PART_TYPE,
  LEGACY_JSON_RENDER_DATA_PART_TYPE,
} from "../generativeUICatalog";
import { GeneratedUIPlaceholder } from "./GeneratedUIPlaceholder";
import { generativeUIRegistry, UnknownGeneratedElement } from "./registry";
import { getSpecAndState, isGenerativeUIPart } from "./specParts";

export { JSON_RENDER_DATA_PART_TYPE, LEGACY_JSON_RENDER_DATA_PART_TYPE };
export { isGenerativeUIPart };

const generatedUICSS = css`
  margin-top: var(--global-dimension-size-200);
`;

export function GenerativeUI({ parts }: { parts: DataPart[] }) {
  return (
    <ErrorBoundary fallback={GeneratedUIErrorFallback}>
      <GenerativeUIRenderer parts={parts} />
    </ErrorBoundary>
  );
}

function GenerativeUIRenderer({ parts }: { parts: DataPart[] }) {
  const { spec, state } = getSpecAndState(parts);

  return (
    <div css={generatedUICSS}>
      {spec ? (
        <StateProvider initialState={state}>
          <VisibilityProvider>
            <ActionProvider handlers={{}}>
              <Renderer
                spec={spec}
                registry={generativeUIRegistry}
                fallback={UnknownGeneratedElement}
              />
            </ActionProvider>
          </VisibilityProvider>
        </StateProvider>
      ) : (
        <GeneratedUIPlaceholder message="Generated UI was requested, but no renderable spec was found in the message parts." />
      )}
    </div>
  );
}

function GeneratedUIErrorFallback() {
  return (
    <div css={generatedUICSS}>
      <GeneratedUIPlaceholder message="Generated UI could not be rendered." />
    </div>
  );
}
