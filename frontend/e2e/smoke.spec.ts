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

const textEvaluation = {
  evaluation_id: 88,
  company_id: 1,
  company_name: company.company_name,
  status: "completed",
  created_at: "2026-08-25T03:00:00Z",
  total_score: 72,
  scores: {
    structure_content: {
      score: 72,
      comment: "結論を先に伝えられています。",
    },
  },
  advice: ["具体例を加えましょう。"],
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
        max_turns: 2,
      });
      expect(body.history.at(-1)).toEqual({
        role: "user",
        content: "えー、回答です。",
      });
      return fulfillJson(route, { text: "経験から学んだことを教えてください。" });
    }
    if (pathname === "/evaluations" && request.method() === "POST") {
      const body = request.postDataJSON();
      expect(body).toMatchObject({
        company_id: 1,
        question_strength: "hard",
        answer_method: "text",
        turn_count: 1,
      });
      expect(body.scores).toEqual({});
      return fulfillJson(route, { evaluation_id: 88 }, 202);
    }
    if (pathname === "/evaluations" && request.method() === "GET") {
      return fulfillJson(route, {
        evaluations: [
          {
            evaluation_id: textEvaluation.evaluation_id,
            company_name: textEvaluation.company_name,
            status: textEvaluation.status,
            created_at: textEvaluation.created_at,
            total_score: textEvaluation.total_score,
            scores: textEvaluation.scores,
          },
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
      return fulfillJson(route, textEvaluation);
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

async function installFakeRecorder(page: Page) {
  await page.addInitScript(() => {
    class FakeMediaRecorder extends EventTarget {
      static isTypeSupported(type: string) {
        return type === "audio/webm;codecs=opus";
      }

      readonly mimeType: string;
      state: RecordingState = "inactive";

      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        super();
        this.mimeType = options?.mimeType ?? "audio/webm";
      }

      start() {
        this.state = "recording";
      }

      stop() {
        if (this.state !== "recording") return;
        this.state = "inactive";
        const data = new Blob(["synthetic recorded audio"], {
          type: this.mimeType,
        });
        this.dispatchEvent(new BlobEvent("dataavailable", { data }));
        this.dispatchEvent(new Event("stop"));
      }
    }

    class FakeAudioContext {
      createAnalyser() {
        return {
          fftSize: 0,
          frequencyBinCount: 32,
          getByteFrequencyData(data: Uint8Array) {
            data.fill(16);
          },
        };
      }

      createMediaStreamSource() {
        return { connect() {} };
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() {} }],
        }),
      },
    });
  });
}

async function mockStt(page: Page) {
  let requestCount = 0;
  await page.route("http://localhost:8000/interviews/stt", async (route) => {
    requestCount += 1;
    const request = route.request();
    const headers = request.headers();
    const multipart = request.postDataBuffer()?.toString("utf8") ?? "";

    expect(headers.authorization).toBe("Bearer e2e-token");
    expect(headers["content-type"]).toMatch(
      /^multipart\/form-data; boundary=/,
    );
    expect(multipart).toContain('name="audio"');
    expect(multipart).toContain('filename="answer.webm"');
    expect(multipart).toContain("Content-Type: audio/webm;codecs=opus");

    return fulfillJson(route, {
      raw_transcript: "%えー% 回答です。",
      clean_transcript: "回答です。",
      filler_count: 1,
      filler_count_per_min: 30,
      duration_ms: 2_000,
      chars: 5,
      chars_per_min: 150,
    });
  });
  return () => requestCount;
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("主要ページをグローバルナビゲーションで移動できる", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();

  await page.getByRole("link", { name: "履歴", exact: true }).click();

  await expect(page).toHaveURL(/\/evaluations$/);
  await expect(page.getByRole("heading", { name: "履歴" })).toBeVisible();

  await page.getByRole("link", { name: "ホーム", exact: true }).click();

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
    "/interview?companyId=1&strength=hard&answerMethod=text&maxTurns=2",
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
  await expect(page.getByText("計測対象外")).toHaveCount(2);
});

