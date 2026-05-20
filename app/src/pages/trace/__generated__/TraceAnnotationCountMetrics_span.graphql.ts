/**
 * @generated SignedSource<<ab0bffbbe6172c5ec518b71337287098>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceAnnotationCountMetrics_span$data = {
  readonly spanAnnotations: ReadonlyArray<{
    readonly name: string;
  }>;
  readonly trace: {
    readonly traceAnnotations: ReadonlyArray<{
      readonly name: string;
    }>;
  };
  readonly " $fragmentType": "TraceAnnotationCountMetrics_span";
};
export type TraceAnnotationCountMetrics_span$key = {
  readonly " $data"?: TraceAnnotationCountMetrics_span$data;
  readonly " $fragmentSpreads": FragmentRefs<"TraceAnnotationCountMetrics_span">;
};

const node: ReaderFragment = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TraceAnnotationCountMetrics_span",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanAnnotation",
      "kind": "LinkedField",
      "name": "spanAnnotations",
      "plural": true,
      "selections": (v0/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Trace",
      "kind": "LinkedField",
      "name": "trace",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "TraceAnnotation",
          "kind": "LinkedField",
          "name": "traceAnnotations",
          "plural": true,
          "selections": (v0/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};
})();

(node as any).hash = "4e611e5f50b9513134a36e46eb292b60";

export default node;
