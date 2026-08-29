import { expect, test, type Page, type Route } from "@playwright/test";

const company = {
  id: 1,
  company_name: "株式会社アルファテック",
  motivation: "利用者に近い場所でプロダクト改善に取り組みたいからです。",
  resume: "Web アプリケーション開発を3年間経験しました。",
  company_url: "https://example.com/jobs/1",
  note: null,
  job_summary: "自社サービスのバックエンド開発を担当する募集です。",
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
    if (pathname === "/companies/1" && request.method() === "PUT") {
      const body = request.postDataJSON();
      expect(body).toEqual({
        company_name: company.company_name,
        company_url: company.company_url,
        motivation: company.motivation,
        resume: company.resume,
        note: company.note,
        job_summary: "APIから取得した募集要項の要約",
      });
      return fulfillJson(route, { ...company, ...body });
    }
    if (pathname === "/job-postings/summary" && request.method() === "POST") {
      const body = request.postDataJSON();
      if (body.company_url === "https://example.com/jobs/fail") {
        return fulfillJson(
          route,
          {
            detail: {
              code: "summary_failed",
              message: "募集要項の要約を生成できませんでした。",
            },
          },
          503,
        );
      }
      expect(body).toEqual({ company_url: company.company_url });
      return fulfillJson(route, {
        summary: "APIから取得した募集要項の要約",
      });
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

    // 常時録音の区切りを操るため、入力レベルはテストから書き換えられるようにする
    Object.defineProperty(window, "__inputLevel", {
      configurable: true,
      writable: true,
      value: 0,
    });

    class FakeAudioContext {
      createAnalyser() {
        return {
          fftSize: 0,
          frequencyBinCount: 32,
          getByteFrequencyData(data: Uint8Array) {
            data.fill(
              (window as unknown as { __inputLevel: number }).__inputLevel,
            );
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
        getUserMedia: async () => {
          const track = { enabled: true, stop() {} };
          return {
            getTracks: () => [track],
            getAudioTracks: () => [track],
          };
        },
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

/**
 * 常時録音へ1発話ぶん話しかける。
 * 声を出してから黙り、無音の長さぶん待つと発話が確定して送られる。
 */
async function speakAnswer(page: Page, silenceMs = 3_400) {
  await page.evaluate(() => {
    (window as unknown as { __inputLevel: number }).__inputLevel = 40;
  });
  await page.waitForTimeout(1_300);
  await page.evaluate(() => {
    (window as unknown as { __inputLevel: number }).__inputLevel = 0;
  });
  await page.waitForTimeout(silenceMs);
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
  const setupNavigation = page.getByRole("link", { name: "練習の設定" });
  await expect(setupNavigation).toHaveAttribute("href", "/");
  await setupNavigation.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "本番モードを始める" }),
  ).toBeVisible();
});

test("ホームでモードを選び、設定・企業編集・開始・戻り先までモードを維持する", async ({
  page,
}) => {
  await page.goto("/");

  const interviewLink = page.getByRole("link", {
    name: "本番モードを始める",
  });
  const practiceLink = page.getByRole("link", {
    name: "練習モードを始める",
  });
  await expect(interviewLink).toHaveAttribute(
    "href",
    "/practice/setup?mode=interview",
  );
  await expect(practiceLink).toHaveAttribute(
    "href",
    "/practice/setup?mode=practice",
  );

  await interviewLink.click();
  await expect(page).toHaveURL(/\/practice\/setup\?mode=interview$/);
  await expect(
    page.getByRole("heading", { name: "本番モードの設定" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "練習モード" })).toHaveCount(
    0,
  );

  await page.getByRole("link", { name: "企業を追加" }).click();
  const newCompanyCancel = page.getByRole("link", { name: "取り消す" });
  await expect(newCompanyCancel).toHaveAttribute(
    "href",
    "/practice/setup?mode=interview",
  );
  await newCompanyCancel.click();
  await expect(page).toHaveURL(/\/practice\/setup\?mode=interview$/);

  await page.getByRole("link", { name: "編集" }).click();
  const editCompanyCancel = page.getByRole("link", { name: "取り消す" });
  await expect(editCompanyCancel).toHaveAttribute(
    "href",
    "/practice/setup?mode=interview",
  );
  await editCompanyCancel.click();
  await expect(page).toHaveURL(/\/practice\/setup\?mode=interview$/);

  await page.getByRole("button", { name: company.company_name }).click();
  await page.getByRole("button", { name: "本番モードを始める" }).click();
  const startDialog = page.getByRole("dialog");
  await expect(startDialog).toContainText(company.company_name);
  await expect(startDialog).toContainText(/回答方式\s*音声入力/);
  await expect(startDialog).toContainText(/質問の強度\s*標準/);
  await expect(startDialog).toContainText(/最大ターン数\s*10 ターン/);
  await expect(startDialog).toContainText(/読み上げモード\s*読み上げる/);
  await startDialog.getByRole("button", { name: "取り消す" }).click();
  await expect(page).toHaveURL(/\/practice\/setup\?mode=interview$/);
  await expect(
    page.getByRole("button", { name: company.company_name }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "本番モードを始める" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "開始する" })
    .click();
  await expect(page).toHaveURL(/\/interview\/voice\?.*companyId=1.*readAloud=enabled/);

  await page.goto("/");
  await page.getByRole("link", { name: "練習モードを始める" }).click();
  await expect(page).toHaveURL(/\/practice\/setup\?mode=practice$/);
  await expect(
    page.getByRole("heading", { name: "練習モードの設定" }),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "最大ターン数" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "練習モードを始める" }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await page.getByRole("link", { name: "設定に戻る" }).click();
  await expect(page).toHaveURL(/\/practice\/setup\?mode=practice$/);

  await page.goto("/practice/setup?mode=invalid");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();
});

test("カスタム質問強度を設定から引き継ぎ、会話APIへ毎ターン送る", async ({
  page,
}) => {
  const instruction = "回答の根拠を数値で確認してください";
  let chatRequestCount = 0;
  await page.route("http://localhost:8000/interviews/chat", async (route) => {
    chatRequestCount += 1;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      company_id: 1,
      question_strength: "custom",
      custom_question_strength: instruction,
      max_turns: 10,
    });
    return fulfillJson(route, { text: `カスタム質問${chatRequestCount}です。` });
  });

  await page.goto("/practice/setup?mode=interview");
  await page.getByRole("button", { name: "カスタム" }).click();
  const customInput = page.getByRole("textbox", {
    name: "カスタムの質問強度",
  });
  await expect(customInput).toBeVisible();
  await expect(
    page.getByText("カスタムの質問強度を入力してください。"),
  ).toBeVisible();

  await page.getByRole("button", { name: company.company_name }).click();
  await customInput.fill("指".repeat(501));
  await expect(page.getByText("501/500文字")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "本番モードを始める" }),
  ).toBeDisabled();

  await customInput.fill(`  ${instruction}  `);
  await page.getByRole("button", { name: "文字入力" }).click();
  await page.getByRole("button", { name: "本番モードを始める" }).click();
  const startDialog = page.getByRole("dialog");
  await expect(startDialog).toContainText(/質問の強度\s*カスタム/);
  await expect(startDialog).toContainText(
    new RegExp(`カスタムの指示\\s*${instruction}`),
  );
  await startDialog.getByRole("button", { name: "開始する" }).click();

  await expect(page).toHaveURL(/strength=custom/);
  await expect(page.getByText("質問の強度：カスタム")).toBeVisible();

  await page.getByPlaceholder("回答を入力してください").fill("1つ目の回答です。");
  await page.getByRole("button", { name: "送信する" }).click();
  await expect(page.getByText("カスタム質問1です。")).toBeVisible();
  await page.getByPlaceholder("回答を入力してください").fill("2つ目の回答です。");
  await page.getByRole("button", { name: "送信する" }).click();
  await expect(page.getByText("カスタム質問2です。")).toBeVisible();
  expect(chatRequestCount).toBe(2);
});

