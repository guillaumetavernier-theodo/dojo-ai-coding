### 01 · Page Société et exercice sur le tableau de bord

Migrates the legacy company settings page (`company.php`) to `/admin/societe`: currency and fiscal year, legacy validation messages, audit trail; the dashboard shows the fiscal year. Ticket: `docs/features/societe/tickets/01-page-societe.md`.

**Tested:** Vitest on an in-memory database replaying the legacy SQL: data access, validation, save and rollback; the server action (no session, user id in the audit, revalidation); page and dashboard rendering, including the year just saved.

**Left from the review:** minor, `getCompany` casts the raw row to `Company` without checking the currency; nits: the key test walks the React tree, `COMPANY_NAME` exported unused, `value`/`values` naming in `CompanyValidation`.
