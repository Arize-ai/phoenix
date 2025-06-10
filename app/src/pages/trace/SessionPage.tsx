import { useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Dialog, ErrorBoundary } from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/dialog";
import { sessionLoader } from "@phoenix/pages/trace/sessionLoader";

import { SessionDetails } from "./SessionDetails";

/**
 * A component that shows the details of a session
 */
export function SessionPage() {
  const loaderData = useLoaderData<typeof sessionLoader>();
  invariant(loaderData, "loaderData is required");
  const { sessionId } = useParams();
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Session ID: {loaderData.session?.sessionId ?? "--"}
          </DialogTitle>
        </DialogHeader>
        <ErrorBoundary>
          <SessionDetails sessionId={sessionId as string} />
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
