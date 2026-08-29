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
  private readonly listeners = new Map<string, Listener[]>();

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? "audio/webm";
    FakeMediaRecorder.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (typeof listener !== "function") return;
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state !== "recording") return;
    this.state = "inactive";
    const data = new Blob(["recorded-audio"], { type: this.mimeType });
    this.emit("dataavailable", { data } as BlobEvent);
    this.emit("stop", new Event("stop"));
  }

  private emit(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
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
  speechPlaybackRate?: number;
  onChangeSpeechPlaybackRate?: (rate: number) => void;
  exitSignal?: AbortSignal;
};

describe("VoiceAnswerPanel の常時録音", () => {
  const trackStop = vi.fn();
  const getUserMedia = vi.fn();
  let track: { enabled: boolean; stop: () => void };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    FakeMediaRecorder.instances = [];
    inputLevel = 0;
    track = { enabled: true, stop: trackStop };
    getUserMedia.mockResolvedValue({
      getTracks: () => [track],
      getAudioTracks: () => [track],
    } as unknown as MediaStream);
    mocks.transcribeAudio.mockResolvedValue(transcription);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
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
  async function speakThenPause(speakMs = 1_500, silenceMs = 3_100) {
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
    await advance(1_200);
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

    fireEvent.click(screen.getByRole("button", { name: "マイクをオンにする" }));

    expect(track.enabled).toBe(true);
    expect(screen.getByText("どうぞお話しください")).toBeInTheDocument();
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

    await speakThenPause(400, 3_100);

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

  it("使い方を求められたら常時録音の約束ごとを示す", async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "音声入力の使い方" }));

    expect(screen.getByRole("note")).toHaveTextContent(
      "話し終えて少し黙ると、そこまでを回答として送ります",
    );
  });
});
