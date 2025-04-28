# Data Retention

By default Phoenix will store and preserve all your data and data retention is entirely under your control. However in production environments there might be good reasons to purge older data. \
\
Similar to data retention being infinite by default, Phoenix also does not gate the deletion of the data. If you no longer need certain projects, traces, datasets, experiments, or prompts, you can delete these resources through the UI as well as through the REST API.

## Deleting Traces

You can either delete traces by time or individually.\
\
To delete traces older than a certain date, click on the action button on a project an select `remove data`

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/remove_data.png" alt=""><figcaption><p>Click Remove Data. You will be able do delete traces older than a certain date.</p></figcaption></figure>

<div data-full-width="false"><figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/remove_data_by_date.png" alt=""><figcaption><p>Select a date. Traces older than the given date will be purged.</p></figcaption></figure></div>

## Project Retention Policies

In Phoenix 9.0 or greater you will be able to automatically purge traces from projects by configuring a retention policy. Retention policies can be either time based or trace count based. Stay tuned for the 9.0 release.\
