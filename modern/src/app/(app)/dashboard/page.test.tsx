import type { DatabaseSync } from "node:sqlite";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitCompany } from "@/lib/company";
import { seededDb } from "@/lib/test-db";

const testDb = vi.hoisted(() => ({ current: null as DatabaseSync | null }));

vi.mock("@/lib/db", () => ({
  getDb: () => {
    if (!testDb.current) throw new Error("base de test non initialisée");
    return testDb.current;
  },
}));

import DashboardPage from "./page";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("tableau de bord", () => {
  beforeEach(() => {
    testDb.current = seededDb();
  });

  it("affiche le bloc Exercice de la société en base, au format JJ/MM/AAAA - JJ/MM/AAAA", () => {
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain("Exercice");
    expect(html).toContain("01/01/2026 - 31/12/2026");
  });

  it("affiche l'exercice qui vient d'être enregistré", () => {
    submitCompany(
      form({ currency: "GBP", fiscal_year_start: "2027-01-01", fiscal_year_end: "2027-12-31" }),
      1,
    );
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain("01/01/2027 - 31/12/2027");
    expect(html).not.toContain("01/01/2026 - 31/12/2026");
  });

  it("affiche « Non configuré » sans société", () => {
    testDb.current?.exec("DELETE FROM company");
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain("Non configuré");
  });

  it("garde le message d'accueil et le bouton vers la page Société", () => {
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain("Bienvenue dans Ketchup Compta");
    expect(html).toMatch(/<a [^>]*href="\/admin\/societe"[^>]*>Commencer par « Société »<\/a>/);
  });

  it("est rendu à chaque requête, pour ne pas servir un exercice périmé", async () => {
    expect((await import("./page")).dynamic).toBe("force-dynamic");
  });
});
