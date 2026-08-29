import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
      getByteFrequencyData: (data: Uint8Array) => data.fill(16),
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

describe("VoiceAnswerPanel", () => {
  const trackStop = vi.fn();
  const getUserMedia = vi.fn();
  let now = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    FakeMediaRecorder.instances = [];
    now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    } as unknown as MediaStream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderPanel(options: {
    onSubmit?: (content: string, detail?: AnswerDetail) => void;
    disabled?: boolean;
    exitSignal?: AbortSignal;
  } = {}) {
    const onSubmit = options.onSubmit ?? vi.fn();
    render(
      <VoiceAnswerPanel
        onSubmit={onSubmit}
        waiting={false}
        disabled={options.disabled ?? false}
        exitSignal={options.exitSignal ?? new AbortController().signal}
      />,
    );
    return { onSubmit };
  }

  async function startAndStopRecording() {
    fireEvent.click(screen.getByRole("button", { name: "回答を録音する" }));
    const stopButton = await screen.findByRole("button", {
      name: "録音を停止して送信する",
    });
    now = 1_500;
    fireEvent.click(stopButton);
  }

  it("録音停止後に STT を1回だけ呼び、clean 表示用テキストと全計測値を渡す", async () => {
    mocks.transcribeAudio.mockResolvedValue(transcription);
    const onSubmit = vi.fn();
    renderPanel({ onSubmit });

    await startAndStopRecording();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(mocks.transcribeAudio.mock.calls[0][0]).toMatchObject({
      type: "audio/webm;codecs=opus",
    });
    expect(onSubmit).toHaveBeenCalledWith("回答です。", {
      rawContent: "%えー% 回答です。",
      audioSeconds: 2,
      audioDurationMs: 2_000,
      characterCount: 5,
      fillerCount: 1,
      fillerCountPerMin: 30,
      charsPerMin: 150,
    });
  });

  it("録音を取り消すと音声を捨て、STT と会話追加を行わない", async () => {
    const onSubmit = vi.fn();
    renderPanel({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "回答を録音する" }));
    await screen.findByRole("button", { name: "取り消す" });
    fireEvent.click(screen.getByRole("button", { name: "取り消す" }));

    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "回答を録音する" }),
    ).toBeEnabled();
  });

  it("面接終了時に録音と MediaStream を停止し、音声を送らない", async () => {
    const controller = new AbortController();
    const onSubmit = vi.fn();
    renderPanel({ onSubmit, exitSignal: controller.signal });

    fireEvent.click(screen.getByRole("button", { name: "回答を録音する" }));
    await screen.findByRole("button", { name: "録音を停止して送信する" });

    act(() => controller.abort());

    expect(FakeMediaRecorder.instances[0].state).toBe("inactive");
    expect(trackStop).toHaveBeenCalledOnce();
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "回答を録音する" }),
    ).toBeDisabled();
  });

  it("面接終了時に進行中の STT を中断し、遅い結果から回答を追加しない", async () => {
    const controller = new AbortController();
    let sttSignal: AbortSignal | undefined;
    let resolveTranscription!: (value: typeof transcription) => void;
    mocks.transcribeAudio.mockImplementation(
      (_audio: Blob, signal?: AbortSignal) =>
        new Promise<typeof transcription>((resolve) => {
          sttSignal = signal;
          resolveTranscription = resolve;
        }),
    );
    const onSubmit = vi.fn();
    renderPanel({ onSubmit, exitSignal: controller.signal });

    await startAndStopRecording();
    await waitFor(() => expect(mocks.transcribeAudio).toHaveBeenCalledOnce());

    act(() => controller.abort());
    await act(async () => resolveTranscription(transcription));

    expect(controller.signal.aborted).toBe(true);
    expect(sttSignal?.aborted).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("1秒未満の録音は STT へ送らず再試行できる", async () => {
    const onSubmit = vi.fn();
    renderPanel({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "回答を録音する" }));
    const stopButton = await screen.findByRole("button", {
      name: "録音を停止して送信する",
    });
    now = 500;
    fireEvent.click(stopButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "録音が短すぎます。もう一度お試しください。",
    );
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "回答を録音する" }),
    ).toBeEnabled();
  });

  it("マイクを拒否されたら録音を押せなくし、確認のうえ同じ設定の文字入力ページへ移る", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const onSubmit = vi.fn();
    renderPanel({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "回答を録音する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "マイクを使えません。ブラウザの設定で許可するか、文字入力モードで始め直してください。",
    );
    expect(
      screen.getByRole("button", { name: "回答を録音する" }),
    ).toBeDisabled();
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "文字入力モードで始め直す" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "文字入力モードで始め直します。ここまでの会話は失われ、評価は行われません。",
    );
    fireEvent.click(screen.getByRole("button", { name: "取り消す" }));
    expect(mocks.replace).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "文字入力モードで始め直す" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "始め直す" }));

    expect(mocks.replace).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith(
      "/interview/text?companyId=7&strength=standard&readAloud=enabled&maxTurns=10",
    );
  });

  it("無効時は録音開始を受け付けず、方式の切り替えも持たない", () => {
    renderPanel({ disabled: true });

    expect(
      screen.getByRole("button", { name: "回答を録音する" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "文字入力で回答" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "回答を録音する" }));

    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "401",
      error: new ApiError("unauthorized", 401),
      message:
        "サインインの有効期限が切れました。もう一度サインインしてください。",
    },
    {
      label: "413",
      error: new ApiError("too large", 413),
      message:
        "録音データが大きすぎます。短く区切ってもう一度お試しください。",
    },
    {
      label: "503",
      error: new ApiError("unavailable", 503),
      message: "聞き取れませんでした。もう一度お話しください。",
    },
    {
      label: "通信失敗",
      error: new ApiError("network", null),
      message: "聞き取れませんでした。もう一度お話しください。",
    },
  ])("$label で会話を追加せず再試行できる", async ({ error, message }) => {
    mocks.transcribeAudio.mockRejectedValue(error);
    const onSubmit = vi.fn();
    renderPanel({ onSubmit });

    await startAndStopRecording();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "回答を録音する" }),
    ).toBeEnabled();
  });
});
