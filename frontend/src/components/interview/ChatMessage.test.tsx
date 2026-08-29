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

  it("TTS対象外の面接官発言には読み上げ操作を表示しない", () => {
    render(
      <ChatMessage
        turn={{ role: "assistant", content: "お疲れ様でした" }}
        speechStatus="idle"
        onToggleSpeech={vi.fn()}
        speechEnabled={false}
      />,
    );

    expect(screen.getByText("お疲れ様でした")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "読み上げる" }),
    ).not.toBeInTheDocument();
  });
});

describe("ChatMessage の音声回答フィードバック", () => {
  afterEach(() => cleanup());

  function renderAnswer(
    turn: Parameters<typeof ChatMessage>[0]["turn"],
  ) {
    render(
      <ChatMessage
        turn={turn}
        speechStatus="idle"
        onToggleSpeech={vi.fn()}
      />,
    );
  }

  it.each([
    {
      name: "良好",
      charsPerMin: 225,
      fillerCount: 2,
      fillerCountPerMin: 2,
      className: "text-accent",
    },
    {
      name: "注意",
      charsPerMin: 100,
      fillerCount: 3,
      fillerCountPerMin: 9,
      className: "text-warning",
    },
  ])(
    "$nameの話速とフィラーへ評価結果画面と同じ色を付ける",
    ({ charsPerMin, fillerCount, fillerCountPerMin, className }) => {
      renderAnswer({
        role: "user",
        content: "音声回答です。",
        audio_seconds: 30,
        chars_per_min: charsPerMin,
        filler_count: fillerCount,
        filler_count_per_min: fillerCountPerMin,
      });

      expect(screen.getByText(String(charsPerMin))).toHaveClass(className);
      expect(screen.getByText(String(fillerCount))).toHaveClass(className);
      expect(screen.getByText(`話速`, { exact: false })).toHaveTextContent(
        `話速 ${charsPerMin} 文字/分`,
      );
      expect(screen.getByText(`フィラー`, { exact: false })).toHaveTextContent(
        `フィラー ${fillerCount} 回`,
      );
    },
  );

  it("要改善の値を赤色にし、フィラー過多と速すぎる話速の助言を表示する", () => {
    renderAnswer({
      role: "user",
      content: "音声回答です。",
      audio_seconds: 30,
      chars_per_min: 400,
      filler_count: 4,
      filler_count_per_min: 18,
    });

    expect(screen.getByText("400")).toHaveClass("text-danger");
    expect(screen.getByText("4")).toHaveClass("text-danger");
    expect(
      screen.getByText("次はフィラーを少なめにしましょう"),
    ).toHaveClass("text-danger");
    expect(
      screen.getByText("次はもう少しゆっくり話しましょう"),
    ).toHaveClass("text-danger");
  });

  it("音声回答の計測値が欠けた指標を計測値なしとして表示する", () => {
    renderAnswer({
      role: "user",
      content: "音声回答です。",
      audio_seconds: 30,
    });

    expect(screen.getAllByText("計測値なし", { exact: false })).toHaveLength(
      2,
    );
    expect(
      screen.queryByText("次はフィラーを少なめにしましょう"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("次はもう少しゆっくり話しましょう"),
    ).not.toBeInTheDocument();
  });

  it("文字入力の回答には話速とフィラー評価を表示しない", () => {
    renderAnswer({
      role: "user",
      content: "文字入力の回答です。",
      filler_count: 2,
      time: "12:34",
    });

    expect(screen.getByText("12:34")).toBeInTheDocument();
    expect(screen.queryByText("話速", { exact: false })).not.toBeInTheDocument();
    expect(
      screen.queryByText("フィラー", { exact: false }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("音声", { exact: false })).not.toBeInTheDocument();
  });
});

describe("ChatMessage の文字起こし表示", () => {
  afterEach(() => cleanup());

  it("音声回答はフィラーなしを初期表示し、フィラーありでは記号を除いて色を変える", () => {
    const turn = {
      role: "user" as const,
      content: "回答です。",
      raw_content: "%えー% 回答です。",
      audio_duration_ms: 2_000,
    };
    const view = render(
      <ChatMessage
        turn={turn}
        speechStatus="idle"
        onToggleSpeech={vi.fn()}
      />,
    );

    expect(screen.getByText("回答です。", { exact: true })).toBeInTheDocument();
    expect(
      screen.queryByText("%えー% 回答です。", { exact: true }),
    ).not.toBeInTheDocument();

    view.rerender(
      <ChatMessage
        turn={turn}
        transcriptDisplayMode="raw"
        speechStatus="idle"
        onToggleSpeech={vi.fn()}
      />,
    );

    expect(screen.getByText("えー", { exact: true })).toHaveClass(
      "bg-accent-soft",
      "text-accent",
    );
    expect(screen.getByLabelText("フィラー: えー")).toBeInTheDocument();
    expect(screen.getByText("えー", { exact: true })).not.toHaveTextContent(
      "%",
    );
    expect(view.container).toHaveTextContent("えー 回答です。");
    expect(view.container).not.toHaveTextContent("%えー%");
  });

  it("複数のフィラートークンをそれぞれ記号なしで色分けする", () => {
    const view = render(
      <ChatMessage
        turn={{
          role: "user",
          content: "回答です。",
          raw_content: "%えー% %あの% 回答です。",
          audio_seconds: 2,
        }}
        transcriptDisplayMode="raw"
        speechStatus="idle"
        onToggleSpeech={vi.fn()}
      />,
    );

    expect(screen.getByText("えー", { exact: true })).toHaveClass(
      "text-accent",
    );
    expect(screen.getByText("あの", { exact: true })).toHaveClass(
      "text-accent",
    );
    expect(view.container).not.toHaveTextContent("%えー%");
    expect(view.container).not.toHaveTextContent("%あの%");
  });

  it.each([
    {
      name: "文字入力の回答",
      turn: {
        role: "user" as const,
        content: "文字入力の回答です。",
        raw_content: "%えー% 変更しない回答です。",
      },
    },
    {
      name: "面接官の発言",
      turn: {
        role: "assistant" as const,
        content: "面接官の質問です。",
        raw_content: "%えー% 変更しない質問です。",
      },
    },
  ])("$nameはフィラーありでも表示を変えない", ({ turn }) => {
    render(
      <ChatMessage
        turn={turn}
        transcriptDisplayMode="raw"
        speechStatus="idle"
        onToggleSpeech={vi.fn()}
      />,
    );

    expect(screen.getByText(turn.content, { exact: true })).toBeInTheDocument();
    expect(
      screen.queryByText(turn.raw_content, { exact: true }),
    ).not.toBeInTheDocument();
  });
});
