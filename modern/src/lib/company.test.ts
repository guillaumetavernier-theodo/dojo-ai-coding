import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testDb = vi.hoisted(() => ({ current: null as DatabaseSync | null }));

vi.mock("@/lib/db", () => ({
  getDb: () => {
    if (!testDb.current) throw new Error("base de test non initialisée");
    return testDb.current;
  },
}));

import {
  type Company,
  ERROR_CURRENCY,
  ERROR_DATES_ORDER,
  ERROR_DATES_REQUIRED,
  formatFiscalYear,
  getCompany,
  getCompanyOrDefaults,
  SUCCESS_MESSAGE,
  saveCompany,
  submitCompany,
  validateCompany,
} from "./company";
import { seededDb } from "./test-db";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function companyRow(db: DatabaseSync) {
  return db.prepare("SELECT * FROM company WHERE id = 1").get();
}

function auditRows(db: DatabaseSync) {
  return db
    .prepare(
      "SELECT user_id, action, entity, entity_id, details FROM audit_log WHERE entity = 'company'",
    )
    .all()
    .map((row) => ({ ...row }));
}

beforeEach(() => {
  testDb.current = seededDb();
});

describe("getCompany", () => {
  it("renvoie la ligne id = 1 du seed", () => {
    expect(getCompany()).toEqual({
      currency: "EUR",
      fiscal_year_start: "2026-01-01",
      fiscal_year_end: "2026-12-31",
    });
  });

  it("getCompanyOrDefaults renvoie la société en base quand la ligne existe", () => {
    testDb.current?.exec(
      "UPDATE company SET currency = 'GBP', fiscal_year_start = '2026-04-01', fiscal_year_end = '2027-03-31' WHERE id = 1",
    );
    expect(getCompanyOrDefaults()).toEqual({
      currency: "GBP",
      fiscal_year_start: "2026-04-01",
      fiscal_year_end: "2027-03-31",
    });
  });

  describe("sans ligne company", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2031-06-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("renvoie null, et getCompanyOrDefaults l'année en cours en EUR", () => {
      testDb.current?.exec("DELETE FROM company");
      expect(getCompany()).toBeNull();
      expect(getCompanyOrDefaults()).toEqual({
        currency: "EUR",
        fiscal_year_start: "2031-01-01",
        fiscal_year_end: "2031-12-31",
      });
    });
  });
});

