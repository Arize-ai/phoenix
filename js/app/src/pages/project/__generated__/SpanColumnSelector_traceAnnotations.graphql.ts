/**
 * @generated SignedSource<<5901879242335ed7286a4c9b6b5f5f65>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanColumnSelector_traceAnnotations$data = {
  readonly traceAnnotationNames: ReadonlyArray<string>;
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
      "name": "traceAnnotationNames",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "dc497803ac9cee98e605851ab1a8a004";

export default node;
