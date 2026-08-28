import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewScreen } from "@/components/interview/InterviewScreen";

const mocks = vi.hoisted(() => ({
  getCompany: vi.fn(),
  push: vi.fn(),
  requestNextQuestion: vi.fn(),
  search: "",
  synthesizeSpeech: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/lib/company-api", () => ({
  getCompany: mocks.getCompany,
}));

vi.mock("@/lib/interview-api", () => ({
  requestNextQuestion: mocks.requestNextQuestion,
  synthesizeSpeech: mocks.synthesizeSpeech,
  transcribeAudio: vi.fn(),
}));

const company = {
  id: 7,
  company_name: "株式会社テスト",
  motivation: null,
  resume: null,
  company_url: null,
  note: null,
  created_at: "2026-08-28T00:00:00Z",
};

describe("InterviewScreen の読み上げモード", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompany.mockResolvedValue(company);
    mocks.requestNextQuestion.mockResolvedValue("次の質問です。");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  it("開始前の選択を表示直後に反映し、会話と回答方式を保ったまま切り替える", async () => {
    mocks.search =
      "companyId=7&strength=standard&answerMethod=text&readAloud=enabled&maxTurns=10";
    render(<InterviewScreen mode="interview" />);

    expect(
      screen.getByRole("button", { name: "読み上げモード: 読み上げる" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByPlaceholderText("回答を入力してください"), {
      target: { value: "回答を送ります。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "送信する" }));

    expect(await screen.findByText("次の質問です。")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "読み上げモード: 読み上げない" }),
    );

    expect(screen.getByText("回答を送ります。")).toBeInTheDocument();
    expect(screen.getByText("次の質問です。")).toBeInTheDocument();
    expect(screen.getByText("回答方式：文字入力")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("回答を入力してください"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "読み上げモード: 読み上げない" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("不正なURL値は読み上げないへフォールバックする", async () => {
    mocks.search =
      "companyId=7&strength=standard&answerMethod=voice&readAloud=unexpected&maxTurns=10";
    render(<InterviewScreen mode="interview" />);

    await waitFor(() => expect(mocks.getCompany).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: "読み上げモード: 読み上げない" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
