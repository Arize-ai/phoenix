/**
 * @generated SignedSource<<95e6ad9063900c57221b9666c7340f52>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanAsideAnnotationList_span$data = {
  readonly project: {
    readonly annotationConfigs: {
      readonly configs: ReadonlyArray<{
        readonly config: {
          readonly id?: string;
          readonly name?: string;
        };
      }>;
    };
    readonly id: string;
  };
  readonly spanAnnotations: ReadonlyArray<{
    readonly id: string;
  }>;
  readonly trace: {
    readonly id: string;
    readonly traceAnnotations: ReadonlyArray<{
      readonly id: string;
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup">;
  readonly " $fragmentType": "SpanAsideAnnotationList_span";
};
export type SpanAsideAnnotationList_span$key = {
  readonly " $data"?: SpanAsideAnnotationList_span$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanAsideAnnotationList_span">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = [
  (v0/*: any*/)
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SpanAsideAnnotationList_span",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Project",
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": [
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "AnnotationConfigConnection",
          "kind": "LinkedField",
          "name": "annotationConfigs",
          "plural": false,
          "selections": [
            {
              "alias": "configs",
              "args": null,
              "concreteType": "AnnotationConfigEdge",
              "kind": "LinkedField",
              "name": "edges",
              "plural": true,
              "selections": [
                {
                  "alias": "config",
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "node",
                  "plural": false,
                  "selections": [
                    {
                      "kind": "InlineFragment",
                      "selections": (v1/*: any*/),
                      "type": "Node",
                      "abstractKey": "__isNode"
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "name",
                          "storageKey": null
                        }
                      ],
                      "type": "AnnotationConfigBase",
                      "abstractKey": "__isAnnotationConfigBase"
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanAnnotation",
      "kind": "LinkedField",
      "name": "spanAnnotations",
      "plural": true,
      "selections": (v1/*: any*/),
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
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "TraceAnnotation",
          "kind": "LinkedField",
          "name": "traceAnnotations",
          "plural": true,
          "selections": (v1/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "args": [
        {
          "kind": "Literal",
          "name": "includeTraceAnnotations",
          "value": true
        }
      ],
      "kind": "FragmentSpread",
      "name": "AnnotationSummaryGroup"
    }
  ],
  "type": "Span",
  "abstractKey": null
};
})();

(node as any).hash = "9cd397ed19247fa47959933f3b5a3be9";

export default node;
