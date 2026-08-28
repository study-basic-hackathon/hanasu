import { describe, expect, it } from "vitest";

import { filledSections } from "@/lib/application";
import type { Application } from "@/lib/domain";

const emptyApplication: Application = {
  id: 1,
  company_name: "株式会社テスト",
  company_url: "",
  motivation: "",
  resume: "",
  note: "",
  job_summary: "",
};

describe("filledSections", () => {
  it("空白だけの文字列は登録済みとして数えない", () => {
    expect(
      filledSections({
        ...emptyApplication,
        company_url: "  ",
        job_summary: "\n",
        motivation: "\t",
        note: " ",
      }),
    ).toEqual([]);
  });

  it("入力済みの項目と、いずれかが入力済みの経歴を返す", () => {
    expect(
      filledSections({
        ...emptyApplication,
        job_summary: "募集要項の要約",
        motivation: "志望動機",
        resume: "経歴・実績",
        note: "補足",
      }),
    ).toEqual(["募集要項", "志望動機", "経歴", "備考"]);
  });
});
