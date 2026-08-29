import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InterviewInputProps } from "@/components/interview/InterviewInput";
import { InterviewScreen } from "@/components/interview/InterviewScreen";
import { TextAnswerPanel } from "@/components/interview/TextAnswerPanel";
import type { ChatTurn } from "@/lib/domain";
import { FIRST_QUESTION, TUTORIAL_QUESTION } from "@/lib/interview";

/** 回答方式はページで決まる。共通シェルの検証は文字入力の入力パネルで行う */
const screenProps = {
  answerMethod: "text",
  InputPanel: TextAnswerPanel,
} as const;

/** 入力パネルへ渡す値と、そこからの変更を確かめるための差し込み */
function ProbeInputPanel({
  interviewerSpeaking,
  speechPlaybackRate,
  onChangeSpeechPlaybackRate,
}: InterviewInputProps) {
  return (
    <div>
      <span>面接官の発話: {interviewerSpeaking ? "あり" : "なし"}</span>
      <span>読み上げ速度: {speechPlaybackRate.toFixed(1)}</span>
      <button type="button" onClick={() => onChangeSpeechPlaybackRate(1.8)}>
        速度を上げる
      </button>
    </div>
  );
}

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
  playbackRate = 1;
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
      "companyId=7&strength=standard&readAloud=disabled&maxTurns=10";
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

  function enableReadAloud() {
    fireEvent.click(
      screen.getByRole("button", { name: "読み上げモード: 読み上げる" }),
    );
  }

  it("本番モードの文字起こし表示はフィラーありを初期値とし、会話APIを呼ばずに切り替える", () => {
    render(<InterviewScreen mode="interview" {...screenProps} />);

    const cleanButton = screen.getByRole("button", {
      name: "文字起こし表示: フィラーなし",
    });
    const rawButton = screen.getByRole("button", {
      name: "文字起こし表示: フィラーあり",
    });
    expect(cleanButton).toHaveAttribute("aria-pressed", "false");
    expect(rawButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(cleanButton);

    expect(cleanButton).toHaveAttribute("aria-pressed", "true");
    expect(rawButton).toHaveAttribute("aria-pressed", "false");
    expect(mocks.requestNextQuestion).not.toHaveBeenCalled();
    expect(mocks.createEvaluation).not.toHaveBeenCalled();
    expect(mocks.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("開始前の選択を表示直後に反映し、会話を保ったまま読み上げを切り替える", async () => {
    mocks.search =
      "companyId=7&strength=standard&readAloud=enabled&maxTurns=10";
    render(<InterviewScreen mode="interview" {...screenProps} />);

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

  it("カスタム質問強度を表示し、自然言語の指示を会話APIへ毎ターン送る", async () => {
    const instruction = "回答の根拠を数値で確認してください";
    mocks.search =
      `companyId=7&strength=custom&customQuestionStrength=${encodeURIComponent(instruction)}` +
      "&readAloud=disabled&maxTurns=3";
    render(<InterviewScreen mode="interview" {...screenProps} />);

    expect(screen.getByText("質問の強度：カスタム")).toBeVisible();

    submitAnswer("1つ目の回答です。");
    await screen.findByText("次の質問です。");
    submitAnswer("2つ目の回答です。");

    await waitFor(() =>
      expect(mocks.requestNextQuestion).toHaveBeenCalledTimes(2),
    );
    const inputs = mocks.requestNextQuestion.mock.calls.map(([input]) => input);
    expect(inputs).toEqual([
      expect.objectContaining({
        questionStrength: "custom",
        customQuestionStrength: instruction,
      }),
      expect.objectContaining({
        questionStrength: "custom",
        customQuestionStrength: instruction,
      }),
    ]);
  });

  it("最初の固定質問をログへ表示してから文章全体を1回だけ自動再生する", async () => {
    mocks.search =
      "companyId=7&strength=standard&readAloud=enabled&maxTurns=10";
    mocks.synthesizeSpeech.mockImplementation(async (text: string) => {
      expect(screen.getByText(text)).toBeInTheDocument();
      return new Blob(["mp3"], { type: "audio/mpeg" });
    });

    render(
      <StrictMode>
        <InterviewScreen mode="interview" {...screenProps} />
      </StrictMode>,
    );

    expect(screen.getByText(FIRST_QUESTION)).toBeInTheDocument();
    await waitFor(() => expect(mocks.synthesizeSpeech).toHaveBeenCalledOnce());
    expect(mocks.synthesizeSpeech).toHaveBeenCalledWith(
      FIRST_QUESTION,
      expect.any(AbortSignal),
    );
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe("blob:question-1");
    expect(FakeAudio.instances[0].playbackRate).toBe(1.2);
    expect(FakeAudio.instances[0].play).toHaveBeenCalledOnce();
  });

  it.each(["", "readAloud=unexpected"])(
    "欠落・不正な読み上げURL値 %s は読み上げるへフォールバックする",
    async (readAloudQuery) => {
    mocks.search =
      `companyId=7&strength=standard&${readAloudQuery}&maxTurns=10`;
    render(<InterviewScreen mode="interview" {...screenProps} />);

    await waitFor(() => expect(mocks.getCompany).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: "読み上げモード: 読み上げる" }),
    ).toHaveAttribute("aria-pressed", "true");
    },
  );

  it("AI返答をログへ追加してから同じ文章全体を1回だけ自動再生する", async () => {
    mocks.synthesizeSpeech.mockImplementation(async (text: string) => {
      expect(screen.getByText(text)).toBeInTheDocument();
      return new Blob(["mp3"], { type: "audio/mpeg" });
    });
    render(<InterviewScreen mode="interview" {...screenProps} />);
    enableReadAloud();

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
      "companyId=7&strength=standard&readAloud=disabled&maxTurns=10";
    render(<InterviewScreen mode="interview" {...screenProps} />);

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
    render(<InterviewScreen mode="interview" {...screenProps} />);
    enableReadAloud();
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
    render(<InterviewScreen mode="interview" {...screenProps} />);
    enableReadAloud();
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
    render(<InterviewScreen mode="interview" {...screenProps} />);
    enableReadAloud();

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
    render(<InterviewScreen mode="interview" {...screenProps} />);
    enableReadAloud();
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
    expect(FakeAudio.instances[0].playbackRate).toBe(1.2);
  });

  it("自動再生拒否を表示し、手動操作から再試行できる", async () => {
    mocks.audioPlay
      .mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"))
      .mockResolvedValueOnce(undefined);
    render(<InterviewScreen mode="interview" {...screenProps} />);
    enableReadAloud();
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
    render(<InterviewScreen mode="interview" {...screenProps} />);
    enableReadAloud();
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
    const view = render(<InterviewScreen mode="interview" {...screenProps} />);
    enableReadAloud();
    submitAnswer("回答です。");
    await screen.findByRole("button", { name: "停止する" });
    const audio = FakeAudio.instances[0];

    view.unmount();

    expect(audio.pause).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:question-1");
  });

  it("中断確認を取り消すと会話・通信・再生を維持する", async () => {
    render(<InterviewScreen mode="interview" {...screenProps} />);
    enableReadAloud();
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
    render(<InterviewScreen mode="interview" {...screenProps} />);
    enableReadAloud();
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
    render(<InterviewScreen mode="interview" {...screenProps} />);
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

  it("回答前のホーム操作は確認と評価なしで一度だけ遷移する", () => {
    render(<InterviewScreen mode="interview" {...screenProps} />);

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.createEvaluation).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("ホーム確認後は進行中の chat と一時会話を破棄し、評価せず一度だけ遷移する", async () => {
    let chatSignal: AbortSignal | undefined;
    mocks.requestNextQuestion.mockImplementation(
      (_input: unknown, signal?: AbortSignal) => {
        chatSignal = signal;
        return new Promise<string>(() => undefined);
      },
    );
    render(<InterviewScreen mode="interview" {...screenProps} />);
    submitAnswer("破棄する回答です。");
    await waitFor(() => expect(mocks.requestNextQuestion).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "ホームに戻ると、この会話は失われます。評価は行われません。",
    );
    fireEvent.click(screen.getByRole("button", { name: "取り消す" }));

    expect(chatSignal?.aborted).toBe(false);
    expect(screen.getByText("破棄する回答です。")).toBeInTheDocument();
    expect(mocks.createEvaluation).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();

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
      "companyId=7&strength=hard&readAloud=disabled&maxTurns=2";
    mocks.requestNextQuestion.mockResolvedValue("2つ目の質問です。");
    mocks.createEvaluation.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          resolveEvaluation = resolve;
        }),
    );
    render(<InterviewScreen mode="interview" {...screenProps} />);

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
    expect(screen.getByRole("button", { name: "送信する" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "面接を終える" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ホーム" })).toBeEnabled();

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

  it("文字入力はフィラーを計数・表示せず、定量スコアなしで評価する", async () => {
    mocks.search =
      "companyId=7&strength=standard&readAloud=disabled&maxTurns=1";
    render(<InterviewScreen mode="interview" {...screenProps} />);

    submitAnswer("えー、あの、文字入力の回答です。");

    expect(await screen.findByText("お疲れ様でした")).toBeInTheDocument();
    expect(screen.queryByText(/フィラー \d+ 回/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "評価を見る" }));

    await waitFor(() => expect(mocks.createEvaluation).toHaveBeenCalledOnce());
    const input = mocks.createEvaluation.mock.calls[0][0];
    const textAnswer = input.turns.find(
      (turn: ChatTurn) => turn.role === "user",
    );
    expect(textAnswer).toEqual(
      expect.objectContaining({
        content: "えー、あの、文字入力の回答です。",
      }),
    );
    expect(textAnswer).not.toHaveProperty("filler_count");
    expect(input.scores).toEqual({});
  });

  it("チュートリアルは1回答で終了し、終了表示だけではchat・TTS・評価を呼ばない", async () => {
    mocks.search = "readAloud=disabled&maxTurns=25";
    render(<InterviewScreen mode="tutorial" {...screenProps} />);

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

  it("チュートリアルでも読み上げるを選ぶと最初の質問を自動再生し、途中で切り替えられる", async () => {
    mocks.search = "readAloud=enabled";
    render(<InterviewScreen mode="tutorial" {...screenProps} />);

    expect(screen.getByText(TUTORIAL_QUESTION)).toBeInTheDocument();
    await waitFor(() => expect(mocks.synthesizeSpeech).toHaveBeenCalledOnce());
    expect(mocks.synthesizeSpeech).toHaveBeenCalledWith(
      TUTORIAL_QUESTION,
      expect.any(AbortSignal),
    );
    expect(FakeAudio.instances[0].play).toHaveBeenCalledOnce();

    fireEvent.click(
      screen.getByRole("button", { name: "読み上げモード: 読み上げない" }),
    );

    await waitFor(() =>
      expect(FakeAudio.instances[0].pause).toHaveBeenCalled(),
    );
    expect(mocks.getCompany).not.toHaveBeenCalled();
  });

  it("読み上げ中を入力パネルへ伝え、速度の変更を再生中の音声へ即座に反映する", async () => {
    render(
      <InterviewScreen
        mode="interview"
        answerMethod="voice"
        InputPanel={ProbeInputPanel}
      />,
    );
    enableReadAloud();

    expect(screen.getByText("面接官の発話: なし")).toBeInTheDocument();
    expect(screen.getByText("読み上げ速度: 1.2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "読み上げる" }));

    expect(await screen.findByText("面接官の発話: あり")).toBeInTheDocument();
    await waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    expect(FakeAudio.instances[0].playbackRate).toBe(1.2);

    fireEvent.click(screen.getByRole("button", { name: "速度を上げる" }));

    expect(screen.getByText("読み上げ速度: 1.8")).toBeInTheDocument();
    expect(FakeAudio.instances[0].playbackRate).toBe(1.8);
  });

  it("評価開始に失敗しても終了時の会話を保持し、評価を見るから再試行できる", async () => {
    mocks.search =
      "companyId=7&strength=standard&readAloud=disabled&maxTurns=1";
    mocks.createEvaluation
      .mockRejectedValueOnce(new Error("evaluation failed"))
      .mockResolvedValueOnce(89);
    render(<InterviewScreen mode="interview" {...screenProps} />);
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
