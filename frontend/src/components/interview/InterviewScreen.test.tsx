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
  audioPlay: vi.fn(),
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

class FakeAudio {
  static instances: FakeAudio[] = [];

  src = "";
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly pause = vi.fn();
  readonly play = vi.fn(() => mocks.audioPlay());

  constructor() {
    FakeAudio.instances.push(this);
  }
}

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
  const createObjectURL = vi.fn(() => "blob:question-1");
  const revokeObjectURL = vi.fn();
  let objectUrlIndex = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    objectUrlIndex = 0;
    FakeAudio.instances = [];
    mocks.search =
      "companyId=7&strength=standard&answerMethod=text&readAloud=enabled&maxTurns=10";
    mocks.getCompany.mockResolvedValue(company);
    mocks.requestNextQuestion.mockResolvedValue("次の質問です。");
    mocks.synthesizeSpeech.mockResolvedValue(
      new Blob(["mp3"], { type: "audio/mpeg" }),
    );
    mocks.audioPlay.mockResolvedValue(undefined);
    createObjectURL.mockImplementation(
      () => `blob:question-${++objectUrlIndex}`,
    );
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    class FakeURL extends URL {}
    Object.assign(FakeURL, { createObjectURL, revokeObjectURL });
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("URL", FakeURL);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function submitAnswer(content: string) {
    fireEvent.change(screen.getByPlaceholderText("回答を入力してください"), {
      target: { value: content },
    });
    fireEvent.click(screen.getByRole("button", { name: "送信する" }));
  }

  it("開始前の選択を表示直後に反映し、会話と回答方式を保ったまま切り替える", async () => {
    render(<InterviewScreen mode="interview" />);

    expect(
      screen.getByRole("button", { name: "読み上げモード: 読み上げる" }),
    ).toHaveAttribute("aria-pressed", "true");

    submitAnswer("回答を送ります。");

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

  it("AI返答をログへ追加してから同じ文章全体を1回だけ自動再生する", async () => {
    mocks.synthesizeSpeech.mockImplementation(async (text: string) => {
      expect(screen.getByText(text)).toBeInTheDocument();
      return new Blob(["mp3"], { type: "audio/mpeg" });
    });
    render(<InterviewScreen mode="interview" />);

    submitAnswer("1つ目の回答です。");

    expect(await screen.findByText("次の質問です。")).toBeInTheDocument();
    await waitFor(() => expect(mocks.synthesizeSpeech).toHaveBeenCalledOnce());
    expect(mocks.synthesizeSpeech).toHaveBeenCalledWith(
      "次の質問です。",
      expect.any(AbortSignal),
    );
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe("blob:question-1");
    expect(FakeAudio.instances[0].play).toHaveBeenCalledOnce();
  });

  it("読み上げないモードではTTSを自動送信せず会話と回答操作を続ける", async () => {
    mocks.search =
      "companyId=7&strength=standard&answerMethod=text&readAloud=disabled&maxTurns=10";
    render(<InterviewScreen mode="interview" />);

    submitAnswer("読み上げない回答です。");

    expect(await screen.findByText("次の質問です。")).toBeInTheDocument();
    expect(mocks.synthesizeSpeech).not.toHaveBeenCalled();
    expect(
      screen.getByPlaceholderText("回答を入力してください"),
    ).toBeEnabled();
    expect(
      screen.getAllByRole("button", { name: "読み上げる" }),
    ).toHaveLength(2);
  });

  it("モードOFFで再生を停止してObject URLを解放する", async () => {
    render(<InterviewScreen mode="interview" />);
    submitAnswer("回答です。");
    await screen.findByRole("button", { name: "停止する" });
    const audio = FakeAudio.instances[0];

    fireEvent.click(
      screen.getByRole("button", { name: "読み上げモード: 読み上げない" }),
    );

    await waitFor(() => expect(audio.pause).toHaveBeenCalled());
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:question-1");
    expect(screen.getAllByRole("button", { name: "読み上げる" })).toHaveLength(
      2,
    );
  });

  it("モードOFFで生成中のTTSを中断し、遅いレスポンスを再生しない", async () => {
    let signal: AbortSignal | undefined;
    mocks.synthesizeSpeech.mockImplementation(
      (_text: string, requestSignal?: AbortSignal) => {
        signal = requestSignal;
        return new Promise<Blob>(() => undefined);
      },
    );
    render(<InterviewScreen mode="interview" />);
    submitAnswer("回答です。");
    await screen.findByRole("button", { name: "音声を準備しています" });

    fireEvent.click(
      screen.getByRole("button", { name: "読み上げモード: 読み上げない" }),
    );

    expect(signal?.aborted).toBe(true);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("連続するAI返答では同じAudioを使い、先の音声を停止・解放する", async () => {
    mocks.requestNextQuestion
      .mockResolvedValueOnce("1つ目の質問です。")
      .mockResolvedValueOnce("2つ目の質問です。");
    render(<InterviewScreen mode="interview" />);

    submitAnswer("1つ目の回答です。");
    expect(await screen.findByText("1つ目の質問です。")).toBeInTheDocument();
    await screen.findByRole("button", { name: "停止する" });
    const audio = FakeAudio.instances[0];

    submitAnswer("2つ目の回答です。");

    expect(await screen.findByText("2つ目の質問です。")).toBeInTheDocument();
    await waitFor(() => expect(mocks.synthesizeSpeech).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
    expect(FakeAudio.instances).toHaveLength(1);
    expect(audio.pause).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:question-1");
    expect(audio.src).toBe("blob:question-2");
  });

  it("TTS失敗を表示し、会話を止めず発言単位で再試行できる", async () => {
    mocks.synthesizeSpeech
      .mockRejectedValueOnce(new Error("tts failed"))
      .mockResolvedValueOnce(new Blob(["mp3"], { type: "audio/mpeg" }));
    render(<InterviewScreen mode="interview" />);
    submitAnswer("回答です。");

    const retry = await screen.findByRole("button", {
      name: "読み上げられませんでした。再試行する",
    });
    expect(screen.getByText("次の質問です。")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("回答を入力してください"),
    ).toBeEnabled();

    fireEvent.click(retry);

    await screen.findByRole("button", { name: "停止する" });
    expect(mocks.synthesizeSpeech).toHaveBeenCalledTimes(2);
  });

  it("自動再生拒否を表示し、手動操作から再試行できる", async () => {
    mocks.audioPlay
      .mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"))
      .mockResolvedValueOnce(undefined);
    render(<InterviewScreen mode="interview" />);
    submitAnswer("回答です。");

    const retry = await screen.findByRole("button", {
      name: "読み上げられませんでした。再試行する",
    });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:question-1");

    fireEvent.click(retry);

    await screen.findByRole("button", { name: "停止する" });
    expect(mocks.synthesizeSpeech).toHaveBeenCalledTimes(2);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].play).toHaveBeenCalledTimes(2);
  });

  it("音声要素の再生失敗を表示し、発言単位で再試行できる", async () => {
    render(<InterviewScreen mode="interview" />);
    submitAnswer("回答です。");
    await screen.findByRole("button", { name: "停止する" });
    const audio = FakeAudio.instances[0];

    audio.onerror?.();

    const retry = await screen.findByRole("button", {
      name: "読み上げられませんでした。再試行する",
    });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:question-1");
    expect(
      screen.getByPlaceholderText("回答を入力してください"),
    ).toBeEnabled();

    fireEvent.click(retry);

    await screen.findByRole("button", { name: "停止する" });
    expect(mocks.synthesizeSpeech).toHaveBeenCalledTimes(2);
  });

  it("画面離脱時に再生を停止してObject URLを解放する", async () => {
    const view = render(<InterviewScreen mode="interview" />);
    submitAnswer("回答です。");
    await screen.findByRole("button", { name: "停止する" });
    const audio = FakeAudio.instances[0];

    view.unmount();

    expect(audio.pause).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:question-1");
  });
});
