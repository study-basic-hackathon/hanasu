import type { Application } from "@/lib/domain";

/**
 * 「登録済みの情報」の区分（S-06 3.1）。
 * 企業名・職種は区分に数えない。企業名は必須で、職種は別の列に出るため。
 */
export function filledSections(application: Application): string[] {
  const filled = (value: string) => value.trim() !== "";
  const sections: string[] = [];

  if (filled(application.posting_url)) sections.push("募集要項");
  if (filled(application.documents)) sections.push("応募書類");
  if (filled(application.motivation)) sections.push("志望動機");
  // 経歴は「現職 / 直近の所属・経験年数・経歴・実績」のいずれかが入っていれば数える
  if (
    filled(application.current_position) ||
    application.experience_years !== null ||
    filled(application.resume)
  ) {
    sections.push("経歴");
  }
  if (filled(application.note)) sections.push("備考");

  return sections;
}