test("S-08 の音声回答を STT へ1回だけ送り clean 表示・raw 会話を使う", async ({
  page,
}) => {
  await installFakeRecorder(page);
  const sttRequestCount = await mockStt(page);
  await page.route("http://localhost:8000/interviews/chat", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.history.at(-1)).toEqual({
      role: "user",
      content: "%えー% 回答です。",
    });
    return fulfillJson(route, {
      text: "経験から学んだことを教えてください。",
    });
  });
  await page.goto(
    "/interview?companyId=1&strength=hard&answerMethod=voice&maxTurns=2",
  );

  await page.getByRole("button", { name: "回答を録音する" }).click();
  await page.waitForTimeout(1_100);
  await page
    .getByRole("button", { name: "録音を停止して送信する" })
    .click();

  await expect(page.getByText("回答です。", { exact: true })).toBeVisible();
  await expect(
    page.getByText("経験から学んだことを教えてください。"),
  ).toBeVisible();
  expect(sttRequestCount()).toBe(1);
});

test("S-03 の音声回答で STT 全計測値と raw transcript を評価へ渡す", async ({
  page,
}) => {
  await installFakeRecorder(page);
  const sttRequestCount = await mockStt(page);
  await page.route("http://localhost:8000/evaluations", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();

    expect(route.request().postDataJSON()).toMatchObject({
      company_id: null,
      answer_method: "voice",
      turn_count: 1,
      turns: [
        { role: "assistant", content: "1分で自己紹介してください。" },
        { role: "user", content: "%えー% 回答です。" },
      ],
      scores: {
        speaking_speed: { value: 150, unit: "文字/分" },
        filler: { value: 1, unit: "回", value_per_minute: 30 },
      },
    });
    return fulfillJson(route, { evaluation_id: 88 }, 202);
  });
  await page.goto("/tutorial");

  await page.getByRole("button", { name: "回答を録音する" }).click();
  await page.waitForTimeout(1_100);
  await page
    .getByRole("button", { name: "録音を停止して送信する" })
    .click();

  await expect(page).toHaveURL(
    /\/evaluations\/detail\?id=88&from=interview$/,
  );
  expect(sttRequestCount()).toBe(1);
});

test("設定画面で最大ターン数を1〜25の整数として設定できる", async ({ page }) => {
  await page.goto("/practice/setup");

  const input = page.getByRole("spinbutton", { name: "最大ターン数" });
  const startButton = page.getByRole("button", { name: "開始する" });
  await expect(input).toHaveValue("10");

  await page.getByRole("button", { name: "最大ターン数を1減らす" }).click();
  await expect(input).toHaveValue("9");
  await page.getByRole("button", { name: "最大ターン数を1増やす" }).click();
  await expect(input).toHaveValue("10");

  await page.getByRole("button", { name: company.company_name }).click();
  await input.fill("0");
  await expect(
    page.getByText("最大ターン数は1〜25の整数で入力してください。"),
  ).toBeVisible();
  await expect(startButton).toBeDisabled();

  await input.fill("25");
  await expect(startButton).toBeEnabled();
  await startButton.click();

  await expect(page).toHaveURL(/maxTurns=25/);
  await expect(page.getByText("ターン 1 / 25")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "完了したターン数" }))
    .toHaveAttribute("aria-valuemax", "25");
});

test("1ターンで自動終了し、不正なURL値は10、チュートリアルは1に固定する", async ({ page }) => {
  await page.goto(
    "/interview?companyId=1&strength=hard&answerMethod=text&maxTurns=0",
  );
  await expect(page.getByText("ターン 1 / 10")).toBeVisible();

  await page.goto("/tutorial?maxTurns=25");
  await expect(page.getByText("ターン 1 / 1")).toBeVisible();

  await page.goto(
    "/interview?companyId=1&strength=hard&answerMethod=text&maxTurns=1",
  );
  await page.getByPlaceholder("回答を入力してください").fill("えー、回答です。");
  await page.getByRole("button", { name: "送信する" }).click();

  await expect(page).toHaveURL(
    /\/evaluations\/detail\?id=88&from=interview$/,
  );
});
