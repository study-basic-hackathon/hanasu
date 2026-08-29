import type { ComponentType } from "react";

/** 音声で回答したときだけ添える計測値（S-08 6章）。 */
export type AnswerDetail = {
  rawContent: string;
  audioSeconds: number;
  audioDurationMs: number;
  characterCount: number;
  fillerCount: number;
  fillerCountPerMin: number;
  charsPerMin: number;
};

/**
 * 共通シェル（InterviewScreen）が回答方式ごとの入力パネルへ渡すもの。
 * 回答方式はページで決まるため、パネルは方式の切り替えを持たない。
 */
export type InterviewInputProps = {
  onSubmit: (content: string, detail?: AnswerDetail) => void;
  /** 次の質問の取得中、または評価の開始中 */
  waiting: boolean;
  /** 上限ターンに達して回答を受け付けない状態 */
  disabled: boolean;
  /**
   * 面接官が読み上げている（生成中を含む）。
   * 常時録音では、この間もマイクを止めて自分の声だけを拾う（S-08 6.1）。
   */
  interviewerSpeaking: boolean;
  /** 面接官の読み上げ速度（倍）。音声入力モードの設定パネルから変える */
  speechPlaybackRate: number;
  onChangeSpeechPlaybackRate: (rate: number) => void;
  /** 面接の終了時に録音・文字起こし・入力中の一時データを破棄する */
  exitSignal: AbortSignal;
};

/** 共通シェルへ差し込む入力パネル。 */
export type InterviewInputPanel = ComponentType<InterviewInputProps>;
