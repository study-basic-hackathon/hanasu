"use client";

import {
  MAX_INPUT_THRESHOLD,
  MAX_SILENCE_SECONDS,
  MAX_SPEECH_PLAYBACK_RATE,
  MIN_INPUT_THRESHOLD,
  MIN_SILENCE_SECONDS,
  MIN_SPEECH_PLAYBACK_RATE,
  SILENCE_SECONDS_STEP,
  SPEECH_PLAYBACK_RATE_STEP,
  clampToRange,
} from "@/lib/interview";

type VoiceSettingsPanelProps = {
  silenceSeconds: number;
  onChangeSilenceSeconds: (seconds: number) => void;
  inputThreshold: number;
  onChangeInputThreshold: (threshold: number) => void;
  speechPlaybackRate: number;
  onChangeSpeechPlaybackRate: (rate: number) => void;
  /** いま拾えている入力レベル。感度を決める目安として見せる */
  level: number;
  maxLevel: number;
  onClose: () => void;
};

function SettingRow({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  /** 値の読み方（単位つき） */
  display: string;
  min: number;
  max: number;
  step: number;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-label font-medium text-ink-label">
          {label}
        </label>
        <span className="text-note text-ink-sub">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(clampToRange(Number(event.target.value), min, max, value))
        }
        className="w-full accent-accent"
      />
      <p className="text-note leading-[1.7] text-ink-muted">{hint}</p>
    </div>
  );
}

/**
 * 音声入力モードの設定（S-08 6.1）。
 * この面接のあいだだけ効き、保存はしない。
 */
export function VoiceSettingsPanel({
  silenceSeconds,
  onChangeSilenceSeconds,
  inputThreshold,
  onChangeInputThreshold,
  speechPlaybackRate,
  onChangeSpeechPlaybackRate,
  level,
  maxLevel,
  onClose,
}: VoiceSettingsPanelProps) {
  const levelPercent = Math.min(100, Math.round((level / maxLevel) * 100));
  const thresholdPercent = Math.min(
    100,
    Math.round((inputThreshold / maxLevel) * 100),
  );

  return (
    <div
      role="group"
      aria-label="音声の設定"
      className="absolute bottom-[calc(100%-8px)] left-6 z-10 flex w-[360px] flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-card-sm font-bold">音声の設定</h3>
        <button
          type="button"
          aria-label="音声の設定を閉じる"
          onClick={onClose}
          className="grid size-7 place-items-center rounded-control text-ink-sub hover:bg-canvas"
        >
          ✕
        </button>
      </div>

      <SettingRow
        id="silence-seconds"
        label="無音の長さ"
        value={silenceSeconds}
        display={`${silenceSeconds.toFixed(1)} 秒`}
        min={MIN_SILENCE_SECONDS}
        max={MAX_SILENCE_SECONDS}
        step={SILENCE_SECONDS_STEP}
        hint="この長さだけ黙ると、そこまでを回答として送ります。"
        onChange={onChangeSilenceSeconds}
      />

      <div className="flex flex-col gap-1.5">
        <SettingRow
          id="input-threshold"
          label="入力感度"
          value={inputThreshold}
          display={String(inputThreshold)}
          min={MIN_INPUT_THRESHOLD}
          max={MAX_INPUT_THRESHOLD}
          step={1}
          hint="この線より大きい音を発話とみなします。周りがうるさくて区切られないときは上げてください。"
          onChange={onChangeInputThreshold}
        />
        {/* いまの入力レベルと閾値の位置関係を見ながら決められるようにする */}
        <div
          role="meter"
          aria-label="いまの入力レベル"
          aria-valuemin={0}
          aria-valuemax={maxLevel}
          aria-valuenow={Math.round(level)}
          className="relative h-2 overflow-hidden rounded-full bg-track"
        >
          <span
            className="block h-full bg-accent"
            style={{ width: `${levelPercent}%` }}
          />
          <span
            className="absolute inset-y-0 w-px bg-danger"
            style={{ left: `${thresholdPercent}%` }}
          />
        </div>
      </div>

      <SettingRow
        id="speech-playback-rate"
        label="読み上げ速度"
        value={speechPlaybackRate}
        display={`${speechPlaybackRate.toFixed(1)} 倍`}
        min={MIN_SPEECH_PLAYBACK_RATE}
        max={MAX_SPEECH_PLAYBACK_RATE}
        step={SPEECH_PLAYBACK_RATE_STEP}
        hint="面接官の発言を読み上げる速さです。再生中でもすぐに変わります。"
        onChange={onChangeSpeechPlaybackRate}
      />

      <p className="text-note leading-[1.7] text-ink-muted">
        設定はこの面接のあいだだけ有効です。
      </p>
    </div>
  );
}
