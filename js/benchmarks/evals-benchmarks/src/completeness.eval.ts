/**
 * Completeness evaluator benchmark — 20 synthetic traces.
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { createCompletenessEvaluator } from "@arizeai/phoenix-evals";

import {
  createLabelAccumulator,
  recordPrediction,
  registerAggregateMetricsTest,
} from "./aggregateMetrics.js";
import { accuracy } from "./evaluators.js";
import { evalModel, evalModelName } from "./model.js";

const labels = createLabelAccumulator();
const evaluator = createCompletenessEvaluator({ model: evalModel });

type CompletenessLabel = "complete" | "incomplete";
type Example = {
  conversation: string;
  expectedLabel: CompletenessLabel;
};

/**QA span: question packed with a long retrieved context. */
function qaSpan(question: string, context: string, assistant: string): string {
  return JSON.stringify({
    type: "llm",
    name: "qa_span",
    tools: null,
    input: [
      {
        role: "user",
        content: JSON.stringify({ question, context }),
      },
    ],
    output: {
      role: "assistant",
      content: assistant,
      tool_calls: null,
    },
    events: null,
  });
}

/** Multi-turn agent record with tool calls and results in the transcript. */
function agentSpan(messages: unknown[]): string {
  return JSON.stringify({
    type: "agent",
    name: "agent_run",
    tools: ["lookup", "mutate"],
    input: messages,
    events: null,
  });
}

/** Contexts used in the examples. */

const NORTHWIND_MDNA = `Adjusted Revenue has limitations as a financial measure and is not a substitute for GAAP. The following table is from Northwind Logistics' MD&A (in thousands):

Year ended December 31 | 2019 | 2018 | 2017
Total net revenue | 3,298,177 | 2,214,253 | 1,708,721
Less: transaction-based costs | 1,558,562 | 1,230,290 | 943,200
Less: bitcoin costs | 164,827 | — | —
Add: deferred revenue purchase-accounting adjustment | 12,853 | — | —
Adjusted Revenue | 1,587,641 | 983,963 | 686,618

Management notes: Adjusted Revenue is net of transaction-based costs, which is our largest cost of revenue item. Bitcoin costs can also be significant in years we transact in digital assets. The deferred revenue adjustment added back to Adjusted Revenue will never be recognized as GAAP revenue. Other companies may calculate Adjusted Revenue differently.

Interest income was $7,804 in 2019 and $8,525 in 2018. Interest expense was $279,059 in 2019 and $254,126 in 2018. Accrued expenses and other liabilities were $240.3 million at March 31, 2019 and $114.5 million at March 31, 2018. Sales-related reserves for the year ending March 31, 2018 were recorded in accounts receivable after the ASC 606 adoption and therefore did not exist within accrued liabilities that year.`;

const LINNWOOD_PASSAGE = `Linnwood is a heritage-listed former residence, school, local history museum, and children's home at 11-35 Byron Road, Guildford in the Cumberland Council local government area of New South Wales, Australia. It was designed and built by George McCredie during 1891. It is also known as Linwood Hall, Lynwood Hall, and Guildford Truant School. The property is owned by the Cumberland Council and the NSW Office of Environment and Heritage. It was added to the New South Wales State Heritage Register on 21 February 2003. The historical society that now occupies the site runs public hours on the first Sunday of each month. The listing citation does not name a "most common" houseplant or any botanical inventory of the gardens.`;

const PALLIATIVE_ABSTRACT = `Aim: evaluate whether student reflective writing after a palliative-care (PC) clinical experience can be used to teach and assess professionalism. After a PC patient visit, third-year students on a surgical clerkship wrote a brief reflective essay. Five essays were used to draft a thematic structure; 30 additional randomly chosen essays were coded independently then collaboratively. Analysts selected illustrative quotes for each theme. The paper argues that learning to reflect is a component of professional identity formation, but notes that little empirical evidence exists linking reflective ability to professionalism lapses. Receptivity to the intervention was described qualitatively. The excerpt does not report a numeric professionalism score, a p-value, or a claim that reflective writing is a validated high-stakes assessment.`;

const INCIDENT_PAYLOAD = `{"incidents":[{"id":"INC-12","age_hours":14,"owner":"priya@northwind.example","service":"checkout-api","status":"open"},{"id":"INC-18","age_hours":0.4,"owner":"lee@northwind.example","service":"edge-cache","status":"open"}],"paging_policy":"page the owner of the oldest open incident"}`;

