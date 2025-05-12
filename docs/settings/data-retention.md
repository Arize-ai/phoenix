# Data Retention

By default Phoenix will store and preserve all your data and data retention is entirely under your control. However in production environments there might be good reasons to purge older data. \
\
Similar to data retention being infinite by default, Phoenix also does not gate the deletion of the data. If you no longer need certain projects, traces, datasets, experiments, or prompts, you can delete these resources through the UI as well as through the REST API.

## Project Retention Policies

In Phoenix 9.0 or greater you will can automatically purge traces from projects by configuring a retention policy. Retention policies can be either time based or trace count based.&#x20;

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/retention_policy.png" alt=""><figcaption><p>A retention policy starts deleting traces that are outside of the retention window</p></figcaption></figure>

By default Phoenix comes with 1 project retention policy called `Default` . Every project in your instance is associated to this retention policy unless specified otherwise. The `Default` policy also specifies 0 days, which is equal to "Indefinite" retention.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/default_retention_policy.png" alt=""><figcaption><p>By default phoenix retains all the data you send it</p></figcaption></figure>

If you simply want to preserve a static set amount of traces per project, you can simply adjust the max days traces will be stored in Phoenix and this will be applied to all current and future projects that get created.\
\
In some cases you might want to specify a different retention policy to a particular project (e.x. you might want to age out your playground spans quicker than spans from an actual application). In this case you can navigate to the `Data Retention` tab and create a new policy.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/new_retention_policy.png" alt=""><figcaption><p>Create a new retention policy to associate with projects</p></figcaption></figure>

A policy is made up of:

* **name** - a human friendly name for others to understand it (e.x. "one week")
* **rule** - number of max days and or number of traces that will cause traces to be purged
* **schedule** - a CRON schedule for when the policy will be enforced. It's recommended to do it during non-business hours for the least amount of discruption (if there is any)

Once you have created a policy you can go to the project config and associate the policy to the project. You must be an admin to perform this action.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/project_policy.png" alt=""><figcaption><p>Select your new policy in the project config tab</p></figcaption></figure>

## Deleting Traces Manually

You can either delete traces by time or individually.\
\
To delete traces older than a certain date, click on the action button on a project an select `remove data`

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/remove_data.png" alt=""><figcaption><p>Click Remove Data. You will be able do delete traces older than a certain date.</p></figcaption></figure>

<div data-full-width="false"><figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/remove_data_by_date.png" alt=""><figcaption><p>Select a date. Traces older than the given date will be purged.</p></figcaption></figure></div>



{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/project_retention_policy.mp4" %}
How to configure retention policies
{% endembed %}
