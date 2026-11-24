import Link from "next/link";
import { formatFiscalYear, getCompany } from "@/lib/company";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Exercice</h2>
        <p className="mt-2 text-lg font-semibold">{formatFiscalYear(getCompany())}</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <span className="text-5xl">🍅</span>
        <h1 className="mt-4 text-2xl font-bold">Bienvenue dans Ketchup Compta</h1>
        <p className="mx-auto mt-3 max-w-md text-gray-500">
          Le squelette de l&apos;application moderne est en place : connexion, navigation et
          structure. La migration des pages métier commence ici — choisis une page dans le menu et
          lance-toi avec Claude Code.
        </p>
        <Link
          href="/admin/societe"
          className="mt-6 inline-block rounded-xl bg-tomato-600 px-5 py-2.5 font-semibold text-white transition hover:bg-tomato-700"
        >
          Commencer par « Société »
        </Link>
      </div>
    </div>
  );
}
