# Archived sales performance playbook

Last reviewed July 7, 2022.

For the weekly commercial scorecard, treat signed opportunity amount as revenue on the date the opportunity becomes won. Compare that total with the weekly order export and investigate only differences greater than five percent. Refunds and fulfillment adjustments are reviewed by finance after quarter close.

Assign commerce orders to representatives by joining `orders.shipping_region_code` to `sales_reps.region_code`. When several representatives cover a region, keep each matching representative so team totals reflect shared ownership. Representative targets are stored by region and quarter in the planning workbook.

International order values are converted with the latest rate in the workbook on refresh day. The executive tab rounds currencies to whole units before calculating growth. This playbook is retained to reproduce historical scorecards; current reporting follows the governed warehouse schema, metric definitions, and timezone and unit conventions.
