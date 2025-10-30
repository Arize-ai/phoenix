/**
 * @generated SignedSource<<18913ec0ce484c8672561603af09dc83>>
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
  name: string;
};
export type SettingsAnnotationsPageCreateAnnotationConfigMutation$variables = {
  input: CreateAnnotationConfigInput;
};
export type SettingsAnnotationsPageCreateAnnotationConfigMutation$data = {
  readonly createAnnotationConfig: {
    readonly annotationConfig: {
      readonly __typename: string;
    };
  };
};
export type SettingsAnnotationsPageCreateAnnotationConfigMutation = {
  response: SettingsAnnotationsPageCreateAnnotationConfigMutation$data;
  variables: SettingsAnnotationsPageCreateAnnotationConfigMutation$variables;
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsAnnotationsPageCreateAnnotationConfigMutation",
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
    "name": "SettingsAnnotationsPageCreateAnnotationConfigMutation",
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
              (v2/*: any*/),
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
    ]
  },
  "params": {
    "cacheID": "8f81a5e67c5c540e2d03bc14f15ef0c3",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageCreateAnnotationConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageCreateAnnotationConfigMutation(\n  $input: CreateAnnotationConfigInput!\n) {\n  createAnnotationConfig(input: $input) {\n    annotationConfig {\n      __typename\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9d83d5bc4f9f1aefdfe14c9a706f5a34";

export default node;