describe("validateCompany", () => {
  const valid: Company = {
    currency: "USD",
    fiscal_year_start: "2027-01-01",
    fiscal_year_end: "2027-12-31",
  };

  it("accepte une saisie valide", () => {
    expect(validateCompany(form(valid))).toEqual({ ok: true, value: valid });
  });

  it("exige la date de début", () => {
    const result = validateCompany(form({ ...valid, fiscal_year_start: "" }));
    expect(result).toEqual({
      ok: false,
      errors: [ERROR_DATES_REQUIRED],
      values: { ...valid, fiscal_year_start: "" },
    });
    expect(ERROR_DATES_REQUIRED).toBe("Les dates de l'exercice sont obligatoires.");
  });

  it("exige la date de fin, et cumule alors les deux messages dans l'ordre du legacy", () => {
    const result = validateCompany(form({ ...valid, fiscal_year_end: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([ERROR_DATES_REQUIRED, ERROR_DATES_ORDER]);
    expect(result.errors.join(" ")).toBe(
      "Les dates de l'exercice sont obligatoires. La date de fin doit être postérieure à la date de début.",
    );
  });

  it("refuse une date de fin égale à la date de début", () => {
    const result = validateCompany(form({ ...valid, fiscal_year_end: "2027-01-01" }));
    expect(result).toMatchObject({ ok: false, errors: [ERROR_DATES_ORDER] });
    expect(ERROR_DATES_ORDER).toBe("La date de fin doit être postérieure à la date de début.");
  });

  it("refuse une date de fin antérieure à la date de début", () => {
    const result = validateCompany(form({ ...valid, fiscal_year_end: "2026-12-31" }));
    expect(result).toMatchObject({ ok: false, errors: [ERROR_DATES_ORDER] });
  });

  it("refuse une devise hors de la liste", () => {
    const result = validateCompany(form({ ...valid, currency: "JPY" }));
    expect(result).toEqual({
      ok: false,
      errors: [ERROR_CURRENCY],
      values: { ...valid, currency: "JPY" },
    });
    expect(ERROR_CURRENCY).toBe("La devise choisie n'est pas valide.");
  });

  it.each(["EUR", "USD", "GBP", "CHF"])("accepte la devise %s", (currency) => {
    expect(validateCompany(form({ ...valid, currency })).ok).toBe(true);
  });

  it("refuse une date qui n'existe pas", () => {
    const result = validateCompany(form({ ...valid, fiscal_year_start: "2026-02-30" }));
    expect(result).toMatchObject({ ok: false, errors: [ERROR_DATES_REQUIRED] });
  });
});

describe("saveCompany", () => {
  const input: Company = {
    currency: "CHF",
    fiscal_year_start: "2027-04-01",
    fiscal_year_end: "2028-03-31",
  };

  it("met à jour la ligne existante sans changer le nom, et trace l'opération", () => {
    const db = testDb.current as DatabaseSync;
    db.exec("UPDATE company SET name = 'Autre nom' WHERE id = 1");

    saveCompany(input, 7);

    expect(companyRow(db)).toMatchObject({ id: 1, name: "Autre nom", ...input });
    expect(auditRows(db)).toEqual([
      {
        user_id: 7,
        action: "UPDATE",
        entity: "company",
        entity_id: 1,
        details: "Company settings updated",
      },
    ]);
  });

  it("crée la ligne avec le nom Ketchup Compta si elle manque", () => {
    const db = testDb.current as DatabaseSync;
    db.exec("DELETE FROM company");

    saveCompany(input, 1);

    expect(companyRow(db)).toMatchObject({ id: 1, name: "Ketchup Compta", ...input });
    expect(auditRows(db)).toEqual([
      {
        user_id: 1,
        action: "UPDATE",
        entity: "company",
        entity_id: 1,
        details: "Company settings updated",
      },
    ]);
    expect(getCompany()).toEqual(input);
  });

  it("annule la mise à jour de la société si la trace d'audit échoue", () => {
    const db = testDb.current as DatabaseSync;
    const before = companyRow(db);
    db.exec("DROP TABLE audit_log");

    expect(() => saveCompany(input, 7)).toThrow();
    expect(companyRow(db)).toEqual(before);
  });
});

describe("submitCompany", () => {
  const valid: Company = {
    currency: "GBP",
    fiscal_year_start: "2027-01-01",
    fiscal_year_end: "2027-12-31",
  };

  it("enregistre une saisie valide et renvoie le message de succès du legacy", () => {
    expect(submitCompany(form(valid), 1)).toEqual({ success: SUCCESS_MESSAGE, values: valid });
    expect(SUCCESS_MESSAGE).toBe("Paramètres de la société enregistrés.");
    expect(getCompany()).toEqual(valid);
  });

  it("refuse une saisie invalide : message du legacy, saisie conservée, rien d'écrit", () => {
    const db = testDb.current as DatabaseSync;
    const before = companyRow(db);
    const invalid = { ...valid, fiscal_year_end: "2026-06-30" };

    expect(submitCompany(form(invalid), 1)).toEqual({ error: ERROR_DATES_ORDER, values: invalid });
    expect(companyRow(db)).toEqual(before);
    expect(auditRows(db)).toEqual([]);
  });

  it("concatène plusieurs erreurs par un espace, dans l'ordre du legacy, sans rien écrire", () => {
    const db = testDb.current as DatabaseSync;
    const before = companyRow(db);
    const invalid = { ...valid, fiscal_year_end: "" };

    expect(submitCompany(form(invalid), 1)).toEqual({
      error:
        "Les dates de l'exercice sont obligatoires. La date de fin doit être postérieure à la date de début.",
      values: invalid,
    });
    expect(companyRow(db)).toEqual(before);
    expect(auditRows(db)).toEqual([]);
  });
});

describe("formatFiscalYear", () => {
  it("affiche l'exercice au format JJ/MM/AAAA - JJ/MM/AAAA", () => {
    expect(
      formatFiscalYear({
        currency: "EUR",
        fiscal_year_start: "2026-01-01",
        fiscal_year_end: "2026-12-31",
      }),
    ).toBe("01/01/2026 - 31/12/2026");
  });

  it("affiche « Non configuré » sans société", () => {
    expect(formatFiscalYear(null)).toBe("Non configuré");
  });
});
