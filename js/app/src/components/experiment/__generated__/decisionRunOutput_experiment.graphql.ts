/**
 * @generated SignedSource<<71bc709b774464668bb64bd8f2438a71>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type decisionRunOutput_experiment$data = {
  readonly job: {
    readonly taskConfig: {
      readonly __typename: "DecisionTaskConfig";
      readonly questions: ReadonlyArray<{
        readonly __typename: "DecisionChoiceQuestion";
        readonly choices: ReadonlyArray<{
          readonly description: string | null;
          readonly value: string;
        }>;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionPredicateQuestion";
        readonly criteria: {
          readonly false: string | null;
          readonly true: string | null;
        } | null;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionScaleQuestion";
        readonly instructions: string;
        readonly levels: ReadonlyArray<{
          readonly description: string | null;
          readonly label: string;
        }>;
        readonly name: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    } | null;
  } | null;
  readonly " $fragmentType": "decisionRunOutput_experiment";
};
export type decisionRunOutput_experiment$key = {
  readonly " $data"?: decisionRunOutput_experiment$data;
  readonly " $fragmentSpreads": FragmentRefs<"decisionRunOutput_experiment">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "decisionRunOutput_experiment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ExperimentJob",
      "kind": "LinkedField",
      "name": "job",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "taskConfig",
          "plural": false,
          "selections": [
            (v0/*:: as any*/),
            {
              "kind": "InlineFragment",
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "questions",
                  "plural": true,
                  "selections": [
                    (v0/*:: as any*/),
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*:: as any*/),
                        (v2/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "DecisionPredicateCriteria",
                          "kind": "LinkedField",
                          "name": "criteria",
                          "plural": false,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "true",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "false",
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionPredicateQuestion",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*:: as any*/),
                        (v2/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "DecisionChoiceOption",
                          "kind": "LinkedField",
                          "name": "choices",
                          "plural": true,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "value",
                              "storageKey": null
                            },
                            (v3/*:: as any*/)
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionChoiceQuestion",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*:: as any*/),
                        (v2/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "DecisionScaleLevel",
                          "kind": "LinkedField",
                          "name": "levels",
                          "plural": true,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "label",
                              "storageKey": null
                            },
                            (v3/*:: as any*/)
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionScaleQuestion",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "type": "DecisionTaskConfig",
              "abstractKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Experiment",
  "abstractKey": null
};
})();

(node as any).hash = "c62412613203bc40f2ed5cf0f94da210";

export default node;
