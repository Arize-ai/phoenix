# Improving Classification Accuracy with Prompt Learning

In this cookbook we use Prompt Learning to boost accuracy on a classification dataset.&#x20;

## Design

The dataset contains support queries.

```csv
"Signed up ages ago but never got around to logging in — now it says no account found. Do I start over?","Account Creation"
"where’s the night theme u promised", "Feature Request"
"google calendar link keeps ‘erroring’", "Integration Help"
```

There are 30 classes we are mapping these support queries to.&#x20;

```
Account Creation – Questions about creating a new user account.
Login Issues – Trouble accessing an existing account, including login errors.
Password Reset – Requests to reset or recover a forgotten password.
Two-Factor Authentication – Problems related to 2FA codes or verification steps.
Profile Updates – Questions about changing profile details like email or name.
Billing Inquiry – Questions about charges, billing cycles, or transaction history.
Refund Request – Asking for a refund due to dissatisfaction or error.
Subscription Upgrade/Downgrade – Requests to change the user's subscription plan.
Payment Method Update – Updating or replacing the payment method on file.
Invoice Request – Requests for a copy of an invoice or receipt.
Order Status – Inquiries about the delivery or progress of an order.
Shipping Delay – Reporting or asking about delayed shipments.
Product Return – Requests for returning purchased products.
Warranty Claim – Submitting a claim for defective items under warranty.
Technical Bug Report – Reporting crashes, glitches, or other software bugs.
Feature Request – Suggestions to add or improve product features.
Integration Help – Issues with connecting third-party services or tools.
Data Export – Requests to download or export personal or usage data.
Security Concern – Reporting suspicious activity or potential security issues.
Terms of Service Question – Questions about cancellation, usage rules, or rights.
Privacy Policy Question – Questions about how user data is collected or used.
Compliance Inquiry – Questions about legal compliance (e.g., GDPR, CCPA).
Accessibility Support – Requests for help using the service with a disability.
Language Support – Questions about multilingual support or language settings.
Mobile App Issue – Problems specifically with the mobile version of the app.
Desktop App Issue – Issues related to the desktop version or installation.
Email Notifications – Not receiving expected emails such as confirmations.
Marketing Preferences – Requests to manage or stop promotional emails.
Beta Program Enrollment – Interest in joining early access or beta programs.
General Feedback – General praise, criticism, or user suggestions.
```

We build a complex evaluator as feedback for the prompt optimizer. Specifically, we use LLM-as-judge to return the following eval types:

```markdown
correctness: "correct" or "incorrect" based on whether predicted classification = correct classification
explanation: Brief explanation of why the predicted classification is correct or incorrect, referencing the correct label if relevant.
confusion_reason: If incorrect, explain why the model may have made this choice instead of the correct classification. Focus on likely sources of confusion. If correct, say 'no confusion'.
evidence_span: Exact phrase(s) from the query that strongly indicate the correct classification.
prompt_fix_suggestion: One clear instruction to add to the classifier prompt to prevent this error.
```

## Run the Notebook

More information regarding the exact implementation details are in the notebook. In order to run the notebook, first clone the Prompt Learning repository.

```
git clone https://github.com/Arize-ai/prompt-learning.git
```

Navigate to `notebooks` -> `phoenix_support_query_classification.ipynb`.&#x20;

You can see the notebook [here](https://github.com/Arize-ai/prompt-learning/blob/main/notebooks/phoenix_support_query_classification.ipynb). But keep in mind **you will have to clone the repositor**y and run the notebook within the `notebooks` folder for the notebook to run!



Here are the optimization results we see:

<figure><img src="../.gitbook/assets/Screenshot 2025-08-28 at 1.31.26 PM.png" alt=""><figcaption></figcaption></figure>
