import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type Company,
  type CompanyFormState,
  CURRENCIES,
  ERROR_DATES_ORDER,
  SUCCESS_MESSAGE,
} from "@/lib/company";

const mocks = vi.hoisted(() => ({
  company: { currency: "GBP", fiscal_year_start: "2026-04-01", fiscal_year_end: "2027-03-31" },
  session: null as { uid: number; username: string } | null,
  // État renvoyé par la server action ; `null` = l'état initial passé à `useActionState`.
  formState: null as CompanyFormState | null,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: ((_action: unknown, initial: unknown) => [
      mocks.formState ?? initial,
      () => {},
      false,
    ]) as typeof actual.useActionState,
  };
});

vi.mock("@/lib/company", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/company")>()),
  getCompanyOrDefaults: () => mocks.company,
}));
vi.mock("./actions", () => ({ saveCompanyAction: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: async () => mocks.session }));
vi.mock("@/components/AppNav", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

import AppLayout from "../../layout";
import CompanyForm from "./CompanyForm";
import Page from "./page";

describe("page /admin/societe", () => {
  it("affiche le titre, les 4 devises avec celle en base présélectionnée, les dates et le bouton", () => {
    const html = renderToStaticMarkup(<Page />);

    expect(html).toContain("<h1");
    expect(html).toContain("Paramétrage de la Société");
    const options = [...html.matchAll(/<option value="(\w+)"( selected="")?>([^<]+)<\/option>/g)];
    expect(options.map(([, code, selected, label]) => [code, label, Boolean(selected)])).toEqual([
      ["EUR", "EUR - Euro", false],
      ["USD", "USD - Dollar US", false],
      ["GBP", "GBP - Livre Sterling", true],
      ["CHF", "CHF - Franc Suisse", false],
    ]);
    expect(html).toContain("Début exercice *");
    expect(html).toContain("Fin exercice *");
    const start = html.match(/<input id="fiscal_year_start"[^>]*>/)?.[0];
    expect(start).toContain('type="date"');
    expect(start).toContain('required=""');
    expect(start).toContain('name="fiscal_year_start"');
    expect(start).toContain('value="2026-04-01"');
    const end = html.match(/<input id="fiscal_year_end"[^>]*>/)?.[0];
    expect(end).toContain('type="date"');
    expect(end).toContain('required=""');
    expect(end).toContain('name="fiscal_year_end"');
    expect(end).toContain('value="2027-03-31"');
    expect(html).toMatch(/<button type="submit"[^>]*>Enregistrer<\/button>/);
  });
});

describe("accès aux pages connectées", () => {
  beforeEach(() => {
    mocks.session = null;
  });

  it("redirige vers /login sans session", async () => {
    await expect(AppLayout({ children: <Page /> })).rejects.toThrow("redirect:/login");
  });

  it("affiche la page avec une session", async () => {
    mocks.session = { uid: 1, username: "admin" };
    const html = renderToStaticMarkup(await AppLayout({ children: <Page /> }));
    expect(html).toContain("Paramétrage de la Société");
  });
});

describe("CompanyForm après soumission", () => {
  const initial: Company = {
    currency: "EUR",
    fiscal_year_start: "2026-01-01",
    fiscal_year_end: "2026-12-31",
  };
  const form = () => <CompanyForm initial={initial} currencies={CURRENCIES} />;
  const input = (html: string, id: string) =>
    html.match(new RegExp(`<input id="${id}"[^>]*>`))?.[0];

  beforeEach(() => {
    mocks.formState = null;
  });

  it("n'affiche aucun message avant la première soumission", () => {
    const html = renderToStaticMarkup(form());
    expect(html).not.toContain("bg-red-50");
    expect(html).not.toContain("bg-green-50");
    expect(input(html, "fiscal_year_start")).toContain('value="2026-01-01"');
  });

  it("affiche l'erreur et conserve la saisie refusée, pas les valeurs initiales", () => {
    const invalid = {
      currency: "USD",
      fiscal_year_start: "2027-06-01",
      fiscal_year_end: "2027-01-01",
    };
    mocks.formState = { error: ERROR_DATES_ORDER, values: invalid };
    const html = renderToStaticMarkup(form());

    expect(html).toMatch(/<div class="[^"]*bg-red-50[^"]*">La date de fin doit être postérieure/);
    expect(html).not.toContain(SUCCESS_MESSAGE);
    expect(html).toContain('<option value="USD" selected="">');
    expect(input(html, "fiscal_year_start")).toContain('value="2027-06-01"');
    expect(input(html, "fiscal_year_end")).toContain('value="2027-01-01"');
  });

  it("affiche le succès et les valeurs enregistrées", () => {
    const valid = {
      currency: "CHF",
      fiscal_year_start: "2027-01-01",
      fiscal_year_end: "2027-12-31",
    };
    mocks.formState = { success: SUCCESS_MESSAGE, values: valid };
    const html = renderToStaticMarkup(form());

    expect(html).toMatch(
      /<div class="[^"]*bg-green-50[^"]*">Paramètres de la société enregistrés\./,
    );
    expect(html).not.toContain(ERROR_DATES_ORDER);
    expect(html).toContain('<option value="CHF" selected="">');
    expect(input(html, "fiscal_year_start")).toContain('value="2027-01-01"');
    expect(input(html, "fiscal_year_end")).toContain('value="2027-12-31"');
  });

  it("change la clé du formulaire avec les valeurs renvoyées, pour remonter les champs", () => {
    const formKey = () => {
      const tree = CompanyForm({ initial, currencies: CURRENCIES }) as ReactElement<{
        children: ReactNode[];
      }>;
      const formElement = tree.props.children.find(
        (child): child is ReactElement => (child as ReactElement | null)?.type === "form",
      );
      return formElement?.key;
    };

    mocks.formState = { values: initial };
    const before = formKey();
    mocks.formState = {
      error: ERROR_DATES_ORDER,
      values: { ...initial, fiscal_year_end: "2025-12-31" },
    };
    const after = formKey();

    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });
});
