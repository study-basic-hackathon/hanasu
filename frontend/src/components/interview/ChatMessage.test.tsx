import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ChatMessage,
  type SpeechStatus,
} from "@/components/interview/ChatMessage";

describe("ChatMessage の読み上げ操作", () => {
  afterEach(() => cleanup());

  function renderMessage(status: SpeechStatus = "idle") {
    const onToggleSpeech = vi.fn();
    render(
      <ChatMessage
        turn={{ role: "assistant", content: "質問です。" }}
        speechStatus={status}
        onToggleSpeech={onToggleSpeech}
      />,
    );
    return onToggleSpeech;
  }

  it("発言単位の手動読み上げを画面共通プレイヤーへ委譲する", () => {
    const onToggleSpeech = renderMessage();

    fireEvent.click(screen.getByRole("button", { name: "読み上げる" }));

    expect(onToggleSpeech).toHaveBeenCalledOnce();
  });

  it.each([
    { status: "loading" as const, label: "音声を準備しています", disabled: true },
    { status: "playing" as const, label: "停止する", disabled: false },
    {
      status: "error" as const,
      label: "読み上げられませんでした。再試行する",
      disabled: false,
    },
  ])("$status の状態を手動操作へ反映する", ({ status, label, disabled }) => {
    renderMessage(status);

    expect(screen.getByRole("button", { name: label })).toHaveProperty(
      "disabled",
      disabled,
    );
  });

  it("自分の発言には読み上げ操作を表示しない", () => {
    render(
      <ChatMessage
        turn={{ role: "user", content: "回答です。" }}
        speechStatus="idle"
        onToggleSpeech={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "読み上げる" }),
    ).not.toBeInTheDocument();
  });
});