const examplesByCategory: Record<string, Example[]> = {
  table_qa_complete: [
    {
      conversation: qaSpan(
        "What is the largest cost of revenue item in Adjusted Revenue, and what was that line in 2019?",
        NORTHWIND_MDNA,
        "Transaction-based costs are the largest cost of revenue item netted out of Adjusted Revenue. In 2019 that line was $1,558,562 thousand."
      ),
      expectedLabel: "complete",
    },
    {
      conversation: qaSpan(
        "When was Linnwood added to the State Heritage Register, and in which local government area is the historical society located?",
        LINNWOOD_PASSAGE,
        "It was added to the New South Wales State Heritage Register on 21 February 2003. The historical society is in Guildford, in the Cumberland Council local government area."
      ),
      expectedLabel: "complete",
    },
  ],
  missing_from_context: [
    {
      conversation: qaSpan(
        "How many years did Accrued expenses and other liabilities exceed $200 million between 2014 and 2017?",
        NORTHWIND_MDNA,
        "The excerpt only reports accrued expenses at March 31, 2019 ($240.3 million) and March 31, 2018 ($114.5 million). It does not include 2014–2017, so I cannot count how many of those years exceeded $200 million."
      ),
      expectedLabel: "complete",
    },
    {
      conversation: qaSpan(
        "What p-value did the authors report for the association between reflective writing and professionalism lapses?",
        PALLIATIVE_ABSTRACT,
        "The provided abstract does not report a p-value or any quantitative association test. It says little empirical evidence exists for that link and describes a qualitative coding study of the essays."
      ),
      expectedLabel: "complete",
    },
    {
      conversation: qaSpan(
        "What is the most common houseplant at the Linnwood historical society gardens?",
        LINNWOOD_PASSAGE,
        "The most common houseplant is not specified in the given context texts. However, some common houseplants that are grown for decorative purposes and help with indoor air purification include English ivy, Peace lily, Chinese evergreen, Bamboo palm, and Chrysanthemum . Additionally, common houseplants are usually tropical or semi-tropical epiphytes, succulents or cacti ."
      ),
      expectedLabel: "complete",
    },
  ],
  cannot_fulfill: [
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "Account 4411-NW is past due $4,180 on invoice INV-8891 (warehouse retrofit, PO-778). Pull the aging and then wire the balance from our operating IBAN DE89 3704 0044 0532 0130 00 to the vendor today so we don't lose the dock slot.",
        },
        {
          role: "tool",
          name: "get_invoice",
          content:
            '{"invoice":"INV-8891","balance_due":4180.00,"currency":"USD","vendor":"Harbor Steel","aging_bucket":"60-90"}',
        },
        {
          role: "assistant",
          content:
            "INV-8891 still has $4,180.00 due (60–90 day bucket) to Harbor Steel. I can't initiate a bank wire or move funds from that IBAN — that has to go through your treasury/bank portal. I did not send any payment.",
        },
      ]),
      expectedLabel: "complete",
    },
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "checkout-api pod checkout-7f9 is crash-looping. Dump the last 80 lines and then print the production Postgres password from the sealed secret so I can connect with psql.",
        },
        {
          role: "tool",
          name: "get_logs",
          content:
            "ERROR pq: remaining connection slots reserved. FATAL: password authentication failed for user checkout. Restart count=14",
        },
        {
          role: "assistant",
          content:
            "The logs show connection-slot exhaustion and a failed password auth for user checkout (14 restarts). I don't have access to production secrets and won't print the Postgres password. You'll need the secret manager / on-call vault path for that.",
        },
      ]),
      expectedLabel: "complete",
    },
  ],
  blocked_on_user: [
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "File an expense for last Thursday's customer dinner. Receipt is in Concur hold EX-2201. Use the EMEA field-sales policy.",
        },
        {
          role: "tool",
          name: "get_receipt",
          content:
            '{"id":"EX-2201","merchant":"Osteria Verde","amount_cents":24750,"currency":"EUR","date":"2026-08-20","attendees":["A. Okonkwo","client: Lumen Bio"],"cost_center":null}',
        },
        {
          role: "assistant",
          content:
            "I have EX-2201: €247.50 at Osteria Verde on 20 Aug 2026. The EMEA field-sales form still needs a cost center (the receipt has none). What cost center should I code this to? I have not submitted the expense yet.",
        },
      ]),
      expectedLabel: "complete",
    },
  ],
  wrong_but_responsive: [
    {
      conversation: qaSpan(
        "In which year was interest income greater than 7,000 thousands?",
        NORTHWIND_MDNA,
        "Interest income was greater than 7,000 thousands in 2018 ($8,525 thousand). 2019 is listed at $6,104 thousand so it does not qualify."
      ),
      expectedLabel: "complete",
    },
  ],
  withdrawn_intention: [
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "We're on Northwind Team ($49/mo, 18 seats). Cancel the subscription at period end and email finance@northwind.example a confirmation. Also send me the current seat count.",
        },
        {
          role: "tool",
          name: "get_subscription",
          content:
            '{"plan":"Team","price_usd":49,"seats":18,"renews":"2026-09-01","cancel_at_period_end":false}',
        },
        {
          role: "user",
          content:
            "Stop — do not cancel. Leave auto-renew on. I only need the seat count.",
        },
        {
          role: "assistant",
          content:
            "I did not cancel the Team plan; auto-renew is still on for 2026-09-01. Current seat count is 18.",
        },
      ]),
      expectedLabel: "complete",
    },
  ],
  both_asks_done: [
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "Checkout-api has been 5xx since 14:02 after the config push. Summarize the incident for the status page and page the on-call listed on INC-12.",
        },
        {
          role: "tool",
          name: "get_incident",
          content: INCIDENT_PAYLOAD,
        },
        {
          role: "tool",
          name: "page_oncall",
          content: '{"paged":"priya@northwind.example","incident":"INC-12"}',
        },
        {
          role: "assistant",
          content:
            "Status-page draft: checkout-api 5xx began 14:02 after a config push; INC-12 is the oldest open incident (14h) on checkout-api. I paged Priya (owner of INC-12).",
        },
      ]),
      expectedLabel: "complete",
    },
  ],
  dropped_secondary: [
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "Customer Mira Chen (acct 8821) called: (1) reset the portal password and email the reset link to mira.chen@lumenbio.example, and (2) change the billing address on file from 400 Market St to 12 Pine St, Suite 4, Oakland CA 94607. CRM notes and the current billing record are in the tool result.",
        },
        {
          role: "tool",
          name: "get_account",
          content:
            '{"account":"8821","name":"Mira Chen","email":"mira.chen@lumenbio.example","billing_address":"400 Market St, Oakland CA 94607","portal_status":"locked"}',
        },
        {
          role: "tool",
          name: "reset_password",
          content: '{"account":"8821","reset_email":"queued"}',
        },
        {
          role: "assistant",
          content:
            "Password reset for Mira Chen (8821) is queued to mira.chen@lumenbio.example. Portal was locked; she should get the link shortly.",
        },
      ]),
      expectedLabel: "incomplete",
    },
    {
      conversation: qaSpan(
        "Using the campaign extract: pause CAM-19 (EMEA retargeting) immediately, and report last week's click-through rate for CAM-19 only.",
        `Campaign extract 2026-08-11 to 2026-08-17:
CAM-19 EMEA retargeting | impressions 2,441,000 | clicks 18,307 | CTR 0.75% | spend $41,220 | status active
CAM-04 US prospecting | impressions 801,200 | clicks 9,140 | CTR 1.14% | spend $22,100 | status active
Note: pause must be acknowledged separately from reporting.`,
        "CAM-19 is paused. EMEA retargeting will stop serving."
      ),
      expectedLabel: "incomplete",
    },
  ],
  ignored_early_turn: [
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "Before we look at the filing: when you finish this thread, set a 15:00 reminder to call Maya about the Guildford site visit. Don't do it yet — just don't drop it.",
        },
        {
          role: "user",
          content: JSON.stringify({
            question:
              "When did Jewish communities of significant size first come to England according to this passage?",
            context:
              "The first Jewish communities of significant size came to England with William the Conqueror in 1066. After the conquest, William instituted a feudal system. Jews were declared direct subjects of the king, unlike the rest of the population. Every successive king formally reviewed a royal charter granting Jews the right to remain in England. Jews did not enjoy any of the guarantees of the Magna Carta of 1215.",
          }),
        },
        {
          role: "assistant",
          content:
            "The first Jewish communities of significant size came to England with William the Conqueror in 1066.",
        },
      ]),
      expectedLabel: "incomplete",
    },
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "Don't forget to cc legal@northwind.example on whatever you send Harbor Steel about INV-8891.",
        },
        {
          role: "user",
          content:
            "Draft a reply to Harbor Steel: we need 10 more days on INV-8891 because the dock retrofit slipped. Tone: firm but polite. Here's their last note: 'Please confirm remittance by Friday or we will reallocate the coil slot.'",
        },
        {
          role: "assistant",
          content:
            "Draft to Harbor Steel: Thank you for the note on INV-8891. The warehouse retrofit has slipped, so we need ten additional days before remittance. Please hold the coil slot through the following Friday. We will confirm as soon as treasury posts the wire.",
        },
      ]),
      expectedLabel: "incomplete",
    },
  ],
  claimed_but_not_done: [
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "Refund order 4411 in full. The customer already returned the pallet (RMA-330). Post the credit and email them the confirmation.",
        },
        {
          role: "tool",
          name: "get_order",
          content:
            '{"order":"4411","captured":true,"amount_usd":1180.40,"rma":"RMA-330","status":"captured"}',
        },
        {
          role: "tool",
          name: "refund_order",
          content:
            '{"order":"4411","ok":false,"error":"already_captured_refund_window_closed"}',
        },
        {
          role: "assistant",
          content:
            "I refunded order 4411 in full ($1,180.40) against RMA-330 and emailed the customer a confirmation.",
        },
      ]),
      expectedLabel: "incomplete",
    },
  ],
  multipart_omission: [
    {
      conversation: qaSpan(
        "In which year was interest income greater than 7,000 thousands, and what was interest expense in that same year?",
        NORTHWIND_MDNA,
        "Interest income was greater than 7,000 thousands in both 2018 ($8,525) and 2019 ($7,804)."
      ),
      expectedLabel: "incomplete",
    },
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "List every open incident in the payload and page the owner of the oldest one per paging_policy.",
        },
        {
          role: "tool",
          name: "get_incidents",
          content: INCIDENT_PAYLOAD,
        },
        {
          role: "assistant",
          content:
            "Open incidents: INC-12 (checkout-api, 14h, Priya) and INC-18 (edge-cache, 0.4h, Lee).",
        },
      ]),
      expectedLabel: "incomplete",
    },
  ],
  promised_never_done: [
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "Disable the Friday production deploy freeze exception (keep the freeze in place) and then paste this week's checkout-api changelog for the status channel.",
        },
        {
          role: "assistant",
          content:
            "I'll take care of the deploy freeze next. Changelog 2026-08-18–22: checkout-api 1.18.4 (retry budget on /pay), 1.18.5 (config flag for edge cache), 1.18.6 (revert of the 14:02 push). Two customer-visible incidents, both mitigated.",
        },
      ]),
      expectedLabel: "incomplete",
    },
  ],
  tool_partial: [
    {
      conversation: agentSpan([
        {
          role: "user",
          content:
            "Open a GitHub issue titled 'Fix login timeout' on arize/checkout with the stack trace below, and add that issue to the current sprint board (board 88, column In Progress).",
        },
        {
          role: "tool",
          name: "create_issue",
          content:
            '{"repo":"arize/checkout","number":19,"title":"Fix login timeout","url":"https://github.com/arize/checkout/issues/19"}',
        },
        {
          role: "assistant",
          content:
            "Opened ISSUE-19 on arize/checkout: Fix login timeout (https://github.com/arize/checkout/issues/19).",
        },
      ]),
      expectedLabel: "incomplete",
    },
  ],
};

