import { apiRequest, jsonRequest } from "@/lib/api-client";

/** 現在の FastAPI 実装が返す応募企業情報。#17 完了後に画面型と統合する。 */
export type Company = {
  id: number;
  company_name: string;
  motivation: string | null;
  resume: string | null;
  company_url: string | null;
  note: string | null;
  created_at: string;
};

export type CompanyInput = {
  company_name: string;
  motivation: string;
  resume?: string | null;
  company_url?: string | null;
  note?: string | null;
};

export function listCompanies(signal?: AbortSignal): Promise<Company[]> {
  return apiRequest<Company[]>("/companies", { signal });
}

export function getCompany(
  companyId: number,
  signal?: AbortSignal,
): Promise<Company> {
  return apiRequest<Company>(`/companies/${companyId}`, { signal });
}

export function createCompany(input: CompanyInput): Promise<Company> {
  return jsonRequest<Company>("/companies", "POST", input);
}

export function updateCompany(
  companyId: number,
  input: CompanyInput,
): Promise<Company> {
  return jsonRequest<Company>(`/companies/${companyId}`, "PUT", input);
}

export function deleteCompany(companyId: number): Promise<void> {
  return apiRequest<void>(
    `/companies/${companyId}`,
    { method: "DELETE" },
    { responseType: "none" },
  );
}
