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
import { GenerativeUIPlaceholder } from "./GenerativeUIPlaceholder";
import { GenerativeUISkeleton } from "./GenerativeUISkeleton";
import { generativeUIRegistry, UnknownGenerativeElement } from "./registry";
import {
  getSpecAndState,
  isGenerativeUIPart,
  isPendingRenderGenerativeUIToolPart,
} from "./specParts";

export { JSON_RENDER_DATA_PART_TYPE, LEGACY_JSON_RENDER_DATA_PART_TYPE };
export { isGenerativeUIPart };

const generativeUICSS = css`
  margin-top: var(--global-dimension-size-200);
  margin-bottom: var(--global-dimension-size-200);
`;

export function GenerativeUI({ parts }: { parts: DataPart[] }) {
  return (
    <ErrorBoundary fallback={GenerativeUIErrorFallback}>
      <GenerativeUIRenderer parts={parts} />
    </ErrorBoundary>
  );
}

function GenerativeUIRenderer({ parts }: { parts: DataPart[] }) {
  const isPending = parts.some(isPendingRenderGenerativeUIToolPart);

  if (isPending) {
    return (
      <div css={generativeUICSS}>
        <GenerativeUISkeleton />
      </div>
    );
  }

  const { spec, state } = getSpecAndState(parts);

  return (
    <div css={generativeUICSS}>
      {spec ? (
        <StateProvider initialState={state}>
          <VisibilityProvider>
            <ActionProvider handlers={{}}>
              <Renderer
                spec={spec}
                registry={generativeUIRegistry}
                fallback={UnknownGenerativeElement}
              />
            </ActionProvider>
          </VisibilityProvider>
        </StateProvider>
      ) : (
        <GenerativeUIPlaceholder message="Generative UI was requested, but no renderable spec was found in the message parts." />
      )}
    </div>
  );
}

function GenerativeUIErrorFallback() {
  return (
    <div css={generativeUICSS}>
      <GenerativeUIPlaceholder message="Generative UI could not be rendered." />
    </div>
  );
}
