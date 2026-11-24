Migrates the legacy company settings page (`legacy/www/modules/setup/company.php`) to `/admin/societe`: currency and fiscal year, with the legacy validation messages and the `audit_log` entry, and shows the fiscal year on the dashboard.

Ticket: `docs/features/societe/tickets/01-page-societe.md`.

**Tested:** Vitest on an in-memory database replaying the legacy SQL: data access (with and without a company row), validation, save and rollback; `saveCompanyAction` (no session redirects, session user in the audit, revalidation only on success); page and dashboard rendering, including the fiscal year just saved.

**Left from the review:** minor, `getCompany` casts the raw row to `Company` without checking the currency; nits: the form key test walks the React tree, `COMPANY_NAME` exported unused, `value`/`values` naming in `CompanyValidation`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
