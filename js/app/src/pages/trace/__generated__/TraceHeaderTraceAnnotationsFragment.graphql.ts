/**
 * @generated SignedSource<<689c036a72e1da23cbfd3b5214c32d3c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceHeaderTraceAnnotationsFragment$data = {
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectAnnotationConfigFragment">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"TraceAnnotationSummaryGroup">;
  readonly " $fragmentType": "TraceHeaderTraceAnnotationsFragment";
};
export type TraceHeaderTraceAnnotationsFragment$key = {
  readonly " $data"?: TraceHeaderTraceAnnotationsFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"TraceHeaderTraceAnnotationsFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TraceHeaderTraceAnnotationsFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Project",
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": [
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "ProjectAnnotationConfigFragment"
        }
      ],
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "TraceAnnotationSummaryGroup"
    }
  ],
  "type": "Trace",
  "abstractKey": null
};

(node as any).hash = "d95c0e4dc286aa9ea76fca425b5253da";

export default node;
