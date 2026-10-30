# Plants — Integrating With HubSpot I: Foundations Practicum

Express, Axios and Pug application based on the
[official HubSpot Academy starter](https://github.com/HubSpot-Academy/integrating-with-hubspot-i-foundations-practicum).
This fork belongs to [previnus](https://github.com/previnus/preddy-kalisetty-appadu-iwh-i-practicum).

## Developer test-account list view

<!-- test-account-list-view:start -->
**Pending:** the learner must configure the developer test account and private app.
The setup command replaces this note with the real Plants list-view link after
successful HubSpot setup. No account or object ID has been invented.
<!-- test-account-list-view:end -->

## What the app does

| Route | Behavior |
| --- | --- |
| `GET /` | Fetches plant records and all three custom properties, then renders `homepage.pug` as a table. |
| `GET /update-cobj` | Renders `updates.pug` with the required page title and creation form. |
| `POST /update-cobj` | Validates the form, creates a HubSpot CRM record, then redirects to the homepage. |

Plants have three custom string properties: **Name** (`name`), **Species**
(`species`) and **Care Notes** (`care_notes`). Name is the primary display
property and must be unique. The schema supports Contacts associations.

## Run locally

Use Node.js 22 or newer. From this repository:

```sh
npm ci --ignore-scripts
```

Copy `.env.example` to `.env` without overwriting an existing configured file.
In PowerShell, `Copy-Item .env.example .env` works for the initial copy.
Enter your settings locally:

- `HUBSPOT_ACCESS_TOKEN`: private-app token; never commit or paste into chat.
- `HUBSPOT_TEST_ACCOUNT_ID`: the numeric developer test-account ID.
- `HUBSPOT_IS_TEST_ACCOUNT`: set to `true` only after confirming the account.
- `HUBSPOT_CUSTOM_OBJECT_ID`: leave blank until the setup command fills it.
- `PORT`: defaults to `3000`.

Then run:

```sh
npm run setup:hubspot
npm run verify:hubspot
npm start
```

Open [localhost:3000](http://localhost:3000). The app binds to this computer only.
The practicum's `node index.js` command also starts the app. No hosting is needed.

## HubSpot account setup — learner participation required

1. Create a **developer test account**, not a production portal. In HubSpot,
   open **Development → Testing → Test Accounts → Create developer test account**.
   Use the Enterprise test features for custom objects.
2. Switch into the new test account. Record its account ID from the account
   selector or URL. Create **Preddy’s Practicum Private App**, using
   **Development → Legacy apps → Create legacy app → Private** where available.
3. Grant these six scopes:
   `crm.schemas.custom.read`, `crm.schemas.custom.write`,
   `crm.objects.custom.read`, `crm.objects.custom.write`,
   `crm.objects.contacts.read`, `crm.objects.contacts.write`.
4. Save the token directly in `.env`, set the account ID and confirm test-account
   status. Do not share the token in screenshots, chat, source or Git history.
5. Run `npm run setup:hubspot`. Before any CRM writes it checks the token's Hub ID
   against your configured account. It creates or reuses `practicum_plants`,
   creates three sample plants, creates/reuses the synthetic contact
   `practicum.gardener@example.com`, and associates all three samples with it.
   It saves the returned object ID to `.env` and writes the actual list-view URL
   above. Setup is restartable; it reuses the schema, sample Names and contact.
   It does not delete, silently overwrite or repair incompatible existing data.
6. Run `npm run verify:hubspot`. This read-only check verifies the account,
   schema, three populated samples and contact associations against HubSpot.

HubSpot has announced changes to new legacy private-app creation. If this option
is missing in your developer test account, consult the Academy about the current
credential method for this practicum. Existing private-app tokens still work.
Do not substitute a service key without checking its authentication and grading
requirements; the account-verification helper here expects a private-app token.
See the [official notice](https://developers.hubspot.com/changelog/legacy-private-app-creation-sunset).

The setup uses Monstera, Snake Plant and Peace Lily as synthetic samples. Setup
has multiple API calls and is not transactional. After a timeout, inspect the
test account before rerunning. If custom objects are unavailable, the supplied
practicum instructions permit a standard object; that would require adapting
this app's schema and property mappings rather than changing just the object ID.

## Verify the form and table

```sh
npm test
```

Automated tests use mock CRM responses and a real local HTTP server. They cover
all three routes, validation, HTML escaping, safe errors, paging, wrong-account
protection and repeatable setup. They do **not** prove live HubSpot access.

After live setup:

1. Run `node index.js` and open the homepage. Confirm all three samples and their
   Name, Species and Care Notes appear.
2. Select **Add to this table**, enter a uniquely named fourth plant, and select
   **Create plant**. Confirm the redirect and the new row.
3. Refresh the homepage and check the same record in HubSpot's list view.
4. Check a sample plant's contact association in HubSpot.

If a create request fails, inspect the table before resubmitting: HubSpot may
have saved the record before a response was lost. Forms opened before a server
restart must be reopened. Validation errors preserve the entered values.

## Credentials and dependencies

`.env`, `.env.*` (except `.env.example`) and `node_modules/` are ignored.
`package-lock.json` is tracked. The token is used only on the server over HTTPS.
API errors are reported without logging request headers, bodies or tokens.
The [security design](docs/security-design.md) records the local-only boundaries.

Check `git check-ignore .env` before staging. Use explicit file paths when
committing. Rotate a token in HubSpot immediately if it is exposed.

## Git history and final submission

Development takes place on `working-branch`, created from this fork's `main`.
Commits reflect actual implementation steps; no backdating or fabricated edits.
Review the AI-assisted implementation and understand the code before submission.
The Academy requires the learner's own work and reviews revision history.

Before submitting, finish live verification, confirm the real list-view link
above, complete the required Rafter review and merge `working-branch` into `main`.
Submit the public repository URL, not localhost or a preview:

https://github.com/previnus/preddy-kalisetty-appadu-iwh-i-practicum

The practicum has not been submitted by this app. Account provisioning, live
verification and the final merge are separate steps from passing mock tests.

## API references

- [Express routing](https://expressjs.com/en/guide/routing.html)
- [Axios instances](https://axios-http.com/docs/instance)
- [Pug escaped interpolation](https://pugjs.org/language/interpolation.html)
- [HubSpot custom object schemas](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/schemas/guide)
- [HubSpot custom object records](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/custom-objects/guide)
- [HubSpot associations](https://developers.hubspot.com/docs/api-reference/latest/crm/associations/associate-records/guide)
- [HubSpot private apps](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview)
