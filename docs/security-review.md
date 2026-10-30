# Security review — working branch

Reviewed implementation: `b24faa5` (2026-10-30). This is a local, single-operator
practicum application, not a public multi-user service.

Rafter secure-design and code-review skills were used. Their installed SKILL.md
files lacked referenced sub-documents; the matching auth, ingestion,
threat-modeling and web-app documents were read from the installed Rafter CLI's
bundled skill resources instead.

## Manual web application review

| OWASP category | Evidence and conclusion |
| --- | --- |
| A01 Access control | `index.js:23` restricts Host; `index.js:53` checks a cryptographically random form token; `index.js:100` binds loopback. `lib/config.js:10` fixes the account/object to local configuration, and `index.js:97` verifies the token's account before serving. No remote-user auth, roles or tenant selection is offered. |
| A02 Crypto and secrets | `index.js:11` uses Node crypto randomness and `index.js:54` compares tokens safely. `lib/hubspot.js:6` fixes HTTPS; `.gitignore:3` ignores credentials. No passwords or custom cryptography. Local `.env` is an intentional residual risk on a trusted PC. |
| A03 Injection | `lib/plants.js:10` allowlists fields and enforces string lengths; `views/homepage.pug:24` and `views/updates.pug:17` use escaped Pug values. Fixed template names; no SQL, shell execution, eval, or native deserialization. Tests cover stored and reflected HTML payloads. |
| A04 Design | `index.js:29` bounds body/parameter counts; `lib/hubspot.js:8` bounds requests/responses; `lib/hubspot.js:22` bounds pagination. No automatic create retries. Error view explains uncertain writes. Public rate limiting and login are outside this local-only scope. |
| A05 Configuration | `index.js:12` hides framework header; `index.js:17` sets CSP and related headers; `index.js:28` serves only the fixed public directory. `.env` returns 404 in tests. No debug endpoint or raw error page. |
| A06 Components | Exact direct dependency versions and tracked lockfile. Installed with lifecycle scripts disabled. `npm audit --omit=dev` reports zero known vulnerabilities across the installed dependency tree. Remote Rafter SCA is tracked separately below. |
| A07 Authentication | Private-app Bearer token is server-only (`lib/hubspot.js:7`). Missing config/test confirmation fails closed (`lib/config.js:9`). Wrong-account setup is refused before CRM mutations (`scripts/setup-hubspot.js:27`). No sessions, JWTs, passwords, reset or MFA implementation to review. |
| A08 Integrity | Standard urlencoded parser, explicit property object, locked npm packages. No remote configuration loading, self-updater, unsigned executable content or unsafe deserialization. Setup reuses sample identities and refuses incompatible schemas (`scripts/setup-hubspot.js:7`). |
| A09 Logging | `index.js:82` logs safe HTTP status categories only. Command error handlers use safe API messages. Tests verify secret markers never reach logs or pages. HubSpot provides API call logs; tamper-proof multi-user auditing is outside this local exercise. |
| A10 SSRF | Fixed API host (`lib/hubspot.js:6`), redirects disabled (`lib/hubspot.js:8`), validated object IDs (`lib/hubspot.js:14`), and cursor-only paging. Remote paging URLs are ignored. No browser-supplied destination or arbitrary server fetch. |

No unresolved security issue was identified in this manual review within the
documented local-only scope. This is distinct from an automated scan pass.

## Checks

- `npm test`: 13/13 pass, using mock CRM data and real local HTTP requests.
- Startup without configured token: refuses to start, with a safe message.
- `rafter secrets .`: no secrets detected.
- `npm audit --omit=dev`: zero known dependency vulnerabilities.
- Remote `rafter run`, fast mode, on the public fork's `working-branch`:
  scan ID `743f0ba5-efe1-4756-b629-afa81e958391`; completed, not partial.
  It reported two template-taint errors and one regex warning, reviewed below.

## Remote finding triage

- Template taint at `index.js:35`: the request-derived `created` local is a
  boolean comparison, not raw HTML; CRM strings reach only escaped cells in
  `views/homepage.pug:24`. False positive. The script-in-CRM test confirms escaping.
- Template taint at `index.js:62`: validated form strings reach escaped Pug
  attributes and textarea output in `views/updates.pug:17`–21. No unescaped
  interpolation exists. False positive; reflected script-input test passes.
- Unsafe regex at `index.js:23`: literal, disjoint host alternatives and one
  optional port bounded to five digits. There are no nested unbounded repeats
  or exponentially ambiguous paths. False positive; forged Host request test
  confirms rejection. The whole HTTP Host header is also bounded by Node.

These rule/path pairs are documented in `.rafter.yml` with evidence-based
suppression reasons. Other rules and files remain enabled. Follow-up scan
`199d674d-7565-49e7-b995-eed61e77caaf` completed without partial results: the regex
warning was suppressed, but both reviewed Pug false positives remained. The
configuration now includes the normalized rule ID and display title as aliases
for the same rule; no unrelated finding category was excluded.

## Live validation

On 2026-10-30, the configured token's account matched developer test account
`149667647`. Setup created Plants (`2-255799934`), three populated sample records
and a synthetic test contact, with all three plant-to-contact associations.
`npm run verify:hubspot` passed. A browser submission created **Practicum Aloe**,
redirected to the homepage, and persisted after reload. The read-only live check
then confirmed four records. The README contains the actual test-account list
view. The token remained only in the ignored local `.env` file.

All 13 automated tests passed after live setup. The local secrets scan was also
rerun after token configuration: no secrets detected; only `.env.example` is
tracked, and `.env` has no Git history.

## Final remote result

Scan `4511351d-ef14-4ddd-836a-47688ae46b2f` completed (not partial) on
2026-10-30 against `working-branch`, whose verified remote head was
`aa2fdfb0e0b73a5f45de9ff0008ff91f266948af`. Result: **0 errors, 0 warnings,
0 notes, no vulnerabilities returned**, with the reviewed false-positive
exclusions above. The service returned `scanned_commit: null`; it did not supply
an immutable commit attestation. The branch was not changed while this scan ran.
Only this documentation and the README completion status were updated afterward;
application code and scan configuration were unchanged.

Manual review, remote Rafter review, local secrets checks, automated tests and
live HubSpot/browser checks are complete. Passing these checks does not promise
Academy acceptance; the learner must review the AI-assisted code and submit the
public repository.
