import { Card } from "@/components/ui/Card";
import {
  PracticeFinishLink,
  PracticeSubLayout,
  RecordSample,
} from "@/components/practice/PracticeSubLayout";
import { SPEAKING_SPEED_RANGE } from "@/lib/score";

/** 見本の測定値 */
const MEASURED = 312;

/** 帯に描く速さの範囲 */
const SCALE_MIN = 150;
const SCALE_MAX = 450;

function positionPercent(value: number): number {
  const ratio = (value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
  return Math.min(100, Math.max(0, ratio * 100));
}

/** S-12 練習 - スピード測定（モック） */
export default function SpeedPracticePage() {
  const rangeLeft = positionPercent(SPEAKING_SPEED_RANGE.min);
  const rangeWidth =
    positionPercent(SPEAKING_SPEED_RANGE.max) - rangeLeft;

  return (
    <PracticeSubLayout screenId="S-12" name="スピード測定">
      <Card className="flex flex-1 items-center gap-6 p-6">
        <p className="flex-1 text-body-sm leading-[2.1] text-ink-label">
          課題文：前職では、開発チームの進行管理を担当し、週次の見通しを関係者に共有していました。
        </p>
        <div className="flex w-[190px] flex-none flex-col gap-2.5 border-l border-divider pl-6">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[32px] leading-none font-bold">
              {MEASURED}
            </span>
            <span className="text-note text-ink-muted">文字/分</span>
          </div>
          {/* 適正域を帯で示し、現在値の位置に印を置く（S-12） */}
          <div className="relative h-2 rounded-control bg-track">
            <div
              className="absolute h-2 rounded-control bg-[#cfe4e1]"
              style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
            />
            <div
              className="absolute -top-1 h-4 w-0.5 bg-ink"
              style={{ left: `${positionPercent(MEASURED)}%` }}
            />
          </div>
          <span className="text-note text-accent">
            適正域（{SPEAKING_SPEED_RANGE.min}〜{SPEAKING_SPEED_RANGE.max}
            ）の中にあります
          </span>
        </div>
      </Card>
      <div className="flex items-center gap-4">
        <RecordSample recording />
        <span className="flex-1 text-label text-ink-sub">測定中 00:24</span>
        <PracticeFinishLink />
      </div>
    </PracticeSubLayout>
  );
}
