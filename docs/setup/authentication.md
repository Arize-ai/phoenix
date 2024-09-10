# Authentication

{% hint style="warning" %}
Authentication is coming in Phoenix 5.0 and currently in a feature branch
{% endhint %}

By default Phoenix deploys with authentication disabled as you may be just trying Phoenix for the very first time or have Phoenix deployed in a VPC. However you might want to further protect access to your data via authentication. Below are the steps.

{% hint style="info" %}
Authentication will stop collecting traces and block all API access until API keys are created. For that reason we recommend scheduling some downtime if you have already deployed phoenix.
{% endhint %}

## Setup

To enable authentication on your Phoenix, you will have to set two environment variables:

| Environment Variable      | Description                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PHOENIX\_ENABLE\_AUTH** | Set to `True` to enable authentication on your platform                                                                                                                 |
| **PHOENIX\_SECRET**       | A long string value that is used to sign JWTs for your deployment. It should be a good mix of characters and numbers and should be kept in a secret store of some kind. |

Deploy Phoenix with the above two environment variables set. You will know that you have setup authentication correctly if the UI navigates to to a login screen.

By default Phoenix will create an admin user account. To get started:

1. Log in as the admin user. The email shoul be **admin@localhost** and the password will be **admin**
2. Set a new password for admin. You will be prompted to set a new password. Use a sufficiently complex password and save it in a safe place.
3. Go to the settings page on the left nav and create your first system API key. This API key can be used to log traces, use the Phoenix client,  and programmatically hit Phoenix's APIs. Store the system API key in a safe place.
4. In your application code, make sure to set the proper authentication headers with the system API key. Phoenix respects headers in the form of [bearer auth](https://swagger.io/docs/specification/authentication/bearer-authentication/), meaning that you should set the header in the form **Authorization: Bearer \<token>.** Note that if you are using the Phoenix Client or Phoenix Otel, you simply need to set the **PHOENIX\_API\_KEY** environment variable.

Re-deploy your application with the API key created above and you will see traces stream in as before.
