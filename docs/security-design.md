# Local practicum design

Status: design recorded before implementation; local draft, not a submitted practicum.

## Boundaries and authentication

One learner's browser sends plant name, species and care notes to an Express
server bound to 127.0.0.1. The server alone sends JSON over verified HTTPS to
api.hubapi.com. HubSpot stores the records in the learner's developer test
account. There is no database, file upload, payment, password or public hosting.

Identity: a single local learner, not multiple users or tenants. No login,
password hashing, MFA, JWT, refresh tokens or session store is needed for this
local exercise. HubSpot authenticates service calls with a scoped private-app
Bearer token. Missing configuration fails closed. The account and object IDs
come from local configuration, never from a browser request. The setup command
checks the token's Hub ID against the configured test-account ID before writes.
The learner must explicitly confirm that it is a developer test account.

Authorization: test-account scopes are schemas.custom read/write,
objects.custom read/write and objects.contacts read/write. No production account
or deployment is in scope. The token lives only in an ignored local .env file or
process environment; it is never rendered or logged. Rotate/revoke in HubSpot
if compromised. Stop the local process to disable access. No browser auth token
or cookie is stored. Local host checks and a random per-process form token
prevent cross-origin browser submissions; the form token is not a HubSpot secret.

## Ingestion and output

The form schema allows only name (1–120 characters), species (1–120), care_notes
(1–1000), and a form token. Reject duplicate, unknown and non-string fields.
Parse urlencoded bodies with extended:false, an 8 KB limit and four parameters.
Use Pug's escaped output for form and API data; never compile user templates.
Only fixed template names and a fixed public directory are served. No shell,
SQL, rich HTML, arbitrary URL fetcher or native deserialization exists.

Axios uses a fixed HTTPS API host, encoded validated IDs, no redirects, a
10-second timeout and a 2 MB response limit. Paging reuses only the next cursor,
never a remote-provided URL, with a 100-page cap. Request errors expose a generic
message and HTTP status, never Axios config, headers, response bodies or stacks.
Lock dependency versions and commit the npm lockfile after installing without
dependency lifecycle scripts.

## STRIDE and abuse cases

- Browser → local server: another site might forge a create request or use DNS
  rebinding. Bind loopback, require localhost/127.0.0.1 Host and an unpredictable
  form token. The local OS user is trusted and can see the same test data.
- Form → HubSpot: unexpected properties could alter other data. Allowlist all
  fields, enforce lengths and types, and construct the properties object.
- HubSpot → Pug: hostile CRM values could execute HTML. Escape every value and
  use a restrictive Content-Security-Policy.
- App → HubSpot: stolen credentials could read/write test CRM data. Keep token
  server-side, verify TLS, refuse redirects and scope the private app narrowly.
- Errors/logs → learner: raw Axios errors could disclose authorization headers.
  Report only safe status categories, without serializing the error object.
- Repeated reads/creates: bound bodies, responses, paging and timeouts; no
  automatic POST retries. A failed POST can have an uncertain outcome, so inspect
  the table before submitting again. Setup reuses records by unique sample name.
- Setup → test account: a mismatched token could modify the wrong portal. Verify
  its Hub ID before any write; require explicit test-account confirmation.

Repudiation: this local demo has one operator. Git history records code changes;
HubSpot API logs record calls. It does not promise a tamper-proof audit trail.
Elevation: browser callers cannot select an API host, object type, account or
arbitrary property. There are no user roles to escalate.

Residual risks: other programs/users on the same PC can access the local app or
.env, and a compromised PC can steal the token. Keep only synthetic data in the
test account. This app is intentionally local and needs user authentication,
per-user authorization and rate limiting before any public deployment. Setup is
restartable but not transactional and may leave partial test data after failures.
No design refuse-list items remain unaddressed within this scope.
