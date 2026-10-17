# Harbor — campus care preview

A small, responsive JavaScript-only campus care app. It runs as a static site and stores practice reports in the current browser with `localStorage`.

> **Local browser storage is not secure case management.** Reports and updates persist on this device, in readable browser storage. They are not encrypted, backed up, shared with campus staff, or monitored. The account switch is a public client-side role simulation, not authentication or access control. Do not enter real identities, contact details, or incident information. Use fictional practice information only.

## Working features

- Submit practice reports with anonymous or contact preference, incident description, date, location, and requested support.
- Generate a local reference code and look up report status and updates from this browser.
- Sign in to separate case-staff and committee interfaces, update case status, and add an update visible in the local reference lookup.
- Review possible keyword overlaps between reports. Similarity checks run locally, may be wrong, show no report text in the committee view, and never link reports automatically. A reviewer must record a reason before dismissing or marking a suggestion reviewed.
- Clear saved reports and review decisions from the staff screen.

After reviewing a suggestion and entering a reason, a committee account can explicitly record a link. This is a manual local decision, not an automated finding or action. Case status changes, updates, reviewer decisions, and activity history persist in browser storage, but that history is not tamper-resistant.

Data is available only in the same browser profile on the same device. Clearing browser data or changing browsers removes access. There is no server synchronization, notifications, secure authentication, encryption, or tamper-resistant audit log. This JavaScript-only setup is suitable for fictional practice data and interface testing, not real confidential reporting.

## Run locally

Open `index.html` in a browser, or serve the folder with any static HTTP server. For example:

```sh
npx serve .
```

## Deploy the front end to Vercel

1. Import this folder as a Vercel project (or run `vercel` from its root).
2. Select **Other** as the framework preset.
3. Leave the build command and output directory blank; the site is served directly from the project root.
4. Deploy. Browser storage is scoped to each visitor’s browser; accounts and reports do not sync between people or devices.

## Local accounts

Choose **Staff workspace** or **   profile** in the navigation to open account sign-in. Use the quick sign-in buttons or enter these local test credentials:

| Role | Username | Password |
| --- | --- | --- |
| Case staff | `staff@harbor.test` | `HarborStaff26!` |
| Committee member | `committee@harbor.test` | `HarborCommittee26!` |

These fixed credentials are public and visible in the page source. The role check only changes the visible interface; anyone can bypass it. Do not reuse these passwords or treat this as protection for real reports.

## Java backend and deployment architecture

As of October 2026, Vercel’s [official Functions runtimes](https://vercel.com/docs/functions/runtimes) do not include a native Java runtime. Vercel’s [Container Runtime](https://vercel.com/docs/functions/runtimes/container) can run arbitrary OCI images, including Java, but it is in beta and follows a request-driven Functions model: idle instances scale down and are subject to Functions limits. It may suit a carefully tested, stateless Java API, but it is not the default choice for a dependable, always-on case-management service.

For a production deployment, keep this static front end on Vercel and host the Java API (for example, Spring Boot) as a managed container service with durable managed storage and backups. Connect the front end to the API over HTTPS using a configured API origin. The API and storage must be in institution-approved regions and protected by institutional identity, role-based authorization, and operational controls. A Vercel container can be evaluated as an alternative only after verifying its beta availability, limits, database connectivity, security requirements, and recovery behavior with the institution.

Before connecting any API:

- Replace the sample campus-resource links in `index.html` with verified local resources.
- Implement institution-approved authentication, secure reporter verification, case-staff and committee roles, and authorization on every API operation. A hidden tab or front-end route is not access control.
- Encrypt traffic and sensitive data at rest; keep secrets on the server; apply rate limits; avoid PII in URLs, analytics, logs, and error responses; and maintain tamper-resistant access/change audit records.
- Define retention and deletion periods with the institution and implement them in storage and backups.
- Use no external language-processing provider unless the institution has approved it and its privacy terms. Do not use reports to train models. Make any similarity output de-identified and visible only to specifically authorized committee members.
- Keep reports unlinked until a trained human reviewer documents a valid purpose and decides whether a link is appropriate. Suggestions are leads, never findings or proof.

## Roles and privacy boundaries

- **Reporter:** submits a report, chooses whether to provide contact details where policy permits, and checks updates through a protected channel. Anonymous reports can limit follow-up.
- **Case staff:** authorized staff review assigned reports, record actions, arrange support, and manage follow-up. Access should be limited to cases needed for their work.
- **Authorized committee:** a specifically approved, purpose-limited group may review de-identified pattern suggestions. It should not see identities or full report details unless explicitly necessary and authorized.

Confidentiality is not an absolute promise. A live service must clearly explain who can access a report and any safety or legal limits before submission. Staff—not language tools—decide what a report means, whether reports may be linked, and what action to take.

## Pattern-suggestion review

Language processing in a production service should only help clarify text or surface possible similarities. A trained, authorized human must review each suggestion, consider alternative explanations and privacy impacts, document the reason for any link, and decide whether further action is appropriate. A similarity score or model output must never be treated as a finding or proof.
