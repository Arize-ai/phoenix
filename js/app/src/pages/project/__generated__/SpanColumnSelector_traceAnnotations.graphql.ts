/**
 * @generated SignedSource<<c5b5bd24a7f2f781c5f09e7e599fce3e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanColumnSelector_traceAnnotations$data = {
  readonly traceAnnotationsNames: ReadonlyArray<string>;
  readonly " $fragmentType": "SpanColumnSelector_traceAnnotations";
};
export type SpanColumnSelector_traceAnnotations$key = {
  readonly " $data"?: SpanColumnSelector_traceAnnotations$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanColumnSelector_traceAnnotations">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SpanColumnSelector_traceAnnotations",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceAnnotationsNames",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "a117170f08dccc92d4dfd1180d8dbb62";

export default node;
