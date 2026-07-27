import { css } from "@emotion/react";
import { Suspense } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import { Dialog, Drawer, Loading } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
} from "@phoenix/components/core/dialog";
import { ShareLinkButton } from "@phoenix/components/ShareLinkButton";
import {
  TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS,
  TRACE_TREE_HOVER_WIDTH_PIXELS,
  TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS,
} from "@phoenix/constants";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { TraceDetailsPaginator } from "@phoenix/pages/trace/TraceDetailsPaginator";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

import { TraceDetails } from "./TraceDetails";
import { useDetailsPanelSizing } from "./useDetailsPanelSizing";

const TRACE_PAGE_HEADER_TWO_ROW_BREAKPOINT_PIXELS = 200;

const tracePageHeaderCSS = css`
  box-sizing: border-box;
  display: grid;
  grid-template-areas: "close pagination share";
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: var(--global-dimension-size-200);
  width: 100%;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  flex: none;

  .trace-page-header__close-button {
    grid-area: close;
  }

  .trace-page-header__pagination {
    grid-area: pagination;
  }

  .trace-page-header__share-button {
    grid-area: share;
    justify-self: end;
  }

  @container trace-tree-panel (width < ${TRACE_TREE_HOVER_WIDTH_PIXELS}px) {
    .trace-page-header__share-button .share-link-button {
      width: var(--global-button-height-s);
      padding: 0;
      gap: 0;
    }

    .trace-page-header__share-button .share-link-button__label {
      display: none;
    }
  }

  @container trace-tree-panel (width < ${TRACE_PAGE_HEADER_TWO_ROW_BREAKPOINT_PIXELS}px) {
    grid-template-areas: "close share";
    grid-template-columns: 1fr 1fr;
    gap: var(--global-dimension-size-100);

    &:has(.trace-page-header__pagination) {
      grid-template-areas:
        "close share"
        "pagination pagination";
    }

    .trace-page-header__close-button {
      justify-self: start;
    }

    .trace-page-header__pagination {
      justify-self: center;
    }
  }

  @container trace-tree-panel (width < ${TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS}px) {
    grid-template-areas:
      "close"
      "share";
    grid-template-columns: 1fr;
    justify-items: start;
    padding-inline: var(--global-dimension-size-100);

    &:has(.trace-page-header__pagination) {
      grid-template-areas:
        "close"
        "share"
        "pagination";
    }

    .trace-page-header__close-button,
    .trace-page-header__share-button,
    .trace-page-header__pagination {
      justify-self: start;
    }

    .trace-page-header__pagination,
    .trace-details-paginator__buttons {
      flex-direction: column;
    }
  }
`;

/**
 * A component that shows the details of a trace (e.g. a collection of spans)
 */
export function TracePage({
  defaultToTrace = false,
}: {
  defaultToTrace?: boolean;
}) {
  const { traceId, projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { rootPath, tab } = useProjectRootPath();
  const selectedSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);
  const parentSearch = clearSelectionScopedParams(searchParams);
  const {
    defaultDrawerSize,
    onDrawerResize,
    onDrawerSizeChange,
    onPreferredTreeWidthChange,
    preferredTreeWidth,
  } = useDetailsPanelSizing();
  if (traceId == null || projectId == null) {
    throw new Error("Trace and project IDs are required");
  }

  // if we are focused on a particular span, use that as the subjectId
  // otherwise, use the traceId
  const paginationSubjectId = selectedSpanNodeId || traceId;

  return (
    <Drawer
      isOpen
      onClose={() =>
        navigate({
          pathname: `${rootPath}/${tab}`,
          search: parentSearch,
          hash: location.hash,
        })
      }
      defaultSize={defaultDrawerSize}
      minSize={TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS}
      onResize={onDrawerResize}
      onResizeEnd={onDrawerSizeChange}
    >
      <Dialog aria-label="Trace details">
        {({ close }) => (
          <DialogContent>
            <Suspense fallback={<Loading />}>
              <TraceDetails
                defaultToTrace={defaultToTrace}
                traceId={traceId}
                projectId={projectId}
                preferredTreeWidth={preferredTreeWidth}
                onPreferredTreeWidthChange={onPreferredTreeWidthChange}
                treeHeader={
                  <div className="trace-page-header" css={tracePageHeaderCSS}>
                    <DialogCloseButton
                      className="trace-page-header__close-button"
                      close={close}
                    />
                    <TraceDetailsPaginator
                      className="trace-page-header__pagination"
                      currentId={paginationSubjectId}
                    />
                    <div className="trace-page-header__share-button">
                      <ShareLinkButton
                        preserveSearchParams
                        buttonText="Share"
                        tooltipText="Copy trace link to clipboard"
                        successText="Trace link copied to clipboard"
                      />
                    </div>
                  </div>
                }
              />
            </Suspense>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
