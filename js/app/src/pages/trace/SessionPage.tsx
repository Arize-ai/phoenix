import { Suspense } from "react";
import {
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";

import {
  Dialog,
  Drawer,
  ErrorBoundary,
  Flex,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Loading,
  TitleWithID,
} from "@phoenix/components";
import { DRAWER_DEFAULT_MIN_SIZE } from "@phoenix/components/core/overlay/constants";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import type { sessionLoaderQuery } from "@phoenix/pages/trace/__generated__/sessionLoaderQuery.graphql";
import { SessionDetailsPaginator } from "@phoenix/pages/trace/SessionDetailsPaginator";
import {
  sessionLoaderQueryNode,
  type SessionLoaderData,
} from "@phoenix/pages/trace/sessionLoader";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

import { SessionDetails } from "./SessionDetails";

/**
 * A component that shows the details of a session
 */
export function SessionPage() {
  const loaderData = useLoaderData<SessionLoaderData>();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { rootPath, tab } = useProjectRootPath();
  const parentSearch = clearSelectionScopedParams(location.search);
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "session-details",
  });

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
      defaultSize={defaultSize}
      minSize={DRAWER_DEFAULT_MIN_SIZE}
      onResize={onSizeChange}
    >
      <Dialog>
        {({ close }) => (
          <DialogContent>
            <DialogHeader>
              <Flex direction="row" gap="size-200" alignItems="center">
                <DialogCloseButton close={close} />
                <SessionDetailsPaginator currentId={sessionId} />
                <DialogTitle>
                  <Suspense
                    key={sessionId}
                    fallback={<TitleWithID title="Session" id="" />}
                  >
                    <SessionDrawerTitle queryRef={loaderData.queryRef} />
                  </Suspense>
                </DialogTitle>
              </Flex>
            </DialogHeader>
            <ErrorBoundary>
              {/* A new key shows the drawer-local fallback instead of retaining
                  the previous session during React Router's transition. */}
              <Suspense key={sessionId} fallback={<Loading />}>
                <SessionDetails sessionId={sessionId as string} />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}

function SessionDrawerTitle({
  queryRef,
}: {
  queryRef: SessionLoaderData["queryRef"];
}) {
  const data = useOwnedPreloadedQuery<sessionLoaderQuery>({
    query: sessionLoaderQueryNode,
    queryRef,
  });

  return <TitleWithID title="Session" id={data.session?.sessionId ?? ""} />;
}
