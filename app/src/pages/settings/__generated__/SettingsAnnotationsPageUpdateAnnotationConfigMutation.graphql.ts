/**
 * @generated SignedSource<<c1388bf17e0533f1b44cddf5f57d90c2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE";
export type UpdateAnnotationConfigInput = {
  annotationConfig: AnnotationConfigInput;
  id: string;
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
  score: number;
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
export type SettingsAnnotationsPageUpdateAnnotationConfigMutation$variables = {
  input: UpdateAnnotationConfigInput;
};
export type SettingsAnnotationsPageUpdateAnnotationConfigMutation$data = {
  readonly updateAnnotationConfig: {
    readonly annotationConfig: {
      readonly id?: string;
    };
  };
};
export type SettingsAnnotationsPageUpdateAnnotationConfigMutation = {
  response: SettingsAnnotationsPageUpdateAnnotationConfigMutation$data;
  variables: SettingsAnnotationsPageUpdateAnnotationConfigMutation$variables;
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
    "name": "SettingsAnnotationsPageUpdateAnnotationConfigMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UpdateAnnotationConfigPayload",
        "kind": "LinkedField",
        "name": "updateAnnotationConfig",
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
    "name": "SettingsAnnotationsPageUpdateAnnotationConfigMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UpdateAnnotationConfigPayload",
        "kind": "LinkedField",
        "name": "updateAnnotationConfig",
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
    "cacheID": "94a9fe0ca701c56d2b28a5d2b81dce64",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageUpdateAnnotationConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageUpdateAnnotationConfigMutation(\n  $input: UpdateAnnotationConfigInput!\n) {\n  updateAnnotationConfig(input: $input) {\n    annotationConfig {\n      __typename\n      ... on ContinuousAnnotationConfig {\n        id\n      }\n      ... on CategoricalAnnotationConfig {\n        id\n      }\n      ... on FreeformAnnotationConfig {\n        id\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "dde97174806dace7b02082f65717f27b";

export default node;