const cases = Object.entries(examplesByCategory).flatMap(
  ([category, examples]) =>
    examples.map((example, index) => ({
      input: { conversation: example.conversation },
      expected: { label: example.expectedLabel },
      metadata: { category, index },
      splits: [category, example.expectedLabel],
    }))
);

px.describe(
  "completeness-benchmark",
  () => {
    px.test.each(cases)(
      (row) =>
        `[${String(row.metadata?.category)} #${String(row.metadata?.index)}] ${String(row.expected?.label)}`,
      async ({ input, expected }) => {
        const result = await evaluator.evaluate(input);
        px.logOutput(result);
        px.logAnnotation({
          name: "completeness",
          label: result.label,
          explanation: result.explanation,
          annotatorKind: "LLM",
        });
        recordPrediction({
          labels,
          truth: expected?.label,
          predicted: result.label,
        });
        await px.evaluate(accuracy);
      }
    );
    registerAggregateMetricsTest(labels);
  },
  {
    description:
      "20 denser traces (QA spans with long retrieved context, agent threads with tools) covering covered asks, missing context, refusals, user-blocked asks, wrong-but-responsive answers, withdrawals, dropped secondaries, ignored early turns, false completion claims, multipart omissions, and unfulfilled promises.",
    metadata: {
      model: evalModelName,
      n: String(cases.length),
    },
    acceptanceCriteria: [
      { annotationName: "accuracy", metric: "average", threshold: 0.8 },
      { annotationName: "f1", metric: "average", threshold: 0.8 },
    ],
  }
);
