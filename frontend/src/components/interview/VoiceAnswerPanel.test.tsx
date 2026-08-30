import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnswerDetail } from "@/components/interview/InterviewInput";
import { VoiceAnswerPanel } from "@/components/interview/VoiceAnswerPanel";
import { ApiError } from "@/lib/api-client";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "companyId=7&strength=standard&readAloud=enabled&maxTurns=10",
  transcribeAudio: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/interview/voice",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/lib/interview-api", () => ({
  transcribeAudio: mocks.transcribeAudio,
}));

type Listener = (event: Event) => void;

/** 測定ループが読む入力レベル。テストごとに書き換えて発話と無音を作る */
let inputLevel = 0;

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];

  static isTypeSupported(type: string) {
    return type === "audio/webm;codecs=opus";
  }

  readonly mimeType: string;
  state: RecordingState = "inactive";
  private readonly stream: MediaStream;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.mimeType = options?.mimeType ?? "audio/webm";
    FakeMediaRecorder.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (typeof listener !== "function") return;
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  start() {
    // 権限が切れて非アクティブになった MediaStream には、実ブラウザも例外を投げる
    if (!this.stream.active) {
      throw new DOMException("stream is inactive", "InvalidStateError");
    }
    this.state = "recording";
  }

  stop() {
    if (this.state !== "recording") return;
    this.state = "inactive";
    const data = new Blob(["recorded-audio"], { type: this.mimeType });
    this.emit("dataavailable", { data } as BlobEvent);
    this.emit("stop", new Event("stop"));
  }

  protected emit(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

/**
 * 実ブラウザの MediaRecorder は stop() 呼び出し直後に state だけ同期的に
 * inactive へ変わり、"stop" イベント自体は後続のタスクとして遅れて届く。
 * 「区切って送る」区間を listening 変化の effect が discard 扱いにする
 * レースを再現するため、そのタイミングだけ意図的にずらす
 */
class DeferredStopMediaRecorder extends FakeMediaRecorder {
  stop() {
    if (this.state !== "recording") return;
    this.state = "inactive";
    const data = new Blob(["recorded-audio"], { type: this.mimeType });
    setTimeout(() => {
      this.emit("dataavailable", { data } as BlobEvent);
      this.emit("stop", new Event("stop"));
    }, 0);
  }
}

/** enabled の切り替えと、権限が切れたときの ended 通知だけを持つトラック */
class FakeMediaStreamTrack extends EventTarget {
  enabled = true;
  readyState: MediaStreamTrackState = "live";

  constructor(private readonly onStop: () => void) {
    super();
  }

  stop() {
    this.readyState = "ended";
    this.onStop();
  }
}

/** 権限の取り消しがトラックへ伝わる前に、開始だけが失敗するブラウザの挙動 */
class FailingStartMediaRecorder extends FakeMediaRecorder {
  start(): never {
    throw new DOMException("cannot start", "InvalidStateError");
  }
}

/** ブラウザ側の許可の切り替えを再現する Permissions API のフェイク */
class FakePermissionStatus {
  private readonly listeners: Listener[] = [];

  constructor(public state: PermissionState) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type !== "change" || typeof listener !== "function") return;
    this.listeners.push(listener);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) {
    if (type !== "change") return;
    const index = this.listeners.indexOf(listener as Listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  /** サイト設定で許可・ブロックを切り替えたときの通知にあたる */
  change(state: PermissionState) {
    this.state = state;
    for (const listener of [...this.listeners]) listener(new Event("change"));
  }
}

class FakeAudioContext {
  createAnalyser() {
    return {
      fftSize: 0,
      frequencyBinCount: 32,
      getByteFrequencyData: (data: Uint8Array) => data.fill(inputLevel),
    } as unknown as AnalyserNode;
  }

  createMediaStreamSource() {
    return { connect: vi.fn() } as unknown as MediaStreamAudioSourceNode;
  }

  close() {
    return Promise.resolve();
  }
}

const transcription = {
  raw_transcript: "%えー% 回答です。",
  clean_transcript: "回答です。",
  filler_count: 1,
  filler_count_per_min: 30,
  duration_ms: 2_000,
  chars: 5,
  chars_per_min: 150,
};

type PanelOptions = {
  onSubmit?: (content: string, detail?: AnswerDetail) => void;
  waiting?: boolean;
  disabled?: boolean;
  interviewerSpeaking?: boolean;
  onSkipInterviewerSpeech?: () => void;
  speechPlaybackRate?: number;
  onChangeSpeechPlaybackRate?: (rate: number) => void;
  exitSignal?: AbortSignal;
};

describe("VoiceAnswerPanel の常時録音", () => {
  const trackStop = vi.fn();
  const getUserMedia = vi.fn();
  let track: FakeMediaStreamTrack;
  let permissionStatus: FakePermissionStatus;

  /** getUserMedia が返す MediaStream。実ブラウザと同じく取り直すと新しいトラックが来る */
  function openFakeStream(): MediaStream {
    const opened = new FakeMediaStreamTrack(trackStop);
    track = opened;
    return {
      getTracks: () => [opened],
      getAudioTracks: () => [opened],
      get active() {
        return opened.readyState === "live";
      },
    } as unknown as MediaStream;
  }

  /**
   * ブラウザ設定でマイクを止められた状態を作る。
   * 実ブラウザではトラックが ended になり、MediaStream も非アクティブになる
   */
  function revokeMicrophone(notifies = true) {
    track.readyState = "ended";
    if (notifies) track.dispatchEvent(new Event("ended"));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    FakeMediaRecorder.instances = [];
    inputLevel = 0;
    track = new FakeMediaStreamTrack(trackStop);
    getUserMedia.mockImplementation(async () => openFakeStream());
    mocks.transcribeAudio.mockResolvedValue(transcription);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    permissionStatus = new FakePermissionStatus("granted");
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue(permissionStatus) },
    });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function panelProps(options: PanelOptions) {
    return {
      onSubmit: options.onSubmit ?? vi.fn(),
      waiting: options.waiting ?? false,
      disabled: options.disabled ?? false,
      interviewerSpeaking: options.interviewerSpeaking ?? false,
      onSkipInterviewerSpeech: options.onSkipInterviewerSpeech ?? vi.fn(),
      speechPlaybackRate: options.speechPlaybackRate ?? 1.2,
      onChangeSpeechPlaybackRate:
        options.onChangeSpeechPlaybackRate ?? vi.fn(),
      exitSignal: options.exitSignal ?? new AbortController().signal,
    };
  }

  /** マイクの取得を待ってから操作できる状態にする */
  async function renderPanel(options: PanelOptions = {}) {
    const props = panelProps(options);
    const view = render(<VoiceAnswerPanel {...props} />);
    await act(async () => {});
    return {
      ...props,
      rerender: (next: PanelOptions = {}) =>
        view.rerender(<VoiceAnswerPanel {...panelProps({ ...options, ...next })} />),
    };
  }

  async function advance(ms: number) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  }

  /** 話してから黙る。既定では区切りに届くまで黙る */
  async function speakThenPause(speakMs = 1_500, silenceMs = 2_100) {
    inputLevel = 40;
    await advance(speakMs);
    inputLevel = 0;
    await advance(silenceMs);
    await act(async () => {});
  }

  it("押す操作なしで聞き始め、無音が続いた発話を計測値ごと送る", async () => {
    const onSubmit = vi.fn();
    await renderPanel({ onSubmit });

    expect(screen.getByText("どうぞお話しください")).toBeInTheDocument();
    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0].state).toBe("recording");
    expect(track.enabled).toBe(true);

    await speakThenPause();

    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("回答です。", {
      rawContent: "%えー% 回答です。",
      audioSeconds: 2,
      audioDurationMs: 2_000,
      characterCount: 5,
      fillerCount: 1,
      fillerCountPerMin: 30,
      charsPerMin: 150,
    });
  });

  it("話しているあいだと無音の残り秒数を知らせる", async () => {
    await renderPanel();

    inputLevel = 40;
    await advance(500);
    expect(screen.getByText("聞き取り中…")).toBeInTheDocument();

    inputLevel = 0;
    await advance(700);
    expect(screen.getByText(/^あと 1\.\d 秒で送ります$/)).toBeInTheDocument();
  });

  it("送ったあとは面接官の番が終わるまでマイクを止め、終わると自分で戻る", async () => {
    const { rerender } = await renderPanel();
    const firstRecorder = FakeMediaRecorder.instances[0];

    rerender({ waiting: true });
    expect(track.enabled).toBe(false);
    expect(firstRecorder.state).toBe("inactive");
    expect(screen.getByText("面接官が考えています")).toBeInTheDocument();

    rerender({ waiting: false, interviewerSpeaking: true });
    expect(track.enabled).toBe(false);
    expect(screen.getByText("面接官が話しています")).toBeInTheDocument();
    expect(FakeMediaRecorder.instances).toHaveLength(1);

    rerender({ waiting: false, interviewerSpeaking: false });
    expect(track.enabled).toBe(true);
    expect(FakeMediaRecorder.instances).toHaveLength(2);
    expect(FakeMediaRecorder.instances[1].state).toBe("recording");
    expect(screen.getByText("どうぞお話しください")).toBeInTheDocument();
  });

  it("面接官の番に入った区間は文字起こしへ送らない", async () => {
    const onSubmit = vi.fn();
    const { rerender } = await renderPanel({ onSubmit });

    inputLevel = 40;
    await advance(1_500);
    rerender({ interviewerSpeaking: true });
    await act(async () => {});

    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("「次の質問へ」で無音を待たずに送り、話す前は押せない", async () => {
    const onSubmit = vi.fn();
    await renderPanel({ onSubmit });

    const nextButton = screen.getByRole("button", { name: "次の質問へ" });
    expect(nextButton).toBeDisabled();

    inputLevel = 40;
    await advance(1_500);
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);
    await act(async () => {});

    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
      "回答です。",
      expect.objectContaining({ rawContent: "%えー% 回答です。" }),
    );
  });

  it("読み上げ中は読み上げを飛ばす「質問に答える」に変わる", async () => {
    const onSkipInterviewerSpeech = vi.fn();
    const { rerender } = await renderPanel({ onSkipInterviewerSpeech });

    expect(
      screen.getByRole("button", { name: "次の質問へ" }),
    ).toBeInTheDocument();

    rerender({ interviewerSpeaking: true });

    expect(
      screen.queryByRole("button", { name: "次の質問へ" }),
    ).not.toBeInTheDocument();
    const answerButton = screen.getByRole("button", { name: "質問に答える" });
    expect(answerButton).toBeEnabled();

    fireEvent.click(answerButton);

    expect(onSkipInterviewerSpeech).toHaveBeenCalledOnce();

    // 読み上げが止まれば聞き取りへ戻り、ボタンも元へ戻る
    rerender({ interviewerSpeaking: false });

    expect(
      screen.getByRole("button", { name: "次の質問へ" }),
    ).toBeInTheDocument();
    expect(track.enabled).toBe(true);
  });

  it("ミュートで聞くのをやめ、もう一度押すと戻る", async () => {
    const onSubmit = vi.fn();
    await renderPanel({ onSubmit });

    fireEvent.click(
      screen.getByRole("button", { name: "マイクをミュートする" }),
    );

    expect(track.enabled).toBe(false);
    expect(screen.getByText("ミュート中。押すと再開します")).toBeInTheDocument();

    await speakThenPause();
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "ミュートを解除する" }));

    expect(track.enabled).toBe(true);
    expect(screen.getByText("どうぞお話しください")).toBeInTheDocument();
  });

  it("面接官の番はマイクのボタンで止まっていると示し、ミュートを優先する", async () => {
    const { rerender } = await renderPanel();

    expect(
      screen.getByRole("button", { name: "マイクをミュートする" }),
    ).toBeInTheDocument();

    rerender({ interviewerSpeaking: true });

    expect(
      screen.getByRole("button", {
        name: "マイクをミュートする（いまは面接官の番で止まっています）",
      }),
    ).toBeInTheDocument();

    // 面接官の番でも先回りしてミュートでき、そのときはミュートの表示が勝つ
    fireEvent.click(
      screen.getByRole("button", {
        name: "マイクをミュートする（いまは面接官の番で止まっています）",
      }),
    );

    expect(
      screen.getByRole("button", { name: "ミュートを解除する" }),
    ).toBeInTheDocument();

    rerender({ interviewerSpeaking: false });

    expect(
      screen.getByRole("button", { name: "ミュートを解除する" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ミュート中。押すと再開します")).toBeInTheDocument();
  });

  it("文字が起きなかった区間は黙って捨てて聞き続ける", async () => {
    const onSubmit = vi.fn();
    mocks.transcribeAudio.mockResolvedValue({
      ...transcription,
      raw_transcript: "",
      clean_transcript: "",
    });
    await renderPanel({ onSubmit });

    await speakThenPause();

    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("どうぞお話しください")).toBeInTheDocument();
    expect(track.enabled).toBe(true);
  });

  it("1秒に満たない物音は送らない", async () => {
    const onSubmit = vi.fn();
    await renderPanel({ onSubmit });

    await speakThenPause(400, 2_100);

    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("文字起こしに失敗しても録音を止めず、注意は時間で消える", async () => {
    const onSubmit = vi.fn();
    mocks.transcribeAudio.mockRejectedValue(new ApiError("unavailable", 503));
    await renderPanel({ onSubmit });

    await speakThenPause();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "聞き取れませんでした。もう一度お話しください。",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(track.enabled).toBe(true);
    expect(screen.getByText("どうぞお話しください")).toBeInTheDocument();

    await advance(4_100);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("上限ターンに達したらマイクを止める", async () => {
    const { rerender } = await renderPanel();

    rerender({ disabled: true });

    expect(track.enabled).toBe(false);
    expect(screen.getByText("面接が終了しました")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "マイクをミュートする" }),
    ).toBeDisabled();
  });

  it("面接の終了時に録音と MediaStream を止める", async () => {
    const controller = new AbortController();
    await renderPanel({ exitSignal: controller.signal });

    await act(async () => controller.abort());

    expect(FakeMediaRecorder.instances[0].state).toBe("inactive");
    expect(trackStop).toHaveBeenCalled();
  });

  it("マイクを拒否されたら録音せず、確認のうえ文字入力ページへ移る", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const onSubmit = vi.fn();
    await renderPanel({ onSubmit });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "マイクを使えません。ブラウザの設定で許可するか、文字入力モードで始め直してください。",
    );
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "マイクをミュートする" }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "文字入力モードで始め直す" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "始め直す" }));

    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
      "/interview/text?companyId=7&strength=standard&readAloud=enabled&maxTurns=10",
    );
  });

  it("ブロックしたマイクを許可し直すと、読み込み直さずに録音へ戻る", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    permissionStatus = new FakePermissionStatus("denied");
    (navigator.permissions.query as ReturnType<typeof vi.fn>).mockResolvedValue(
      permissionStatus,
    );
    const onSubmit = vi.fn();
    await renderPanel({ onSubmit });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "マイクを使えません。ブラウザの設定で許可するか、文字入力モードで始め直してください。",
    );

    // ブラウザ側で許可し直す
    getUserMedia.mockImplementation(async () => openFakeStream());
    await act(async () => permissionStatus.change("granted"));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "文字入力モードで始め直す" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("どうぞお話しください")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "マイクをミュートする" }),
    ).toBeEnabled();
    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0].state).toBe("recording");

    // 戻ったあとは、いつもどおり発話を送れる
    await speakThenPause();

    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
      "回答です。",
      expect.objectContaining({ rawContent: "%えー% 回答です。" }),
    );
  });

  it("録音中にブロックされたらマイクを手放し、使えないと知らせる", async () => {
    const onSubmit = vi.fn();
    await renderPanel({ onSubmit });

    expect(screen.getByText("どうぞお話しください")).toBeInTheDocument();

    await act(async () => permissionStatus.change("denied"));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "マイクを使えません。ブラウザの設定で許可するか、文字入力モードで始め直してください。",
    );
    expect(screen.getByText("マイクを使えません")).toBeInTheDocument();
    expect(trackStop).toHaveBeenCalled();
    expect(FakeMediaRecorder.instances[0].state).toBe("inactive");
    expect(
      screen.getByRole("button", { name: "マイクをミュートする" }),
    ).toBeDisabled();

    await speakThenPause();
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("許可とブロックを繰り返しても、表示は実際の権限状態から離れない", async () => {
    await renderPanel();

    for (let round = 0; round < 2; round += 1) {
      await act(async () => permissionStatus.change("denied"));
      expect(screen.getByText("マイクを使えません")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();

      await act(async () => permissionStatus.change("granted"));
      expect(screen.getByText("どうぞお話しください")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(track.enabled).toBe(true);
    }

    expect(getUserMedia).toHaveBeenCalledTimes(3);
  });

  it("「次の質問へ」の直後に面接官の番へ切り替わっても、区間を送り届ける", async () => {
    // stop() の "stop" イベントが遅れて届く実ブラウザの挙動を再現する
    vi.stubGlobal("MediaRecorder", DeferredStopMediaRecorder);
    const onSubmit = vi.fn();
    await renderPanel({ onSubmit });

    inputLevel = 40;
    await advance(1_500);
    inputLevel = 0;

    fireEvent.click(screen.getByRole("button", { name: "次の質問へ" }));
    // recorder.stop() 直後、まだ "stop" イベントは届いていない
    expect(screen.getByText("文字起こししています")).toBeInTheDocument();

    // 遅れて届く "stop" イベントを流す
    await advance(0);

    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
      "回答です。",
      expect.objectContaining({ rawContent: "%えー% 回答です。" }),
    );
    expect(screen.getByText("どうぞお話しください")).toBeInTheDocument();
  });

  it("読み上げのあいだにマイクの権限が切れても、落ちずにマイクを使えない案内へ移る", async () => {
    const { rerender } = await renderPanel();
    expect(FakeMediaRecorder.instances).toHaveLength(1);

    // 面接官の番のうちに設定で止められる。ended の通知が届かない経路を通す
    rerender({ interviewerSpeaking: true });
    revokeMicrophone(false);

    // 読み上げが終わると次の区間を録り始めようとして、録音の開始に失敗する
    rerender({ interviewerSpeaking: false });
    await act(async () => {});

    expect(screen.getByText("マイクを使えません")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "マイクを使えません。ブラウザの設定で許可するか、文字入力モードで始め直してください。",
    );
    // 使えないトラックで録り直しにいかない
    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0].state).toBe("inactive");
    expect(
      screen.getByRole("button", { name: "文字入力モードで始め直す" }),
    ).toBeInTheDocument();
  });

  it("トラックが生きて見えても録音を開始できなければ、落ちずに案内へ移る", async () => {
    const { rerender } = await renderPanel();

    // 権限の取り消しがトラックへ伝わる前に、開始だけが失敗する状態を作る
    vi.stubGlobal("MediaRecorder", FailingStartMediaRecorder);
    rerender({ interviewerSpeaking: true });
    rerender({ interviewerSpeaking: false });
    await act(async () => {});

    expect(screen.getByText("マイクを使えません")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("マイクを使えません。");
  });

  it("マイクの権限が切れた通知を受けたら、その場で聞くのをやめて案内へ移る", async () => {
    const onSubmit = vi.fn();
    const { rerender } = await renderPanel({ onSubmit });

    rerender({ interviewerSpeaking: true });
    await act(async () => {
      revokeMicrophone();
    });

    expect(screen.getByText("マイクを使えません")).toBeInTheDocument();
    expect(FakeMediaRecorder.instances[0].state).toBe("inactive");

    // 読み上げが終わっても録音は再開せず、案内を出したままにする
    rerender({ interviewerSpeaking: false });
    await act(async () => {});
    await speakThenPause();

    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("マイクを使えません")).toBeInTheDocument();
  });

  it("使い方を求められたら常時録音の約束ごとを示す", async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "音声入力の使い方" }));

    expect(screen.getByRole("note")).toHaveTextContent(
      "話し終えて少し黙ると、そこまでを回答として送ります",
    );
  });
});
