/**
 * @generated SignedSource<<670b2a371d9f20caa03bfce66fe95741>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceHeaderTraceAnnotationsFragment$data = {
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectAnnotationMetricsConfigFragment">;
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
          "name": "ProjectAnnotationMetricsConfigFragment"
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

(node as any).hash = "09312f631f8a5254e6d717e7f19c66de";

export default node;