test("評価の再挑戦は本番設定、モード未確定の履歴0件導線はホームを開く", async ({
  page,
}) => {
  await page.goto("/evaluations/detail?id=87");
  await page.getByRole("link", { name: "再挑戦する" }).click();
  await expect(page).toHaveURL(/\/practice\/setup\?mode=interview$/);

  await page.route("http://localhost:8000/evaluations", async (route) => {
    if (route.request().method() === "GET") {
      return fulfillJson(route, { evaluations: [] });
    }
    return route.fallback();
  });
  await page.goto("/evaluations");
  await page.getByRole("link", { name: "面接・練習を始める" }).click();
  await expect(page).toHaveURL(/\/$/);
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

test("S-05〜S-07で応募企業情報を6項目として表示・検証・編集できる", async ({
  page,
}) => {
  await page.goto("/companies");

  await expect(
    page.getByText("募集要項 / 志望動機 / 経歴", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("企業名", { exact: true })).toBeVisible();
  await expect(page.getByText("企業名 / 職種", { exact: true })).toHaveCount(0);

  await page.goto("/practice/setup?mode=interview");
  await expect(
    page.getByText("募集要項 / 志望動機 / 経歴", { exact: true }),
  ).toBeVisible();

  await page.goto("/companies/edit?id=1");
  await expect(page.getByLabel("企業名")).toHaveValue(company.company_name);
  await expect(page.getByLabel("募集要項 URL")).toHaveValue(
    company.company_url,
  );
  await expect(page.getByLabel("志望動機")).toHaveValue(company.motivation);
  await expect(page.getByLabel("経歴・実績")).toHaveValue(company.resume);
  await expect(page.getByLabel("備考")).toHaveValue("");
  await expect(page.getByLabel("募集要項の要約")).toHaveValue(
    company.job_summary,
  );
  await expect(page.getByLabel("職種")).toHaveCount(0);
  await expect(page.getByLabel("応募書類（貼り付け）")).toHaveCount(0);
  await expect(page.getByLabel("現職 / 直近の所属")).toHaveCount(0);
  await expect(page.getByLabel("経験年数")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "募集要項の要約", exact: true }),
  ).toBeEnabled();

  await page.getByLabel("募集要項 URL").fill("ftp://example.com/jobs/1");
  await page.getByLabel("募集要項の要約").fill("要約");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(
    page.getByText(
      "http:// または https:// で始まる URL を入力してください。",
    ),
  ).toBeVisible();

  await page.getByLabel("募集要項の要約").fill("要".repeat(4_001));
  await expect(
    page.getByText("募集要項の要約は4,000文字以内で入力してください。"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "保存する" })).toBeDisabled();

  await page.getByLabel("募集要項 URL").fill("https://example.com/jobs/fail");
  await page.getByLabel("募集要項の要約").fill("失敗前の要約");
  await page
    .getByRole("button", { name: "募集要項の要約", exact: true })
    .click();
  await expect(
    page.getByText(
      "募集要項の要約を取得できませんでした。時間をおいてもう一度お試しください。",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("募集要項の要約")).toHaveValue("失敗前の要約");

  await page.getByLabel("募集要項 URL").fill(company.company_url);
  await page
    .getByRole("button", { name: "募集要項の要約", exact: true })
    .click();
  await expect(page.getByLabel("募集要項の要約")).toHaveValue(
    "APIから取得した募集要項の要約",
  );
  await page.getByRole("button", { name: "保存する" }).click();

  await expect(page).toHaveURL(/\/companies$/);
});

test("文字回答から chat と評価 API を呼び評価結果へ遷移できる", async ({ page }) => {
  await page.goto(
    "/interview/text?companyId=1&strength=hard&maxTurns=2",
  );

  await page.getByPlaceholder("回答を入力してください").fill("えー、回答です。");
  await page.getByRole("button", { name: "送信する" }).click();
  await expect(page.getByText("経験から学んだことを教えてください。")).toBeVisible();
  await expect(page.getByText(/フィラー \d+ 回/)).toHaveCount(0);

  await page.getByRole("button", { name: "中断" }).click();
  await page.getByRole("button", { name: "取り消す" }).click();
  await expect(page.getByText("えー、回答です。", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "中断" }).click();
  await page.getByRole("button", { name: "中断して評価に進む" }).click();

  await expect(page).toHaveURL(
    /\/evaluations\/detail\?id=88&from=interview$/,
  );
  await expect(
    page.getByRole("heading", { name: "合否の目安：通過見込み" }),
  ).toBeVisible();
  await expect(page.getByText("計測対象外")).toHaveCount(2);

  await page.goto("/");
  await expect(page.getByText("計測対象外")).toHaveCount(2);

  await page.goto("/evaluations");
  const textEvaluationRow = page.locator(
    'a[href="/evaluations/detail?id=88"]',
  );
  const scoreTracks = textEvaluationRow.locator(".bg-track");
  await expect(scoreTracks).toHaveCount(3);
  await expect(scoreTracks.nth(0).locator(":scope > div")).toHaveCount(0);
  await expect(scoreTracks.nth(1).locator(":scope > div")).toHaveCount(0);
  await expect(scoreTracks.nth(2).locator(":scope > div")).toHaveCount(1);
});

test("音声入力モードでは音声の計測値で評価する", async ({
  page,
}) => {
  await installFakeRecorder(page);
  const sttRequestCount = await mockStt(page);
  await page.route("http://localhost:8000/evaluations", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();

    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      answer_method: "voice",
      turn_count: 2,
      scores: {
        // 2ターンぶんの計測値をまとめて集約する
        speaking_speed: { value: 150, unit: "文字/分" },
        filler: { value: 2, unit: "回", value_per_minute: 30 },
      },
    });
    expect(
      body.turns.filter((turn: { role: string }) => turn.role === "user"),
    ).toEqual([
      { role: "user", content: "%えー% 回答です。" },
      { role: "user", content: "%えー% 回答です。" },
    ]);
    return fulfillJson(route, { evaluation_id: 87 }, 202);
  });
  await page.route("http://localhost:8000/interviews/chat", async (route) => {
    // 音声のターンはフィラー付きの文字起こしがそのまま会話 API へ渡る
    expect(route.request().postDataJSON().history.at(-1)).toEqual({
      role: "user",
      content: "%えー% 回答です。",
    });
    return fulfillJson(route, {
      text: "経験から学んだことを教えてください。",
    });
  });
  // 回答方式はページで決まるため、画面の中に切り替えは持たない
  await page.goto(
    "/interview/voice?companyId=1&strength=hard&readAloud=disabled&maxTurns=2",
  );
  await expect(
    page.getByRole("button", { name: "文字入力で回答" }),
  ).toHaveCount(0);

  await speakAnswer(page);
  await expect(
    page.getByText("経験から学んだことを教えてください。"),
  ).toBeVisible();

  await speakAnswer(page);

  await expect(page.getByText("フィラー 1 回")).toHaveCount(2);
  await page.getByRole("button", { name: "評価を見る" }).click();

  await expect(page).toHaveURL(
    /\/evaluations\/detail\?id=87&from=interview$/,
  );
  expect(sttRequestCount()).toBe(2);
});

