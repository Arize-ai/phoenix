/**
 * @generated SignedSource<<e4dd88c0553f80d09def13c7989f3f04>>
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
      readonly id?: string;
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
v2 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "id",
    "storageKey": null
  }
],
v3 = {
  "kind": "InlineFragment",
  "selections": (v2/*: any*/),
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v4 = {
  "kind": "InlineFragment",
  "selections": (v2/*: any*/),
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v5 = {
  "kind": "InlineFragment",
  "selections": (v2/*: any*/),
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
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
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/)
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
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__typename",
                "storageKey": null
              },
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": (v2/*: any*/),
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
    "cacheID": "ea8f6ec1e5c53c72949c69288d82244f",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageCreateAnnotationConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageCreateAnnotationConfigMutation(\n  $input: CreateAnnotationConfigInput!\n) {\n  createAnnotationConfig(input: $input) {\n    annotationConfig {\n      __typename\n      ... on ContinuousAnnotationConfig {\n        id\n      }\n      ... on CategoricalAnnotationConfig {\n        id\n      }\n      ... on FreeformAnnotationConfig {\n        id\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6567b4b311e3f07d550f93a09f714daa";

export default node;
