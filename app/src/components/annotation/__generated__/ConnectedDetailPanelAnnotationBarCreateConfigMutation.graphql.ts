/**
 * @generated SignedSource<<80a4139929f074e0a735acdd73f6dccc>>
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
export type ConnectedDetailPanelAnnotationBarCreateConfigMutation$variables = {
  input: CreateAnnotationConfigInput;
};
export type ConnectedDetailPanelAnnotationBarCreateConfigMutation$data = {
  readonly createAnnotationConfig: {
    readonly annotationConfig: {
      readonly __typename: string;
      readonly id?: string;
    };
  };
};
export type ConnectedDetailPanelAnnotationBarCreateConfigMutation = {
  response: ConnectedDetailPanelAnnotationBarCreateConfigMutation$data;
  variables: ConnectedDetailPanelAnnotationBarCreateConfigMutation$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
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
          {
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
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ConnectedDetailPanelAnnotationBarCreateConfigMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarCreateConfigMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "c40f2faed132147d17b050dddba91e0b",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarCreateConfigMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarCreateConfigMutation(\n  $input: CreateAnnotationConfigInput!\n) {\n  createAnnotationConfig(input: $input) {\n    annotationConfig {\n      __typename\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b419f5fcefdb424a4756f240364a7a88";

export default node;
