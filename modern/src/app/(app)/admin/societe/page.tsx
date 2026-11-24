import type { Metadata } from "next";
import { CURRENCIES, getCompanyOrDefaults } from "@/lib/company";
import CompanyForm from "./CompanyForm";

export const metadata: Metadata = { title: "Paramétrage Société" };

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Paramétrage de la Société</h1>
      <CompanyForm initial={getCompanyOrDefaults()} currencies={CURRENCIES} />
    </div>
  );
}
