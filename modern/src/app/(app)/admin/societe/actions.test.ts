import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CompanyFormState, getCompany, SUCCESS_MESSAGE } from "@/lib/company";
import { seededDb } from "@/lib/test-db";

const mocks = vi.hoisted(() => ({
  db: null as DatabaseSync | null,
  session: null as { uid: number; username: string } | null,
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => {
    if (!mocks.db) throw new Error("base de test non initialisée");
    return mocks.db;
  },
}));
vi.mock("@/lib/auth", () => ({ getSession: async () => mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

import { saveCompanyAction } from "./actions";

const initial: CompanyFormState = {
  values: { currency: "EUR", fiscal_year_start: "2026-01-01", fiscal_year_end: "2026-12-31" },
};
const valid = { currency: "CHF", fiscal_year_start: "2027-01-01", fiscal_year_end: "2027-12-31" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function auditUserIds(): unknown[] {
  return (mocks.db as DatabaseSync)
    .prepare("SELECT user_id FROM audit_log WHERE entity = 'company'")
    .all()
    .map((row) => row.user_id);
}

describe("saveCompanyAction", () => {
  beforeEach(() => {
    mocks.db = seededDb();
    mocks.session = null;
    mocks.revalidatePath.mockClear();
  });

  it("redirige vers /login sans session, sans rien écrire", async () => {
    const before = getCompany();
    await expect(saveCompanyAction(initial, form(valid))).rejects.toThrow("redirect:/login");
    expect(getCompany()).toEqual(before);
    expect(auditUserIds()).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("enregistre au nom de l'utilisateur connecté et revalide la page et le tableau de bord", async () => {
    mocks.session = { uid: 7, username: "compta" };
    const state = await saveCompanyAction(initial, form(valid));
    expect(state).toEqual({ success: SUCCESS_MESSAGE, values: valid });
    expect(getCompany()).toEqual(valid);
    expect(auditUserIds()).toEqual([7]);
    expect(mocks.revalidatePath.mock.calls).toEqual([["/admin/societe"], ["/dashboard"]]);
  });

  it("ne revalide rien sur une saisie invalide", async () => {
    mocks.session = { uid: 7, username: "compta" };
    const state = await saveCompanyAction(initial, form({ ...valid, fiscal_year_end: "" }));
    expect(state.error).toBeDefined();
    expect(auditUserIds()).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
