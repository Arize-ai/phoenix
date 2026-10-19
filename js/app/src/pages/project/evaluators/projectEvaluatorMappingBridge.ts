import { useEffect, useEffectEvent } from "react";

/**
 * Lets the test bench reach the mapping dock without a shared provider: the
 * two sit in different panels of four different slideovers. A request either
 * focuses a variable's field, or writes a path into it and then focuses it;
 * a hover marks the variable's row in the dock while the bench points at it.
 *
 * PROTOTYPE: carried by window events while the inspector variants are being
 * compared. Whichever variant is kept should move this onto the evaluator
 * store, which both panels already read.
 */
export type MappingRequest =
  | { kind: "focus"; variable: string }
  | { kind: "assign"; variable: string; path: string }
  | { kind: "hover"; variable: string | null };

const MAPPING_REQUEST_EVENT = "phoenix:project-evaluator-mapping-request";

export function requestMapping(request: MappingRequest) {
  window.dispatchEvent(
    new CustomEvent<MappingRequest>(MAPPING_REQUEST_EVENT, { detail: request })
  );
}

export function useMappingRequests(
  onRequest: (request: MappingRequest) => void
) {
  const handle = useEffectEvent((event: Event) => {
    onRequest((event as CustomEvent<MappingRequest>).detail);
  });
  useEffect(() => {
    const listener = (event: Event) => handle(event);
    window.addEventListener(MAPPING_REQUEST_EVENT, listener);
    return () => window.removeEventListener(MAPPING_REQUEST_EVENT, listener);
  }, []);
}
