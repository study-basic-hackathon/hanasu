import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatMessage } from "@/components/interview/ChatMessage";

const mocks = vi.hoisted(() => ({
  synthesizeSpeech: vi.fn(),
}));

vi.mock("@/lib/interview-api", () => ({
  synthesizeSpeech: mocks.synthesizeSpeech,
}));

type AudioListener = () => void;

class FakeAudio {
  static instances: FakeAudio[] = [];

  readonly pause = vi.fn();
  readonly play = vi.fn().mockResolvedValue(undefined);
  private readonly listeners = new Map<string, AudioListener[]>();

  constructor(readonly src: string) {
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, listener: AudioListener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
}

describe("ChatMessage の手動読み上げ", () => {
  const createObjectURL = vi.fn(() => "blob:question");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    FakeAudio.instances = [];
    mocks.synthesizeSpeech.mockResolvedValue(
      new Blob(["mp3"], { type: "audio/mpeg" }),
    );
    class FakeURL extends URL {}
    Object.assign(FakeURL, { createObjectURL, revokeObjectURL });
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("URL", FakeURL);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderMessage(speechStopSignal = 0) {
    return render(
      <ChatMessage
        turn={{ role: "assistant", content: "質問です。" }}
        speechStopSignal={speechStopSignal}
      />,
    );
  }

  it("読み上げないモードでも発言単位の手動操作を維持する", async () => {
    renderMessage();

    fireEvent.click(screen.getByRole("button", { name: "読み上げる" }));

    expect(
      await screen.findByRole("button", { name: "停止する" }),
    ).toBeInTheDocument();
    expect(mocks.synthesizeSpeech).toHaveBeenCalledWith("質問です。");
    expect(FakeAudio.instances[0].play).toHaveBeenCalledOnce();
  });

  it("読み上げないへ切り替えると再生を停止してURLを解放する", async () => {
    const view = renderMessage();
    fireEvent.click(screen.getByRole("button", { name: "読み上げる" }));
    await screen.findByRole("button", { name: "停止する" });

    view.rerender(
      <ChatMessage
        turn={{ role: "assistant", content: "質問です。" }}
        speechStopSignal={1}
      />,
    );

    await waitFor(() => expect(FakeAudio.instances[0].pause).toHaveBeenCalled());
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:question");
    expect(screen.getByRole("button", { name: "読み上げる" })).toBeEnabled();
  });

  it("音声生成中の切替後に遅れて返った音声を再生しない", async () => {
    let resolveSpeech!: (blob: Blob) => void;
    mocks.synthesizeSpeech.mockReturnValue(
      new Promise((resolve) => {
        resolveSpeech = resolve;
      }),
    );
    const view = renderMessage();
    fireEvent.click(screen.getByRole("button", { name: "読み上げる" }));
    expect(
      screen.getByRole("button", { name: "音声を準備しています" }),
    ).toBeDisabled();

    view.rerender(
      <ChatMessage
        turn={{ role: "assistant", content: "質問です。" }}
        speechStopSignal={1}
      />,
    );
    resolveSpeech(new Blob(["mp3"], { type: "audio/mpeg" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "読み上げる" })).toBeEnabled();
    });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(FakeAudio.instances).toHaveLength(0);
  });
});
