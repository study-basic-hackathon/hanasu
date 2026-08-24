import { describe, expect, it } from "vitest";

import { filledSections } from "@/lib/application";
import type { Application } from "@/lib/domain";

const emptyApplication: Application = {
  id: 1,
  company_name: "株式会社テスト",
  posting_url: "",
  job_title: "",
  documents: "",
  motivation: "",
  current_position: "",
  experience_years: null,
  resume: "",
  note: "",
};

describe("filledSections", () => {
  it("空白だけの文字列は登録済みとして数えない", () => {
    expect(
      filledSections({
        ...emptyApplication,
        posting_url: "  ",
        documents: "\n",
        motivation: "\t",
        note: " ",
      }),
    ).toEqual([]);
  });

  it("入力済みの項目と、いずれかが入力済みの経歴を返す", () => {
    expect(
      filledSections({
        ...emptyApplication,
        posting_url: "https://example.com/jobs",
        documents: "応募書類",
        motivation: "志望動機",
        experience_years: 0,
        note: "補足",
      }),
    ).toEqual(["募集要項", "応募書類", "志望動機", "経歴", "備考"]);
  });
});
