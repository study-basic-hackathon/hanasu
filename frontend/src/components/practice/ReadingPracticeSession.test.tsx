import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReadingPracticeSession } from "@/components/practice/ReadingPracticeSession";

const mocks = vi.hoisted(() => ({
  transcribeAudio: vi.fn(),
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
    this.emit("dataavailable", {
      data: new Blob(["recorded-audio"], { type: this.mimeType }),
    } as BlobEvent);
    this.emit("stop", new Event("stop"));
  }

  private emit(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const transcription = {
  raw_transcript: "%えー% 回答です。",
  clean_transcript: "回答です。",
  filler_count: 1,
  filler_count_per_min: 1.5,
  duration_ms: 12_000,
  chars: 44,
  chars_per_min: 220,
};

describe("ReadingPracticeSession", () => {
  const trackStop = vi.fn();
  const getUserMedia = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
    vi.clearAllMocks();
    FakeMediaRecorder.instances = [];
    getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    } as unknown as MediaStream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function renderSession() {
    return render(<ReadingPracticeSession passage="音読する課題文です。" />);
  }

  async function startRecording() {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "音読の録音を開始する" }));
    });
    expect(screen.getByRole("button", { name: "録音を停止する" })).toBeEnabled();
  }

  async function stopAfter(seconds: number) {
    act(() => vi.advanceTimersByTime(seconds * 1000));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "録音を停止する" }));
    });
  }

  it("停止後の処理中を表示し、話速とフィラーの一時評価を表示する", async () => {
    let resolveTranscription!: (value: typeof transcription) => void;
    mocks.transcribeAudio.mockImplementation(
      () =>
        new Promise<typeof transcription>((resolve) => {
          resolveTranscription = resolve;
        }),
    );
    renderSession();

    await startRecording();
    await stopAfter(2);

    expect(screen.getByText(/処理中です/)).toBeInTheDocument();
    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(trackStop).toHaveBeenCalledOnce();

    await act(async () => resolveTranscription(transcription));

    expect(screen.getByRole("heading", { name: "今回の評価" })).toBeInTheDocument();
    expect(screen.getByText("220 文字/分")).toHaveClass("text-accent");
    expect(screen.getByText("1.5 回/分")).toHaveClass("text-accent");
    expect(screen.getByText(/適正な話速です/)).toBeInTheDocument();
    expect(screen.getByText(/保存されません/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "もう一度練習する" }));
    expect(
      screen.getByRole("button", { name: "音読の録音を開始する" }),
    ).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "今回の評価" })).not.toBeInTheDocument();
  });

  it("1分に達すると自動停止して文字起こしを始める", async () => {
    mocks.transcribeAudio.mockResolvedValue(transcription);
    renderSession();

    await startRecording();
    act(() => vi.advanceTimersByTime(60_000));
    await act(async () => undefined);

    expect(FakeMediaRecorder.instances[0].state).toBe("inactive");
    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(screen.getByText("220 文字/分")).toBeInTheDocument();
  });

  it("文字起こし失敗後に同じ音声を再送できる", async () => {
    mocks.transcribeAudio
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(transcription);
    renderSession();

    await startRecording();
    await stopAfter(2);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "文字起こしに失敗しました",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "文字起こしを再試行" }));
    });

    expect(mocks.transcribeAudio).toHaveBeenCalledTimes(2);
    expect(screen.getByText("220 文字/分")).toBeInTheDocument();
  });

  it("マイク権限を拒否されても録音を再試行できる", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    renderSession();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "音読の録音を開始する" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("マイクを使用できません");
    expect(screen.getByRole("button", { name: "録音を再試行" })).toBeEnabled();
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
  });

  it("画面を離れると録音とMediaStreamを停止する", async () => {
    const view = renderSession();
    await startRecording();

    view.unmount();

    expect(FakeMediaRecorder.instances[0].state).toBe("inactive");
    expect(trackStop).toHaveBeenCalledOnce();
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
  });
});
