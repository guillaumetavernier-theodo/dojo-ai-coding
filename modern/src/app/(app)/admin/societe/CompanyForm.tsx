"use client";

import { useActionState } from "react";
import type { Company, CompanyFormState, Currency } from "@/lib/company";
import { saveCompanyAction } from "./actions";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-tomato-500 focus:ring-2 focus:ring-tomato-100";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

// Imports de types seulement : `@/lib/company` lit la base, il reste côté serveur.
export default function CompanyForm({
  initial,
  currencies,
}: {
  initial: Company;
  currencies: readonly Currency[];
}) {
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(
    saveCompanyAction,
    { values: initial },
  );
  const values = state.values;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      {state.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      {/* La clé remonte les champs à chaque réponse : ils affichent les valeurs renvoyées. */}
      <form key={JSON.stringify(values)} action={formAction} className="space-y-4">
        <div>
          <label htmlFor="currency" className={labelClass}>
            Devise
          </label>
          <select
            id="currency"
            name="currency"
            defaultValue={values.currency}
            className={inputClass}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="fiscal_year_start" className={labelClass}>
              Début exercice *
            </label>
            <input
              id="fiscal_year_start"
              name="fiscal_year_start"
              type="date"
              required
              defaultValue={values.fiscal_year_start}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="fiscal_year_end" className={labelClass}>
              Fin exercice *
            </label>
            <input
              id="fiscal_year_end"
              name="fiscal_year_end"
              type="date"
              required
              defaultValue={values.fiscal_year_end}
              className={inputClass}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-tomato-600 px-5 py-2.5 font-semibold text-white transition hover:bg-tomato-700 disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
