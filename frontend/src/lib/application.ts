type ApplicationSections = {
  company_url: string | null;
  motivation: string | null;
  resume: string | null;
  note: string | null;
  job_summary: string | null;
};

/**
 * 「登録済みの情報」の区分（S-06 3.1）。
 * 企業名は必須で別の列に出るため、区分には数えない。
 */
export function filledSections(application: ApplicationSections): string[] {
  const filled = (value: string | null) =>
    typeof value === "string" && value.trim() !== "";
  const sections: string[] = [];

  if (filled(application.company_url) || filled(application.job_summary)) {
    sections.push("募集要項");
  }
  if (filled(application.motivation)) sections.push("志望動機");
  if (filled(application.resume)) sections.push("経歴");
  if (filled(application.note)) sections.push("備考");

  return sections;
}
