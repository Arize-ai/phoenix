# Manually Resetting Your Password

You should first try to recover your password using one of the methods described in the documentation. As a last resort, you can update the database with a newly computed password salt and hash. This requires access to Phoenix's underlying SQLite or PostgreSQL database.

## Steps

1. Ensure you have access to the database. We recommend using a database browser with a UI that enables you to view tables and update tuples. If you are using SQLite, look for a `phoenix.
1. Locate your tuple in the `users` table of the database.
1. Copy your salt from the `password_salt` field.
1. Install Phoenix with `pip install arize-phoenix>=5`.
1. Copy [this script](./compute_password_hash.py).
1. Run the script with `python compute_password_hash.py --password <password> --salt <salt>`, substituting your desired password and the copied salt. The script should print the computed password hash to stdout.
1. Update the `password_hash` field of your tuple in the `users` table of the database with the password hash from the previous step.

You should now be able to log into Phoenix with your new password.

If you encounter issues, contact the team in the #phoenix-support channel in the Arize AI Slack community.