test("S-08 は回答前に確認と評価なしでホームへ戻れる", async ({ page }) => {
  let evaluationRequestCount = 0;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/evaluations" &&
      request.method() === "POST"
    ) {
      evaluationRequestCount += 1;
    }
  });
  await page.goto(
    "/interview/text?companyId=1&strength=hard&maxTurns=2",
  );

  await page.getByRole("button", { name: "ホーム" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(evaluationRequestCount).toBe(0);
});

test("S-08 は回答後のホーム確認を取り消せ、続行しても評価を作成しない", async ({
  page,
}) => {
  let evaluationRequestCount = 0;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/evaluations" &&
      request.method() === "POST"
    ) {
      evaluationRequestCount += 1;
    }
  });
  await page.goto(
    "/interview/text?companyId=1&strength=hard&maxTurns=1",
  );
  await page.getByPlaceholder("回答を入力してください").fill("えー、回答です。");
  await page.getByRole("button", { name: "送信する" }).click();
  await expect(page.getByText("面接が終了しました。")).toBeVisible();

  await page.getByRole("button", { name: "ホーム" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "ホームに戻ると、この会話は失われます。評価は行われません。",
  );
  await page.getByRole("button", { name: "取り消す" }).click();
  await expect(page.getByText("えー、回答です。", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/interview\/text\?/);
  expect(evaluationRequestCount).toBe(0);

  await page.getByRole("button", { name: "ホーム" }).click();
  await page.getByRole("button", { name: "ホームに戻る" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();
  expect(evaluationRequestCount).toBe(0);
});

test("S-08 の音声回答を STT へ送り、送信済み・以後の表示を clean / raw で切り替える", async ({
  page,
}) => {
  await installFakeRecorder(page);
  const sttRequestCount = await mockStt(page);
  let chatRequestCount = 0;
  await page.route("http://localhost:8000/interviews/chat", async (route) => {
    chatRequestCount += 1;
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
    "/interview/voice?companyId=1&strength=hard&readAloud=disabled&maxTurns=2",
  );

  const cleanButton = page.getByRole("button", {
    name: "文字起こし表示: フィラーなし",
  });
  const rawButton = page.getByRole("button", {
    name: "文字起こし表示: フィラーあり",
  });
  await expect(rawButton).toHaveAttribute("aria-pressed", "true");

  await speakAnswer(page);

  await expect(page.getByText("えー", { exact: true })).toHaveClass(
    /text-accent/,
  );
  await expect(
    page.getByText("経験から学んだことを教えてください。"),
  ).toBeVisible();
  await cleanButton.click();
  await expect(page.getByText("回答です。", { exact: true })).toBeVisible();
  expect(sttRequestCount()).toBe(1);
  expect(chatRequestCount).toBe(1);

  await speakAnswer(page);

  await expect(page.getByText("回答です。", { exact: true })).toHaveCount(2);
  await rawButton.click();
  await expect(page.getByText("えー", { exact: true })).toHaveCount(2);
  await expect(page.getByText("回答です。", { exact: true })).toHaveCount(0);
  expect(sttRequestCount()).toBe(2);
  expect(chatRequestCount).toBe(1);
});

test("音声の設定で無音の長さを変えると、その長さで発話が確定する", async ({
  page,
}) => {
  await installFakeRecorder(page);
  const sttRequestCount = await mockStt(page);
  await page.route("http://localhost:8000/interviews/chat", async (route) =>
    fulfillJson(route, { text: "次の質問です。" }),
  );
  await page.goto(
    "/interview/voice?companyId=1&strength=hard&readAloud=disabled&maxTurns=3",
  );

  await expect(page.getByText("どうぞお話しください")).toBeVisible();
  await page.getByRole("button", { name: "音声の設定" }).click();
  const silence = page.getByLabel("無音の長さ");
  await expect(silence).toHaveValue("3");
  await silence.fill("1");
  await expect(page.getByText("1.0 秒")).toBeVisible();
  await page.getByRole("button", { name: "音声の設定を閉じる" }).click();

  // 1秒に縮めたので、3秒待たずに発話が確定する
  await speakAnswer(page, 1_400);

  await expect(page.getByText("次の質問です。")).toBeVisible();
  expect(sttRequestCount()).toBe(1);
});

test("S-03 の音声回答で STT 全計測値と raw transcript を評価へ渡す", async ({
  page,
}) => {
  await installFakeRecorder(page);
  const sttRequestCount = await mockStt(page);
  let evaluationRequestCount = 0;
  await page.route("http://localhost:8000/evaluations", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    evaluationRequestCount += 1;

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
  await page.goto("/tutorial/voice?readAloud=disabled");

  await speakAnswer(page);

  await expect(page.getByText("お疲れ様でした")).toBeVisible();
  await expect(page.getByRole("button", { name: "評価を見る" })).toBeVisible();
  await expect(page).toHaveURL(/\/tutorial\/voice/);
  expect(evaluationRequestCount).toBe(0);

  await page.getByRole("button", { name: "評価を見る" }).click();

  await expect(page).toHaveURL(
    /\/evaluations\/detail\?id=88&from=interview$/,
  );
  expect(sttRequestCount()).toBe(1);
});

test("設定画面で最大ターン数を1〜25の整数として設定できる", async ({ page }) => {
  await page.goto("/practice/setup?mode=interview");

  const input = page.getByRole("spinbutton", { name: "最大ターン数" });
  const startButton = page.getByRole("button", {
    name: "本番モードを始める",
  });
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
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "開始する" })
    .click();

  await expect(page).toHaveURL(/maxTurns=25/);
  await expect(page.getByText("ターン 1 / 25")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "完了したターン数" }))
    .toHaveAttribute("aria-valuemax", "25");
});

test("1ターンで終了表示し、不正なURL値は10、チュートリアルは1に固定する", async ({ page }) => {
  await page.goto(
    "/interview/text?companyId=1&strength=hard&maxTurns=0",
  );
  await expect(page.getByText("ターン 1 / 10")).toBeVisible();

  await page.goto("/tutorial/text?maxTurns=25");
  await expect(page.getByText("ターン 1 / 1")).toBeVisible();

  await page.goto(
    "/interview/text?companyId=1&strength=hard&maxTurns=1",
  );
  await page.getByPlaceholder("回答を入力してください").fill("えー、回答です。");
  await page.getByRole("button", { name: "送信する" }).click();

  await expect(page.getByText("お疲れ様でした")).toBeVisible();
  await expect(page.getByPlaceholder("回答を入力してください")).toBeDisabled();
  await expect(page.getByRole("button", { name: "評価を見る" })).toBeVisible();
  await expect(page).toHaveURL(/\/interview\/text\?/);

  await page.getByRole("button", { name: "評価を見る" }).click();

  await expect(page).toHaveURL(
    /\/evaluations\/detail\?id=88&from=interview$/,
  );
});
