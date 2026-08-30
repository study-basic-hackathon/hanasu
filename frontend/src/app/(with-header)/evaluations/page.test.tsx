import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EvaluationsPage from "@/app/(with-header)/evaluations/page";
import type { Evaluation } from "@/lib/domain";

const mocks = vi.hoisted(() => ({
  listEvaluations: vi.fn(),
  deleteEvaluation: vi.fn(),
}));

vi.mock("@/lib/evaluation-api", () => ({
  listEvaluations: mocks.listEvaluations,
  deleteEvaluation: mocks.deleteEvaluation,
}));

const textEvaluation: Evaluation = {
  evaluation_id: 125,
  company_id: 1,
  company_name: "株式会社テスト",
  question_strength: "standard",
  answer_method: "text",
  turn_count: 2,
  status: "completed",
  created_at: "2026-08-29T10:00:00+09:00",
  total_score: 72,
  scores: {
    structure_content: { score: 72, comment: "結論が明確です。" },
  },
  advice: [],
};

/** 別企業の結果。削除しても残る行として使う */
const otherEvaluation: Evaluation = {
  ...textEvaluation,
  evaluation_id: 126,
  company_id: 2,
  company_name: "別会社",
  created_at: "2026-08-28T10:00:00+09:00",
  total_score: 60,
};

function row(evaluationId: number): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-evaluation-id="${evaluationId}"]`,
  );
  if (!element) throw new Error(`行 ${evaluationId} が見つかりません`);
  return element;
}

function rowIds(): number[] {
  return [...document.querySelectorAll("[data-evaluation-id]")].map((element) =>
    Number(element.getAttribute("data-evaluation-id")),
  );
}

describe("EvaluationsPage の計測対象外表示", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listEvaluations.mockResolvedValue([textEvaluation]);
  });

  afterEach(() => cleanup());

  it("フィラーのない評価も3本の配置を保ち、定量2本を空で表示する", async () => {
    render(<EvaluationsPage />);

    await screen.findByText("株式会社テスト");
    const tracks = [
      ...row(textEvaluation.evaluation_id).querySelectorAll<HTMLElement>(
        ".bg-track",
      ),
    ];

    expect(tracks).toHaveLength(3);
    expect(tracks[0]).toBeEmptyDOMElement();
    expect(tracks[1]).toBeEmptyDOMElement();
    expect(tracks[2].firstElementChild).toHaveStyle({ width: "72%" });
  });
});

describe("EvaluationsPage の削除", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listEvaluations.mockResolvedValue([textEvaluation, otherEvaluation]);
    mocks.deleteEvaluation.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  /** 一覧を描き終えてから、対象行の削除ボタンを押す */
  async function openConfirm(evaluationId = textEvaluation.evaluation_id) {
    render(<EvaluationsPage />);
    await screen.findByText("株式会社テスト");
    fireEvent.click(
      within(row(evaluationId)).getByRole("button", { name: /削除/ }),
    );
  }

  it("削除は行のリンクの外側にあり、押しても S-14 へ遷移しない", async () => {
    render(<EvaluationsPage />);
    await screen.findByText("株式会社テスト");

    const deleteButton = within(row(textEvaluation.evaluation_id)).getByRole(
      "button",
      { name: /削除/ },
    );

    expect(deleteButton.closest("a")).toBeNull();
  });

  it("削除ボタンだけでは消さず、確認を挟む", async () => {
    await openConfirm();

    expect(
      screen.getByText(/の結果を削除します。元に戻せません。/),
    ).toBeInTheDocument();
    expect(mocks.deleteEvaluation).not.toHaveBeenCalled();
    expect(rowIds()).toEqual([125, 126]);
  });

  it("取り消すと何も起きない", async () => {
    await openConfirm();

    fireEvent.click(screen.getByRole("button", { name: "取り消す" }));

    expect(mocks.deleteEvaluation).not.toHaveBeenCalled();
    expect(rowIds()).toEqual([125, 126]);
  });

  it("確認すると API を呼び、その行だけを一覧から除く。一覧 API は呼び直さない", async () => {
    await openConfirm();

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(rowIds()).toEqual([126]));
    expect(mocks.deleteEvaluation).toHaveBeenCalledWith(125);
    expect(mocks.listEvaluations).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/2026-08-29 .* の 株式会社テスト の結果を削除しました。/),
    ).toBeInTheDocument();
  });

  it("削除に失敗したら赤字を1行出し、行は残したままダイアログを閉じる", async () => {
    mocks.deleteEvaluation.mockRejectedValue(new Error("失敗"));
    await openConfirm();

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "削除できませんでした。時間をおいてもう一度お試しください。",
    );
    expect(rowIds()).toEqual([125, 126]);
    expect(
      screen.queryByRole("button", { name: "削除する" }),
    ).not.toBeInTheDocument();
  });

  it("絞り込み中の企業の最後の1件を消したら、すべての企業に戻す", async () => {
    render(<EvaluationsPage />);
    await screen.findByText("株式会社テスト");

    const filter = screen.getByLabelText("表示する企業");
    fireEvent.change(filter, { target: { value: "company:株式会社テスト" } });
    expect(rowIds()).toEqual([125]);

    fireEvent.click(
      within(row(textEvaluation.evaluation_id)).getByRole("button", {
        name: /削除/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(rowIds()).toEqual([126]));
    expect(filter).toHaveValue("all");
    expect(
      screen.queryByText("この企業の結果はまだありません。"),
    ).not.toBeInTheDocument();
  });

  it("評価中・失敗した結果も削除できる", async () => {
    mocks.listEvaluations.mockResolvedValue([
      { ...textEvaluation, status: "processing", total_score: null },
      { ...otherEvaluation, status: "failed", total_score: null },
    ]);
    await openConfirm(otherEvaluation.evaluation_id);

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(rowIds()).toEqual([125]));
    expect(mocks.deleteEvaluation).toHaveBeenCalledWith(126);
  });
});
