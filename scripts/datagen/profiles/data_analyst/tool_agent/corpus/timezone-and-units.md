# Timezone, currency, and unit conventions

Warehouse event timestamps are stored in UTC. Operational daily reports convert events to the timezone recorded on the warehouse before extracting the calendar date. New York uses `America/New_York`, Reno uses `America/Los_Angeles`, and Amsterdam uses `Europe/Amsterdam`. A request for a warehouse's “yesterday” means its last completed local calendar day, which may differ across facilities.

Commerce marts store order-item and refund amounts in currency major units as decimals. The payment processor stores `amount_minor` as integer subunits: USD and EUR use 100 subunits per major unit, while JPY uses one. The currency code must travel with every monetary amount; magnitude alone is not a reliable way to infer units.

Daily exchange rates are keyed by UTC date and source currency and express USD per source-currency unit. Revenue uses the rate for the recognition timestamp. A multi-currency aggregation must convert row-level amounts before summing; converting a mixed-currency total has no defined meaning.

Durations are stored as integer seconds in event marts and displayed as hours in operational summaries. Percent fields in governed result tables use decimal fractions, so `0.075` means 7.5 percent. Source spreadsheets may use displayed percentage values and should be normalized before comparison.
