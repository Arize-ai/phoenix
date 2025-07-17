# Access Control (RBAC)

The role-based access control (RBAC) in Phoenix is based on the following user roles:

* `admin` - full control to the system, can administer users, system keys, etc.
* `member` - a developer that can add traces, experiments, datasets, etc.

A user's rule controls their access via the UI as well as through the APIs.&#x20;

## User Management

<table><thead><tr><th width="549">Action</th><th width="100" align="center">Admin</th><th align="center">Member</th></tr></thead><tbody><tr><td>Create User</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Delete User</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Change Own Password</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Change Other's Password</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Change Own Username</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Change Other's Username</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Create System API Keys</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Delete System API Keys</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Create Own User API Keys</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Delete Own User API Keys</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Delete Other's User API Keys</td><td align="center">✅ Yes</td><td align="center">No</td></tr></tbody></table>

## API Key Management

<table><thead><tr><th width="548">Action</th><th width="98" align="center">Admin</th><th align="center">Member</th></tr></thead><tbody><tr><td>List All System API Keys</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>List All User API Keys</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>List All Users</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Fetch Other User's Info, e.g. emails</td><td align="center">✅ Yes</td><td align="center">No</td></tr></tbody></table>



\
