import { getDb } from "@/lib/db";

/**
 * Paramètres de la société (unique ligne `company WHERE id = 1`).
 * Migré depuis `legacy/www/modules/setup/company.php`.
 */

export const CURRENCIES = [
  { code: "EUR", label: "EUR - Euro" },
  { code: "USD", label: "USD - Dollar US" },
  { code: "GBP", label: "GBP - Livre Sterling" },
  { code: "CHF", label: "CHF - Franc Suisse" },
] as const;

export type Currency = (typeof CURRENCIES)[number];

export type CurrencyCode = Currency["code"];

/** Société validée : devise parmi `CURRENCIES`, dates `AAAA-MM-JJ` existantes. */
export type Company = {
  currency: CurrencyCode;
  fiscal_year_start: string;
  fiscal_year_end: string;
};

/** Saisie brute du formulaire, avant validation. */
export type CompanyInput = {
  currency: string;
  fiscal_year_start: string;
  fiscal_year_end: string;
};

export type CompanyValidation =
  | { ok: true; value: Company }
  | { ok: false; errors: string[]; values: CompanyInput };

export const COMPANY_NAME = "Ketchup Compta";

export const ERROR_DATES_REQUIRED = "Les dates de l'exercice sont obligatoires.";
export const ERROR_DATES_ORDER = "La date de fin doit être postérieure à la date de début.";
export const ERROR_CURRENCY = "La devise choisie n'est pas valide.";

/** La ligne `company` id = 1, ou `null` si elle n'existe pas. */
export function getCompany(): Company | null {
  const row = getDb()
    .prepare("SELECT currency, fiscal_year_start, fiscal_year_end FROM company WHERE id = 1")
    .get() as Company | undefined;
  return row ? { ...row } : null;
}

/** La société en base, ou les valeurs par défaut du legacy (EUR, année en cours). */
export function getCompanyOrDefaults(): Company {
  const company = getCompany();
  if (company) return company;
  const year = new Date().getFullYear();
  return { currency: "EUR", fiscal_year_start: `${year}-01-01`, fiscal_year_end: `${year}-12-31` };
}

/** `AAAA-MM-JJ` d'une date qui existe, sinon "" (comme `parse_date` du legacy, qui renvoie vide). */
function parseDate(raw: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return "";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const exists =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return exists ? raw : "";
}

function isCurrencyCode(code: string): code is CurrencyCode {
  return CURRENCIES.some((c) => c.code === code);
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Valide le formulaire : messages du legacy, dans son ordre. */
export function validateCompany(formData: FormData): CompanyValidation {
  const values: CompanyInput = {
    currency: field(formData, "currency"),
    fiscal_year_start: field(formData, "fiscal_year_start"),
    fiscal_year_end: field(formData, "fiscal_year_end"),
  };
  const start = parseDate(values.fiscal_year_start);
  const end = parseDate(values.fiscal_year_end);

  // Mêmes tests que company.php:22-27, comparaison de chaînes comprise.
  const errors: string[] = [];
  if (!start || !end) errors.push(ERROR_DATES_REQUIRED);
  if (start >= end) errors.push(ERROR_DATES_ORDER);
  const currency = isCurrencyCode(values.currency) ? values.currency : null;
  if (!currency) errors.push(ERROR_CURRENCY);

  if (!currency || errors.length > 0) return { ok: false, errors, values };
  return {
    ok: true,
    value: { currency, fiscal_year_start: start, fiscal_year_end: end },
  };
}

/** Enregistre la société (id = 1, nom inchangé) et trace l'opération dans `audit_log`. */
export function saveCompany(input: Company, userId: number): void {
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO company (id, name, currency, fiscal_year_start, fiscal_year_end)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         currency = excluded.currency,
         fiscal_year_start = excluded.fiscal_year_start,
         fiscal_year_end = excluded.fiscal_year_end`,
    ).run(COMPANY_NAME, input.currency, input.fiscal_year_start, input.fiscal_year_end);
    db.prepare(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, details, created_at)
       VALUES (?, 'UPDATE', 'company', 1, 'Company settings updated', datetime('now'))`,
    ).run(userId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export type CompanyFormState = { success?: string; error?: string; values: CompanyInput };

export const SUCCESS_MESSAGE = "Paramètres de la société enregistrés.";

/** Soumission du formulaire : valide, enregistre si tout est bon, sinon n'écrit rien. */
export function submitCompany(formData: FormData, userId: number): CompanyFormState {
  const result = validateCompany(formData);
  if (!result.ok) return { error: result.errors.join(" "), values: result.values };
  saveCompany(result.value, userId);
  return { success: SUCCESS_MESSAGE, values: result.value };
}

/** `AAAA-MM-JJ` → `JJ/MM/AAAA` (format_date du legacy). */
function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

/** Exercice affiché sur le tableau de bord : `JJ/MM/AAAA - JJ/MM/AAAA` ou « Non configuré ». */
export function formatFiscalYear(company: Company | null): string {
  if (!company) return "Non configuré";
  return `${formatDate(company.fiscal_year_start)} - ${formatDate(company.fiscal_year_end)}`;
}
