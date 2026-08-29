import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TextAnswerPanel } from "@/components/interview/TextAnswerPanel";

describe("TextAnswerPanel", () => {
  afterEach(cleanup);

  function renderPanel(
    options: {
      onSubmit?: (content: string) => void;
      waiting?: boolean;
      disabled?: boolean;
      exitSignal?: AbortSignal;
    } = {},
  ) {
    const onSubmit = options.onSubmit ?? vi.fn();
    render(
      <TextAnswerPanel
        onSubmit={onSubmit}
        waiting={options.waiting ?? false}
        disabled={options.disabled ?? false}
        interviewerSpeaking={false}
        onSkipInterviewerSpeech={vi.fn()}
        speechPlaybackRate={1.2}
        onChangeSpeechPlaybackRate={vi.fn()}
        exitSignal={options.exitSignal ?? new AbortController().signal}
      />,
    );
    return { onSubmit, textarea: screen.getByPlaceholderText("回答を入力してください") };
  }

  it("前後の空白を落として送信し、入力欄を空に戻す", () => {
    const { onSubmit, textarea } = renderPanel();

    fireEvent.change(textarea, { target: { value: "  回答です。  " } });
    fireEvent.click(screen.getByRole("button", { name: "送信する" }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("回答です。");
    expect(textarea).toHaveValue("");
  });

  it("Ctrl + Enter で送信する", () => {
    const { onSubmit, textarea } = renderPanel();

    fireEvent.change(textarea, { target: { value: "キーボードの回答です。" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("キーボードの回答です。");
  });

  it("空白だけの入力は送信できない", () => {
    const { onSubmit, textarea } = renderPanel();

    fireEvent.change(textarea, { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "送信する" })).toBeDisabled();

    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("次の質問を待っている間は入力と送信を受け付けない", () => {
    const { textarea } = renderPanel({ waiting: true });

    expect(textarea).toBeDisabled();
    expect(screen.getByRole("button", { name: "送信する" })).toBeDisabled();
  });

  it("面接の終了時に入力中の文章を捨てる", () => {
    const controller = new AbortController();
    const { textarea } = renderPanel({ exitSignal: controller.signal });
    fireEvent.change(textarea, { target: { value: "捨てられる回答です。" } });

    act(() => controller.abort());

    expect(textarea).toHaveValue("");
    expect(textarea).toBeDisabled();
  });

  it("回答方式の切り替えは持たない", () => {
    renderPanel();

    expect(
      screen.queryByRole("button", { name: "音声入力で回答" }),
    ).not.toBeInTheDocument();
  });
});
