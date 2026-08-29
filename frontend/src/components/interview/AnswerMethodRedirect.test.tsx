import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnswerMethodRedirect } from "@/components/interview/AnswerMethodRedirect";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

describe("AnswerMethodRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = "";
  });

  afterEach(() => cleanup());

  it.each([
    {
      label: "音声",
      search: "companyId=7&strength=hard&answerMethod=voice&maxTurns=3",
      expected: "/interview/voice?companyId=7&strength=hard&maxTurns=3",
    },
    {
      label: "文字入力",
      search: "companyId=7&strength=hard&answerMethod=text&maxTurns=3",
      expected: "/interview/text?companyId=7&strength=hard&maxTurns=3",
    },
    {
      label: "未指定",
      search: "companyId=7&maxTurns=3",
      expected: "/interview/voice?companyId=7&maxTurns=3",
    },
    {
      label: "不正な値",
      search: "companyId=7&answerMethod=unexpected",
      expected: "/interview/voice?companyId=7",
    },
    { label: "クエリなし", search: "", expected: "/interview/voice" },
  ])(
    "旧URLの回答方式 $label を方式ごとのページへ送り、他の設定を保つ",
    ({ search, expected }) => {
      mocks.search = search;

      render(<AnswerMethodRedirect mode="interview" />);

      expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(expected);
      expect(screen.getByText("面接を準備しています。")).toBeInTheDocument();
    },
  );

  it("チュートリアルの旧URLも方式ごとのページへ送る", () => {
    mocks.search = "answerMethod=text&readAloud=disabled";

    render(<AnswerMethodRedirect mode="tutorial" />);

    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
      "/tutorial/text?readAloud=disabled",
    );
    expect(
      screen.getByText("チュートリアルを準備しています。"),
    ).toBeInTheDocument();
  });
});
