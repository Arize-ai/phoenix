/**
 * @generated SignedSource<<bbe601eb3f62464f0ad4d4c9e1a39cf4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type CreateAnnotationConfigInput = {
  annotationConfig: AnnotationConfigInput;
};
export type AnnotationConfigInput = {
  categorical: CategoricalAnnotationConfigInput;
  continuous?: never;
  freeform?: never;
} | {
  categorical?: never;
  continuous: ContinuousAnnotationConfigInput;
  freeform?: never;
} | {
  categorical?: never;
  continuous?: never;
  freeform: FreeformAnnotationConfigInput;
};
export type CategoricalAnnotationConfigInput = {
  description?: string | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  values: ReadonlyArray<CategoricalAnnotationConfigValueInput>;
};
export type CategoricalAnnotationConfigValueInput = {
  label: string;
  score?: number | null;
};
export type ContinuousAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  upperBound?: number | null;
};
export type FreeformAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection?: OptimizationDirection | null;
  threshold?: number | null;
  upperBound?: number | null;
};
export type createAnnotationConfigToolMutation$variables = {
  input: CreateAnnotationConfigInput;
};
export type createAnnotationConfigToolMutation$data = {
  readonly createAnnotationConfig: {
    readonly annotationConfig: {
      readonly __typename: "CategoricalAnnotationConfig";
      readonly id: string;
      readonly name: string;
    } | {
      readonly __typename: "ContinuousAnnotationConfig";
      readonly id: string;
      readonly name: string;
    } | {
      readonly __typename: "FreeformAnnotationConfig";
      readonly id: string;
      readonly name: string;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    };
  };
};
export type createAnnotationConfigToolMutation = {
  response: createAnnotationConfigToolMutation$data;
  variables: createAnnotationConfigToolMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  (v3/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  }
],
v5 = {
  "kind": "InlineFragment",
  "selections": (v4/*:: as any*/),
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v6 = {
  "kind": "InlineFragment",
  "selections": (v4/*:: as any*/),
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v7 = {
  "kind": "InlineFragment",
  "selections": (v4/*:: as any*/),
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "createAnnotationConfigToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "CreateAnnotationConfigPayload",
        "kind": "LinkedField",
        "name": "createAnnotationConfig",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "annotationConfig",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "createAnnotationConfigToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "CreateAnnotationConfigPayload",
        "kind": "LinkedField",
        "name": "createAnnotationConfig",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "annotationConfig",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v3/*:: as any*/)
                ],
                "type": "Node",
                "abstractKey": "__isNode"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "97344f15cf4ffc9c0ac28dd325c9f240",
    "id": null,
    "metadata": {},
    "name": "createAnnotationConfigToolMutation",
    "operationKind": "mutation",
    "text": "mutation createAnnotationConfigToolMutation(\n  $input: CreateAnnotationConfigInput!\n) {\n  createAnnotationConfig(input: $input) {\n    annotationConfig {\n      __typename\n      ... on CategoricalAnnotationConfig {\n        id\n        name\n      }\n      ... on ContinuousAnnotationConfig {\n        id\n        name\n      }\n      ... on FreeformAnnotationConfig {\n        id\n        name\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3d21eae195d8f80c0db97e26988029ed";

export default node;
