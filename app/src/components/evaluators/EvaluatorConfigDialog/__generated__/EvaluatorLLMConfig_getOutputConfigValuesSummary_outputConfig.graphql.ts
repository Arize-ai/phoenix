/**
 * @generated SignedSource<<bd612f70ea9f346a85b81e835a251383>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig$data = {
  readonly outputConfig: {
    readonly values: ReadonlyArray<{
      readonly label: string;
      readonly score: number | null;
    }>;
  };
  readonly " $fragmentType": "EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig";
};
export type EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig$key = {
  readonly " $data"?: EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig$data;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "CategoricalAnnotationConfig",
      "kind": "LinkedField",
      "name": "outputConfig",
      "plural": false,
      "selections": [
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
      "storageKey": null
    }
  ],
  "type": "LLMEvaluator",
  "abstractKey": null
};

(node as any).hash = "53ec5bb3e78f5216f5200ebb37ac7a49";

export default node;
