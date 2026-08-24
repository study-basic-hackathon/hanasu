import { expect, test, type Page, type Route } from "@playwright/test";

const company = {
  id: 1,
  company_name: "株式会社アルファテック",
  motivation: "利用者に近い場所でプロダクト改善に取り組みたいからです。",
  resume: "Web アプリケーション開発を3年間経験しました。",
  company_url: "https://example.com/jobs/1",
  note: null,
  created_at: "2026-08-20T03:00:00Z",
};

const evaluation = {
  evaluation_id: 87,
  company_id: 1,
  company_name: company.company_name,
  status: "completed",
  created_at: "2026-08-24T03:00:00Z",
  total_score: 78,
  scores: {
    speaking_speed: { score: 82, value: 310 },
    filler: { score: 74, value: 3, value_per_minute: 1.2 },
    structure_content: {
      score: 77,
      comment: "結論から伝えられています。具体例を加えるとさらに明確です。",
    },
  },
  advice: ["最初に結論を置き、経験を数値で補足しましょう。"],
};

async function mockApi(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("hanasu.accessToken", "e2e-token");
  });

  await page.route("http://localhost:8000/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    expect(request.headers().authorization).toBe("Bearer e2e-token");

    if (pathname === "/users/me") {
      return fulfillJson(route, { id: 1, username: "e2e-user" });
    }
    if (pathname === "/companies" && request.method() === "GET") {
      return fulfillJson(route, [company]);
    }
    if (pathname === "/companies/1" && request.method() === "GET") {
      return fulfillJson(route, company);
    }
    if (pathname === "/interviews/chat") {
      const body = request.postDataJSON();
      expect(body).toMatchObject({
        company_id: 1,
        question_strength: "hard",
      });
      expect(body.history.at(-1)).toEqual({
        role: "user",
        content: "えー、回答です。",
      });
      return fulfillJson(route, { text: "経験から学んだことを教えてください。" });
    }
    if (pathname === "/evaluations" && request.method() === "POST") {
      expect(request.postDataJSON()).toMatchObject({
        company_id: 1,
        question_strength: "hard",
        answer_method: "text",
        turn_count: 1,
        scores: {
          filler: { score: 80, value: 1, unit: "回" },
        },
      });
      return fulfillJson(route, { evaluation_id: 88 }, 202);
    }
    if (pathname === "/evaluations" && request.method() === "GET") {
      return fulfillJson(route, {
        evaluations: [
          {
            evaluation_id: evaluation.evaluation_id,
            company_name: evaluation.company_name,
            status: evaluation.status,
            created_at: evaluation.created_at,
            total_score: evaluation.total_score,
            scores: evaluation.scores,
          },
        ],
      });
    }
    if (pathname === "/evaluations/87") {
      return fulfillJson(route, evaluation);
    }
    if (pathname === "/evaluations/88") {
      return fulfillJson(route, {
        evaluation_id: 88,
        company_id: 1,
        company_name: company.company_name,
        status: "completed",
        created_at: "2026-08-25T03:00:00Z",
        total_score: 76,
        scores: {
          filler: { score: 80, value: 1, unit: "回" },
          structure_content: {
            score: 72,
            comment: "結論を先に伝えられています。",
          },
        },
        advice: ["具体例を加えましょう。"],
      });
    }

    return route.fulfill({ status: 404, body: "Not Found" });
  });
}

function fulfillJson(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("主要ページをグローバルナビゲーションで移動できる", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();

  await page.getByRole("link", { name: "応募先企業", exact: true }).click();

  await expect(page).toHaveURL(/\/companies$/);
  await expect(
    page.getByRole("heading", { name: "応募企業情報" }),
  ).toBeVisible();
});

test("静的な詳細 URL から企業編集と評価結果を表示できる", async ({ page }) => {
  await page.goto("/companies/edit?id=1");

  await expect(
    page.getByRole("heading", { name: company.company_name }),
  ).toBeVisible();
  await expect(page.getByLabel("企業名")).toHaveValue(company.company_name);

  await page.goto("/evaluations/detail?id=87");

  await expect(
    page.getByRole("heading", { name: "合否の目安：通過見込み" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "アドバイス" })).toBeVisible();
});

test("文字回答から chat と評価 API を呼び評価結果へ遷移できる", async ({ page }) => {
  await page.goto(
    "/interview?companyId=1&strength=hard&answerMethod=text",
  );

  await page.getByPlaceholder("回答を入力してください").fill("えー、回答です。");
  await page.getByRole("button", { name: "送信する" }).click();
  await expect(page.getByText("経験から学んだことを教えてください。")).toBeVisible();

  await page.getByRole("button", { name: "面接を終える" }).click();
  await page.getByRole("button", { name: "評価に進む" }).click();

  await expect(page).toHaveURL(
    /\/evaluations\/detail\?id=88&from=interview$/,
  );
  await expect(
    page.getByRole("heading", { name: "合否の目安：通過見込み" }),
  ).toBeVisible();
  await expect(page.getByText("計測対象外")).toBeVisible();
});
