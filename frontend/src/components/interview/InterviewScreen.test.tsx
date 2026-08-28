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
  createEvaluation: vi.fn(),
  getCompany: vi.fn(),
  push: vi.fn(),
  requestNextQuestion: vi.fn(),
  search: "",
  storeEvaluationSession: vi.fn(),
  synthesizeSpeech: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/lib/company-api", () => ({
  getCompany: mocks.getCompany,
}));

vi.mock("@/lib/evaluation-api", () => ({
  createEvaluation: mocks.createEvaluation,
}));

vi.mock("@/lib/evaluation-session", () => ({
  storeEvaluationSession: mocks.storeEvaluationSession,
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
  job_summary: null,
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
    mocks.createEvaluation.mockResolvedValue(88);
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

    expect(screen.getByRole("button", { name: "ホーム" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "中断" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "面接を終える" }),
    ).not.toBeInTheDocument();
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

  it("中断確認を取り消すと会話・通信・再生を維持する", async () => {
    render(<InterviewScreen mode="interview" />);
    submitAnswer("続ける回答です。");
    await screen.findByRole("button", { name: "停止する" });
    const audio = FakeAudio.instances[0];

    fireEvent.click(screen.getByRole("button", { name: "中断" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "評価に進みます。この会話には戻れません。",
    );
    fireEvent.click(screen.getByRole("button", { name: "取り消す" }));

    expect(screen.getByText("続ける回答です。")).toBeInTheDocument();
    expect(audio.pause).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(mocks.createEvaluation).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("中断時に再生と一時会話を破棄して評価を一度だけ開始する", async () => {
    mocks.createEvaluation.mockImplementation(() => new Promise<number>(() => undefined));
    render(<InterviewScreen mode="interview" />);
    submitAnswer("評価する回答です。");
    await screen.findByRole("button", { name: "停止する" });
    const audio = FakeAudio.instances[0];

    fireEvent.click(screen.getByRole("button", { name: "中断" }));
    const confirm = screen.getByRole("button", { name: "中断して評価に進む" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(mocks.createEvaluation).toHaveBeenCalledOnce());
    expect(mocks.createEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "評価する回答です。" }),
        ]),
      }),
    );
    expect(audio.pause).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:question-1");
    expect(screen.queryByText("評価する回答です。")).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("中断後の評価開始に失敗した場合は会話を戻して再試行できる", async () => {
    mocks.createEvaluation
      .mockRejectedValueOnce(new Error("evaluation failed"))
      .mockResolvedValueOnce(90);
    render(<InterviewScreen mode="interview" />);
    submitAnswer("再試行する回答です。");
    await screen.findByText("次の質問です。");

    fireEvent.click(screen.getByRole("button", { name: "中断" }));
    fireEvent.click(
      screen.getByRole("button", { name: "中断して評価に進む" }),
    );

    expect(
      await screen.findByText(
        "評価を開始できませんでした。時間をおいてもう一度お試しください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("再試行する回答です。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "中断" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "中断" }));
    fireEvent.click(
      screen.getByRole("button", { name: "中断して評価に進む" }),
    );

    await waitFor(() => expect(mocks.createEvaluation).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        "/evaluations/detail?id=90&from=interview",
      ),
    );
  });

  it("ホーム確認後は進行中の chat と一時会話を破棄し、評価せず一度だけ遷移する", async () => {
    let chatSignal: AbortSignal | undefined;
    mocks.requestNextQuestion.mockImplementation(
      (_input: unknown, signal?: AbortSignal) => {
        chatSignal = signal;
        return new Promise<string>(() => undefined);
      },
    );
    render(<InterviewScreen mode="interview" />);
    submitAnswer("破棄する回答です。");
    await waitFor(() => expect(mocks.requestNextQuestion).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    const confirm = screen.getByRole("button", { name: "ホームに戻る" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(chatSignal?.aborted).toBe(true);
    expect(screen.queryByText("破棄する回答です。")).not.toBeInTheDocument();
    expect(mocks.createEvaluation).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("設定した上限で終了し、会話を確認して評価を見るまでAPIと遷移を待つ", async () => {
    let resolveEvaluation!: (evaluationId: number) => void;
    mocks.search =
      "companyId=7&strength=hard&answerMethod=text&readAloud=disabled&maxTurns=2";
    mocks.requestNextQuestion.mockResolvedValue("2つ目の質問です。");
    mocks.createEvaluation.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          resolveEvaluation = resolve;
        }),
    );
    render(<InterviewScreen mode="interview" />);

    submitAnswer("1つ目の回答です。");
    expect(await screen.findByText("2つ目の質問です。")).toBeInTheDocument();
    submitAnswer("最後の回答です。");

    const finalAnswer = screen.getByText("最後の回答です。");
    const completion = await screen.findByText("お疲れ様でした");
    expect(
      finalAnswer.compareDocumentPosition(completion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(mocks.requestNextQuestion).toHaveBeenCalledOnce();
    expect(mocks.synthesizeSpeech).not.toHaveBeenCalled();
    expect(mocks.createEvaluation).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(
      screen.getByPlaceholderText("回答を入力してください"),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "文字入力で回答" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "面接を終える" }),
    ).not.toBeInTheDocument();

    const evaluationButton = screen.getByRole("button", {
      name: "評価を見る",
    });
    fireEvent.click(evaluationButton);
    expect(evaluationButton).toBeDisabled();
    fireEvent.click(evaluationButton);

    expect(mocks.createEvaluation).toHaveBeenCalledOnce();
    expect(mocks.createEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 7,
        questionStrength: "hard",
        turns: [
          expect.objectContaining({ role: "assistant" }),
          expect.objectContaining({ role: "user", content: "1つ目の回答です。" }),
          expect.objectContaining({ role: "assistant", content: "2つ目の質問です。" }),
          expect.objectContaining({ role: "user", content: "最後の回答です。" }),
        ],
      }),
    );

    resolveEvaluation(88);
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        "/evaluations/detail?id=88&from=interview",
      ),
    );
  });

  it("チュートリアルは1回答で終了し、終了表示だけではchat・TTS・評価を呼ばない", async () => {
    mocks.search = "answerMethod=text&maxTurns=25";
    render(<InterviewScreen mode="tutorial" />);

    submitAnswer("自己紹介の回答です。");

    expect(await screen.findByText("お疲れ様でした")).toBeInTheDocument();
    expect(mocks.getCompany).not.toHaveBeenCalled();
    expect(mocks.requestNextQuestion).not.toHaveBeenCalled();
    expect(mocks.synthesizeSpeech).not.toHaveBeenCalled();
    expect(mocks.createEvaluation).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(
      screen.getByPlaceholderText("回答を入力してください"),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "評価を見る" }));

    await waitFor(() => expect(mocks.createEvaluation).toHaveBeenCalledOnce());
    expect(mocks.createEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: null,
        questionStrength: null,
        turns: [
          expect.objectContaining({
            role: "assistant",
            content: "1分で自己紹介してください。",
          }),
          expect.objectContaining({
            role: "user",
            content: "自己紹介の回答です。",
          }),
        ],
      }),
    );
  });

  it("評価開始に失敗しても終了時の会話を保持し、評価を見るから再試行できる", async () => {
    mocks.search =
      "companyId=7&strength=standard&answerMethod=text&readAloud=disabled&maxTurns=1";
    mocks.createEvaluation
      .mockRejectedValueOnce(new Error("evaluation failed"))
      .mockResolvedValueOnce(89);
    render(<InterviewScreen mode="interview" />);
    submitAnswer("保持する回答です。");

    const evaluationButton = await screen.findByRole("button", {
      name: "評価を見る",
    });
    fireEvent.click(evaluationButton);

    expect(
      await screen.findByText(
        "評価を開始できませんでした。時間をおいてもう一度お試しください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("保持する回答です。")).toBeInTheDocument();
    expect(screen.getByText("お疲れ様でした")).toBeInTheDocument();
    expect(evaluationButton).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(evaluationButton);

    await waitFor(() => expect(mocks.createEvaluation).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        "/evaluations/detail?id=89&from=interview",
      ),
    );
  });
});
