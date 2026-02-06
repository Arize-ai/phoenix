/**
 * @generated SignedSource<<9910c78092ec5f2cba14e00608a111d5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type BuiltInDatasetEvaluatorDetails_datasetEvaluator$data = {
  readonly evaluator: {
    readonly isBuiltin: boolean;
    readonly kind: EvaluatorKind;
    readonly name: string;
    readonly outputConfigs?: ReadonlyArray<{
      readonly lowerBound?: number | null;
      readonly name?: string;
      readonly optimizationDirection?: OptimizationDirection;
      readonly upperBound?: number | null;
      readonly values?: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
    }>;
  };
  readonly id: string;
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
  readonly outputConfigs: ReadonlyArray<{
    readonly lowerBound?: number | null;
    readonly name?: string;
    readonly optimizationDirection?: OptimizationDirection;
    readonly upperBound?: number | null;
    readonly values?: ReadonlyArray<{
      readonly label: string;
      readonly score: number | null;
    }>;
  }>;
  readonly " $fragmentType": "BuiltInDatasetEvaluatorDetails_datasetEvaluator";
};
export type BuiltInDatasetEvaluatorDetails_datasetEvaluator$key = {
  readonly " $data"?: BuiltInDatasetEvaluatorDetails_datasetEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"BuiltInDatasetEvaluatorDetails_datasetEvaluator">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    {
      "kind": "InlineFragment",
      "selections": [
        (v0/*: any*/)
      ],
      "type": "AnnotationConfigBase",
      "abstractKey": "__isAnnotationConfigBase"
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "CategoricalAnnotationValue",
          "kind": "LinkedField",
          "name": "values",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "label",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "score",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "type": "CategoricalAnnotationConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "lowerBound",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "upperBound",
          "storageKey": null
        }
      ],
      "type": "ContinuousAnnotationConfig",
      "abstractKey": null
    }
  ],
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "BuiltInDatasetEvaluatorDetails_datasetEvaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorInputMapping",
      "kind": "LinkedField",
      "name": "inputMapping",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "literalMapping",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "pathMapping",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    (v2/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "evaluator",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "kind",
          "storageKey": null
        },
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "isBuiltin",
          "storageKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v2/*: any*/)
          ],
          "type": "BuiltInEvaluator",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DatasetEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "57da5f2fd7c96c20dbfff137b122054f";

export default node;
