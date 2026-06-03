/**
 * @generated SignedSource<<ba8df3b3ddbd605f656ba17b9c599d44>>
 * @lightSyntaxTransform
 * @nogrep
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
  categorical?: CategoricalAnnotationConfigInput | null;
  continuous?: ContinuousAnnotationConfigInput | null;
  freeform?: FreeformAnnotationConfigInput | null;
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
export type AnnotationConfigSlideoverCreateMutation$variables = {
  input: CreateAnnotationConfigInput;
};
export type AnnotationConfigSlideoverCreateMutation$data = {
  readonly createAnnotationConfig: {
    readonly annotationConfig: {
      readonly id?: string;
    };
  };
};
export type AnnotationConfigSlideoverCreateMutation = {
  response: AnnotationConfigSlideoverCreateMutation$data;
  variables: AnnotationConfigSlideoverCreateMutation$variables;
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "Node",
  "abstractKey": "__isNode"
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AnnotationConfigSlideoverCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
              (v2/*: any*/)
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "AnnotationConfigSlideoverCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__typename",
                "storageKey": null
              },
              (v2/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "9c7648b36c9c1d5733a8ac0e94389b1d",
    "id": null,
    "metadata": {},
    "name": "AnnotationConfigSlideoverCreateMutation",
    "operationKind": "mutation",
    "text": "mutation AnnotationConfigSlideoverCreateMutation(\n  $input: CreateAnnotationConfigInput!\n) {\n  createAnnotationConfig(input: $input) {\n    annotationConfig {\n      __typename\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8ac2ba21b95466275eb9dadd2fe91f71";

export default node;
