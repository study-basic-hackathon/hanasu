import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpeedPracticeSession } from "@/components/practice/SpeedPracticeSession";

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
  raw_transcript: "話した内容です。",
  clean_transcript: "話した内容です。",
  filler_count: 2,
  filler_count_per_min: 3,
  duration_ms: 12_000,
  chars: 50,
  chars_per_min: 250,
};

describe("SpeedPracticeSession", () => {
  const getUserMedia = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
    vi.clearAllMocks();
    FakeMediaRecorder.instances = [];
    getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
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

  async function startAndStopRecording() {
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "スピード測定の録音を開始する" }),
      );
    });
    act(() => vi.advanceTimersByTime(2_000));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "録音を停止する" }));
    });
  }

  it("文字起こし後に話速だけと適正域との比較を一時表示する", async () => {
    mocks.transcribeAudio.mockResolvedValue(transcription);
    render(<SpeedPracticeSession passage="課題文です。" />);

    await startAndStopRecording();

    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "今回の測定結果" })).toBeInTheDocument();
    expect(screen.getByText("250 文字/分")).toHaveClass("text-accent");
    expect(screen.getByText(/適正な話速です/)).toBeInTheDocument();
    expect(screen.getByLabelText(/適正域 240〜260 文字\/分/)).toBeInTheDocument();
    expect(screen.queryByText("フィラー")).not.toBeInTheDocument();
    expect(screen.getByText(/保存されません/)).toBeInTheDocument();
  });

  it("文字起こし失敗後に同じ音声を再送できる", async () => {
    mocks.transcribeAudio
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ...transcription, chars_per_min: 230 });
    render(<SpeedPracticeSession passage="課題文です。" />);

    await startAndStopRecording();

    expect(screen.getByRole("alert")).toHaveTextContent("文字起こしに失敗しました");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "文字起こしを再試行" }));
    });

    expect(mocks.transcribeAudio).toHaveBeenCalledTimes(2);
    expect(screen.getByText("230 文字/分")).toHaveClass("text-accent");
    expect(screen.getByText(/遅めです/)).toBeInTheDocument();
  });

  it("もう一度測定するで録音と結果を初期化できる", async () => {
    mocks.transcribeAudio.mockResolvedValue(transcription);
    render(<SpeedPracticeSession passage="課題文です。" />);

    await startAndStopRecording();
    fireEvent.click(screen.getByRole("button", { name: "もう一度測定する" }));

    expect(
      screen.getByRole("button", { name: "スピード測定の録音を開始する" }),
    ).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "今回の測定結果" })).not.toBeInTheDocument();
  });
});
