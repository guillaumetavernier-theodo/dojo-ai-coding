"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { type CompanyFormState, submitCompany } from "@/lib/company";

export async function saveCompanyAction(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const state = submitCompany(formData, session.uid);
  if (state.success) {
    revalidatePath("/admin/societe");
    revalidatePath("/dashboard");
  }
  return state;
}
