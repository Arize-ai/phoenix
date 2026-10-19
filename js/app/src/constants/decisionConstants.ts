/** Starter examples for the decision playground's structured input. */
export const DEFAULT_DECISION_STATE =
  "I was charged twice for my order. Please refund the duplicate payment.";

export const DEFAULT_CHOICE_CRITERIA = JSON.stringify(
  {
    billing: "Payments, invoices, and refunds",
    technical: "Problems using the product",
    other: "Requests outside these categories",
  },
  null,
  2
);

export const DEFAULT_SCORE_CRITERIA = JSON.stringify(
  ["Low", "Medium", "High"],
  null,
  2
);

export const DEFAULT_NOUL_CRITERIA = JSON.stringify(
  {
    true: "The condition holds",
    false: "The condition does not hold",
  },
  null,
  2
);
