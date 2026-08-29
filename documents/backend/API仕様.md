# API 仕様

**本サービスが提供する API の一覧と、その入出力を定める。** 実装は `backend/`（Python / FastAPI）が担う。

## 1. 共通事項

- **全 API に `Authorization: Bearer <access_token>` を付ける。** ただし**認証 API（`POST /token`）だけは未認証で実行できる**
- **サーバーは会話状態を持たない**（[ADR-0008](../ADR/0008-会話用APIの構成.md)）。会話履歴と質問強度はクライアントが保持し、毎リクエストに含めて送る
- **音声・会話履歴・文字起こしは永続化しない**（[ADR-0007](../ADR/0007-会話音声の取得と保存方式.md)）。サーバーは処理後に破棄する
- **会員登録 API は作らない。** 固定の ID / パスワード1組を使う（[ADR-0011](../ADR/0011-会員登録と利用アカウント.md)）
- **サインアウト API は作らない。** トークンの破棄はクライアント側で行う
- **ユーザーは1つだけのため、取得系をユーザーで絞り込まない**（[ADR-0011](../ADR/0011-会員登録と利用アカウント.md)）
- 応募情報 CRUD のパス名・フィールド名は本書4章で確定済み。その他の未確定事項は [7. 未確定事項](#7-未確定事項) に記載する

## 2. API 一覧

| # | エンドポイント | 役割 | 実装範囲 |
|---:|---|---|---|
| 1 | `POST /token` | 認証（ID / パスワード → JWT アクセストークン） | 作る |
| 2 | `GET /users/me` | 認証中のユーザーを返す | 作る |
| 3 | `GET /companies` / `POST /companies` / `GET /companies/{company_id}` / `PUT /companies/{company_id}` / `DELETE /companies/{company_id}` | 応募情報の登録・参照・更新・削除 | 作る |
| 4 | `POST /job-postings/summary` | 募集要項 URL から要約を生成する | 作る |
| 5 | `POST /interviews/start` | 最初の質問を生成する | **任意。** 作らない場合はフロントが固定文字列を持つ |
| 6 | `POST /interviews/stt` | 文字起こし + フィラー数 + 話速 | 作る |
| 7 | `POST /interviews/chat` | 次の質問を生成する | 作る |
| 8 | `POST /interviews/tts` | 面接官の発言を音声化する | **任意。** 作らない場合は画面に文字表示するだけでよい |
| 9 | `POST /evaluations` | 評価を実行する（非同期） | 作る |
| 10 | `GET /evaluations/{evaluation_id}` | 評価結果を取得する | 作る |
| 11 | `GET /evaluations` | 評価履歴を一覧する | 作る |

## 3. 認証

### 3.1 `POST /token` — 認証

```
Content-Type: application/x-www-form-urlencoded
username=<ID>&password=<パスワード>
```

```json
// レスポンス
{ "access_token": "<JWT>", "token_type": "bearer" }
```

- **未認証で実行できる唯一の API**
- ID / パスワードは固定の1組（[ADR-0011](../ADR/0011-会員登録と利用アカウント.md)）
- 認証に失敗した場合は `400` を返す

### 3.2 `GET /users/me` — 認証中のユーザー

```json
// レスポンス
{ "id": 1, "username": "hanasu" }
```

- トークンが無効・失効している場合は `401` を返す

## 4. 応募情報

**実態は「応募情報」である。** 企業情報だけでなく**志望動機・経歴（応募者自身の情報）を1レコードで持つ**（[ADR-0009](../ADR/0009-評価方式.md)）。プロフィールという独立した登録は持たない。

### 4.1 エンドポイント

| 操作 | メソッド / パス | インプット | 成功時のアウトプット |
|---|---|---|---|
| Create | `POST /companies` | リクエストボディに CompanyInput | `201` と Company |
| List | `GET /companies` | なし | `200` と Company の配列 |
| Read | `GET /companies/{company_id}` | パスに企業 ID | `200` と Company |
| Update | `PUT /companies/{company_id}` | パスに企業 ID、リクエストボディに CompanyInput | `200` と Company |
| Delete | `DELETE /companies/{company_id}` | パスに企業 ID | `204`（レスポンスボディなし） |

- **List は必須。** 単体取得だけでは企業 ID を知る手段がなく、モード選択の企業リストと応募企業情報の一覧画面がこの API に依存する
- **List は絞り込み・ページネーションを行わず全件を返す**（ユーザーは1つのため）
- `PUT` は CompanyInput の全項目を受け取る全体更新とする

### 4.2 入出力の項目

CompanyInput と Company が扱う応募情報は次の6項目である。画面と API のラベル対応は [S-07 応募企業情報 登録 / 編集](../frontend/01_design/screens/S-07_応募企業情報_登録編集.md) を参照する。

| API フィールド | 型 | CompanyInput | Company | 最大長 | 制約 |
|---|---|---|---|---:|---|
| `company_name` | `string` | **必須** | `string` | 100文字 | 空文字・空白のみは不可。全レコードで一意 |
| `company_url` | `string \| null` | 任意 | `string \| null` | 2,048文字 | 入力する場合は有効な HTTP(S) URL |
| `motivation` | `string` | **必須** | `string \| null` | 4,000文字 | 空文字・空白のみは不可。Company の `null` は既存データとの互換性のため許容 |
| `resume` | `string \| null` | 任意 | `string \| null` | 10,000文字 | 経歴・実績 |
| `note` | `string \| null` | 任意 | `string \| null` | 2,000文字 | 備考 |
| `job_summary` | `string \| null` | 任意 | `string \| null` | 4,000文字 | 募集要項の要約。最大長は S-07 だけが検査する |

- 最大長はバイト数ではなく、**入力の前後の空白を除いた文字数**で判定する
- **`job_summary` の 4,000文字上限は [S-07](../frontend/01_design/screens/S-07_応募企業情報_登録編集.md) のフロントエンド入力制約である。** `POST /companies` と `PUT /companies/{company_id}` のバックエンドは `job_summary` の最大長を検査せず、4,000文字を超える値も入出力できる
- `company_url` / `resume` / `note` / `job_summary` は、CompanyInput でキー省略または `null` を許容する。空文字・空白のみは `null` に正規化する
- Company は6項目のキーを常に含み、任意項目の未入力は `null` で返す
- `id` と `created_at` は Company のレスポンス専用メタデータであり、CompanyInput には含めない。S-06 / S-07 の表示項目にも数えない

### 4.3 入出力例

```json
// POST /companies または PUT /companies/{company_id}
{
  "company_name": "株式会社サンプル",
  "company_url": "https://example.com/jobs/123",
  "motivation": "顧客課題の解決に技術で貢献したいためです。",
  "resume": "Web アプリケーション開発に3年従事しました。",
  "note": null,
  "job_summary": "自社サービスのバックエンド開発を担当する募集です。"
}
```

```json
// Company
{
  "id": 12,
  "company_name": "株式会社サンプル",
  "company_url": "https://example.com/jobs/123",
  "motivation": "顧客課題の解決に技術で貢献したいためです。",
  "resume": "Web アプリケーション開発に3年従事しました。",
  "note": null,
  "job_summary": "自社サービスのバックエンド開発を担当する募集です。",
  "created_at": "2026-08-28T10:00:00Z"
}
```

### 4.4 エラー

| 状況 | HTTP ステータス |
|---|---:|
| 認証できない | `401` |
| Read / Update / Delete で企業 ID が存在しない | `404` |
| Create / Update で企業名が重複する | `409` |
| CompanyInput の必須・型・形式、または `job_summary` 以外の最大長の制約に違反する | `422` |

### 4.5 `POST /job-postings/summary` — 募集要項の要約

認証済みユーザーが募集要項 URL を1件送信し、取得・本文抽出・AI要約の完了を待って要約を受け取る。

```json
// リクエスト
{ "company_url": "https://example.com/jobs/123" }
```

| 項目 | 型 | 必須 | 制約 |
|---|---|---|---|
| `company_url` | `string` | **必須** | 2,048文字以内の有効な HTTP(S) URL |

```json
// 200 レスポンス
{ "summary": "自社サービスのバックエンド開発を担当する募集です。" }
```

- `summary` は空でない文字列とし、S-07 の `job_summary` へ反映する
- **要約 API は `summary` の最大長を検査せず、切り詰めも行わない。** S-07 が `job_summary` の 4,000文字上限を検査する
- この API は要約を保存しない。保存は S-07 が従来どおり `POST /companies` または `PUT /companies/{company_id}` の `job_summary` で行う
- JavaScript の実行、ログイン、Cookie、CAPTCHA が必要なページと、HTML 以外のコンテンツは対象外とする
- 接続先は公開 HTTP(S) URL に限る。localhost、認証情報を含む URL、プライベート・ループバック・リンクローカルアドレスと、それらへのリダイレクトは拒否する

失敗時は次の形式で返す。`code` はフロントエンドの分岐用の固定値、`message` は利用者向けの文言である。

```json
{
  "detail": {
    "code": "invalid_url",
    "message": "有効なHTTP(S) URLを指定してください。"
  }
}
```

| 状況 | HTTP ステータス | `detail.code` | `detail.message` |
|---|---:|---|---|
| 認証できない | `401` | — | 既存の認証エラーを返す |
| `company_url` が未指定、上限超過、または HTTP(S) URL でない | `422` | `invalid_url` | `有効なHTTP(S) URLを指定してください。` |
| 禁止した接続先またはリダイレクト先である | `422` | `url_not_allowed` | `指定されたURLにはアクセスできません。` |
| タイムアウト、DNS・接続失敗、取得先のエラー応答で取得できない | `502` | `fetch_failed` | `募集要項を取得できませんでした。` |
| HTML 以外、または取得サイズの安全上限を超える | `422` | `unsupported_content` | `このページは募集要項の要約に対応していません。` |
| HTML から要約に使える本文を抽出できない | `422` | `extraction_failed` | `募集要項の本文を抽出できませんでした。` |
| AI 呼び出しの失敗、または応答が空 | `503` | `summary_failed` | `募集要項の要約を生成できませんでした。` |

## 5. 面接と評価

### 5.1 `POST /interviews/start` — 最初の質問（**任意**）

```json
// リクエスト
{ "company_id": 12, "question_strength": "standard" }
```

```json
// レスポンス
{ "first_question": "本日はよろしくお願いします。まず自己紹介をお願いします。" }
```

- 企業情報・志望動機・経歴は **`company_id` からサーバーが読む**（登録済みのため送り直さない）
- **この API を作らない場合は、フロントが最初の質問を固定文字列として持つ**

### 5.2 `POST /interviews/stt` — 文字起こし

```
Content-Type: multipart/form-data
audio: <録音した音声 (webm/opus)>
```

```json
// レスポンス
{
  "raw_transcript": "%えー% 私は前職で %あの% チームリーダーを...",
  "clean_transcript": "私は前職でチームリーダーを...",
  "filler_count": 2,
  "filler_count_per_min": 6.3,
  "duration_ms": 19000,
  "chars": 88,
  "chars_per_min": 278
}
```

- **AmiVoice に `keepFillerToken=1` を必ず付与する**（[ADR-0010](../ADR/0010-音声認識とLLMの基盤選定.md)）。フィラーは `%えー%` の形で返る
- **`raw_transcript` を捨てない。** 整形すると評価が機能しなくなる。`clean_transcript` は**画面表示専用**であり、LLM に渡すのは `raw_transcript`
- **話速は文字数 ÷ 発話時間で算出する。** 音声の長さはサーバー側で取れるため、`duration_ms` / `chars` / `chars_per_min` までサーバーが算出して返す
- **フィラーの頻度は `filler_count ÷ 発話時間` で算出し、`filler_count_per_min` として小数第1位まで返す**（画面表示は`documents/frontend/01_design/screen_common.md`の「回 / 回/分」形式）
- 評価時は回答ごとの `chars` / `filler_count` / `duration_ms` を合算する。表示用に丸めた `chars_per_min` / `filler_count_per_min` は、回答間で平均せず、点数化にも使わない（[評価仕様](../評価仕様.md) 3章）
- **文字入力のターンではこの API を呼ばない**

### 5.3 `POST /interviews/chat` — 次の質問

```json
// リクエスト
{
  "company_id": 12,
  "question_strength": "standard",
  "history": [
    { "role": "assistant", "content": "まず自己紹介をお願いします" },
    { "role": "user",      "content": "%えー% 田中と申します。前職では..." }
  ]
}
```

カスタム指定では、質問強度の指示を自然言語で添える。

```json
// リクエスト（カスタム指定）
{
  "company_id": 12,
  "question_strength": "custom",
  "custom_question_strength": "回答の根拠を数値で確認し、曖昧な点を深掘りしてください",
  "history": [
    { "role": "assistant", "content": "まず自己紹介をお願いします" },
    { "role": "user",      "content": "%えー% 田中と申します。前職では..." }
  ]
}
```

```json
// レスポンス
{ "text": "前職ではどのような役割を担っていましたか？" }
```

- `question_strength` は必須で、`easy` / `standard` / `hard` / `custom` のいずれかとする
- `easy` は「優しい口調で、基本的な質問」、`standard` は「一般的な面接と同じ調子」、`hard` は「曖昧な点や矛盾を深掘りして鋭く追及」という既定の指示を使う。`custom` は `custom_question_strength` の自然言語を質問強度の指示として使う
- `custom_question_strength` は `custom` のときだけ必須で、前後の空白を除いて1〜500文字とする。プリセットとの同時指定は認めない
- `question_strength` の欠落・不正値、旧フィールド `intensity`、未定義フィールド、条件に合わない `custom_question_strength` は `422` とする。黙って標準扱いしない
- サーバーは `company_id` から応募情報を読み、**質問強度を system プロンプトの言い回しに反映する。「次の質問を1つだけ返す」「質問文以外を返さない」などの固定制約は全強度で維持する**
- **質問強度と、`custom` の場合の自然言語は毎ターン送る。** サーバーが状態を持たないため、開始時に一度だけ渡すことができない
- **ストリーミングしない。** 1回の JSON で返す
- **終了フラグは持たない。** ターン数の上限はフロント側で管理する（[ADR-0008](../ADR/0008-会話用APIの構成.md)）
- **音声入力・文字入力の両方のターンがこの API に届く**
- LLM に渡す履歴の範囲はフロントの裁量とする

### 5.4 `POST /interviews/tts` — 音声化（**任意**）

```json
// リクエスト
{ "text": "前職ではどのような役割を担っていましたか？" }
```

レスポンス: **`audio/mpeg`（バイナリ）**

- **発言全体を1回で音声化する。** 「句読点が来たタイミングで TTS に投げる」方式は実装しない
- **この API を作らない場合は、面接官の発言をチャット画面に文字列で表示するだけでよい**

### 5.5 `POST /evaluations` — 評価の実行（**非同期**）

```json
// リクエスト
{
  "company_id": 12,
  "question_strength": "standard",
  "turn_count": 1,
  "turns": [
    { "role": "assistant", "content": "まず自己紹介をお願いします" },
    { "role": "user",      "content": "%えー% 田中と申します。前職では..." }
  ],
  "scores": {
    "speaking_speed": { "score": 92, "value": 284, "unit": "文字/分" },
    "filler":         { "score": 67, "value": 2, "value_per_minute": 4.0, "unit": "回" }
  }
}
```

```json
// レスポンス
{ "evaluation_id": 87 }
```

- **`company_id` はチュートリアルでは省略する**（評価結果テーブルの企業IDは NULL を許す）。このとき `question_strength` は `null` とする
- **`question_strength` は本番面接では `easy` / `standard` / `hard` / `custom` のいずれか、チュートリアルでは `null` を送る。** カスタム質問強度の自由文は評価結果に保存しない
- **`turn_count` は `turns` に含まれる `role: "user"` の回答数を送る。** サーバーは回答数と一致する値だけを保存する
- **`turns` は `role` / `content` のみ。** 定量指標は含めない
- **定量はコード、定性は LLM**（[ADR-0009](../ADR/0009-評価方式.md)）。`scores` は**クライアントが算出済みのものを受け取り、DB に保存するだけで LLM には渡さない**
- **定量スコアの計算規則は [評価仕様](../評価仕様.md) が正本。** 指標を計測できる音声回答がない場合は、`speaking_speed` または `filler` を `scores` から省略する。0点として送らない
- **LLM は `turns` だけを見て定性評価（構成・内容）を行う**
- レスポンスは `evaluation_id` のみ。**評価処理は非同期で走る**

### 5.6 `GET /evaluations/{evaluation_id}` — 評価結果の取得

```json
// 処理中
{
  "evaluation_id": 87,
  "status": "processing",
  "company_id": 12,
  "company_name": "株式会社テスト",
  "question_strength": "standard",
  "turn_count": 1
}
```

```json
// 完了
{
  "evaluation_id": 87,
  "company_id": 12,
  "company_name": "株式会社テスト",
  "question_strength": "standard",
  "turn_count": 1,
  "status": "completed",
  "created_at": "2026-08-16T14:32:00Z",
  "total_score": 75,
  "scores": {
    "speaking_speed":    { "score": 92, "value": 284, "unit": "文字/分" },
    "filler":            { "score": 67, "value": 2, "value_per_minute": 4.0, "unit": "回" },
    "structure_content": { "score": 72, "comment": "結論が後半に来る回答が目立つ。具体例は良い" }
  },
  "advice": ["「結論 → 理由 → 具体例」の順で話すと伝わりやすくなります"]
}
```

```json
// 失敗
{
  "evaluation_id": 87,
  "status": "failed",
  "error": "LLM 呼び出しに失敗しました",
  "company_id": 12,
  "company_name": "株式会社テスト",
  "question_strength": "standard",
  "turn_count": 1
}
```

- **状態は `processing` / `completed` / `failed` の3つ。** `completed` になるまでクライアントがポーリングする。**`failed` がないと、LLM が落ちたときフロントが永久にポーリングし続ける**
- **`speaking_speed` / `filler` は `POST /evaluations` で受け取った値をそのまま返す。** `structure_content` と `advice` が LLM の出力
- **`total_score` はバックエンドが算出する。** `structure_content`（60%）/ `filler`（20%）/ `speaking_speed`（20%）のうち存在するスコアを加重平均して四捨五入し、任意の `pause` は含めない。欠測項目は存在する項目の重みだけで正規化する（[評価仕様](../評価仕様.md) 5章）
- **合否の目安は返さない。** クライアントが `total_score` から判定する
- **評価履歴からの詳細表示もこの API を使う**
- **すべての状態で `company_id`、`company_name`、`question_strength`、`turn_count` を返す。** 既存評価結果は追加項目を `null` として返す

### 5.7 `GET /evaluations` — 評価履歴の一覧

```json
// レスポンス
{
  "evaluations": [
    {
      "evaluation_id": 87,
      "created_at": "2026-08-16T14:32:00Z",
      "status": "completed",
      "total_score": 75,
      "company_name": "株式会社テスト",
      "question_strength": "standard",
      "turn_count": 8,
      "scores": {
        "speaking_speed": { "score": 92, "value": 284, "unit": "文字/分" },
        "filler": { "score": 67, "value": 2, "value_per_minute": 4.0, "unit": "回" },
        "structure_content": { "score": 72, "comment": "結論が後半に来る回答が目立つ。具体例は良い" }
      }
    }
  ]
}
```

- **企業では絞り込まず、全件を返す。** **企業IDを持たないチュートリアルの結果も同じ一覧に含まれる**
- 一覧に `evaluation_id` を含めることで、一覧 → 詳細（5.6）の導線がつながる
- 一覧は `company_name`、`question_strength`、`turn_count`、項目別 `scores` を返す。既存評価結果の追加項目は `null` とする

### 5.8 評価する指標

[ADR-0009](../ADR/0009-評価方式.md) で評価項目と責務を、[評価仕様](../評価仕様.md) で計算規則を確定している。

| 指標 | 算出 | scores のキー |
|---|---|---|
| 話の速さ | 文字数 ÷ 発話時間（**クライアントが点数化**） | `speaking_speed` |
| フィラーの数 | `POST /interviews/stt` の `filler_count`（**クライアントが点数化**） | `filler` |
| 構成・内容 | **LLM が評価する定性項目** | `structure_content` |
| 間の長さ | **任意。** 実装する場合は VAD の区間記録から算出する | 未確定 |

**「抑揚」「声の大きさ」は採らない**（[ADR-0009](../ADR/0009-評価方式.md)）。話速・フィラーの対象回答、基準点、線形補間、丸め、欠測時処理、総合スコアは [評価仕様](../評価仕様.md) に従う。

## 6. データモデル

**保存するのは応募情報と評価結果だけで、会話履歴・音声・文字起こしは保存しない**（[ADR-0007](../ADR/0007-会話音声の取得と保存方式.md)）。

| テーブル | カラム | 備考 |
|---|---|---|
| `users` | `id` (PK) / `username` / `password_hash` | 固定アカウント1つ |
| `companies`（応募情報） | `id` (PK) / `company_name` / `company_url` / `motivation` / `resume` / `note` / `job_summary` / `created_at` | 企業情報 + 志望動機 + 経歴を1レコードで持つ。`company_name` は一意 |
| `evaluations`（評価結果） | `evaluation_id` (PK) / `company_id` (FK + INDEX) / `company_name` / `question_strength` / `turn_count` / `status` / `total_score` / `scores` (JSON) / `advice` (JSON) / `created_at` | `question_strength` はチュートリアル・既存評価結果で NULL。`turn_count` は実施した回答数で、既存評価結果は NULL。`status` は `processing` / `completed` / `failed` |

- **`evaluations` の PK は `evaluation_id` 単体。** `GET /evaluations/{evaluation_id}` で引く以上、これ単体で一意に特定できる必要がある
- **`evaluations.company_id` は NULL を許す**（チュートリアルの評価は応募情報を持たないため）
- **`session_id` は持たない。** 1セッション = 1評価であり `evaluation_id` と 1:1 になる
- **`user_id` は持たない。** ユーザーを1つしか用意しないため
- `companies.created_at` は API のレスポンス専用メタデータとして保存する。S-06 / S-07 には表示しない
- `companies.updated_at` は持たない。画面が応募情報の更新日時を使わないためである（[画面と API の対応](../frontend/01_design/screen_api_map.md) 6章）

## 7. 未確定事項

**API の入出力に影響するものに限って列挙する。** 本書では決めない。

| # | 未確定事項 | 決めるべき場所 |
|---:|---|---|
| 1 | **パス名と ID の命名。** `/interviews/*` に揃えるか、`company_id` を `application_id` に改める（既存 API は `/token` `/users/me` とプレフィックスなし） | 各 API の実装時 |
| 2 | **「間の長さ」を評価に加える場合の `scores` のキー**と、項目別スコア表示との対応 | 実装時 |
| 3 | **フィラーの定義範囲。** `keepFillerToken=1` が期待どおり効くか、「なんか」「まあ」等を含めるか | [#36](https://github.com/study-basic-hackathon/hanasu/issues/36) |
| 4 | **非同期処理の実装方式**（`BackgroundTasks` / ワーカー分離）とポーリング間隔 | 評価 API の実装時 |
| 5 | **TTS のサービス選定**（Amazon Polly / 外部 API など） | TTS を作ると決めた時点 |
| 6 | **画面のために加えることが決まった項目**（評価結果の企業名・質問の強度・ターン数、評価履歴一覧の企業と項目別スコア）。**新しいエンドポイントは増えない** | [画面と API の対応](../frontend/01_design/screen_api_map.md) 6章に一覧がある。**本書への反映は各 API の実装時** |

## 8. 参考

- [必要api.md](../必要api.md) — **必要な API のメモ。** 正本は本書
- [ADR-0007 会話音声の取得と保存方式](../ADR/0007-会話音声の取得と保存方式.md) — 音声はブラウザで取得し永続化しない
- [ADR-0008 会話用APIの構成](../ADR/0008-会話用APIの構成.md) — API の分割とステートレス、非同期評価
- [ADR-0009 評価方式](../ADR/0009-評価方式.md) — 評価指標と、定量 / 定性の分担
- [ADR-0020 定量スコアの点数化基準](../ADR/0020-定量スコアの点数化基準.md) — 点数化と総合スコアの決定理由
- [ADR-0023 総合スコアの加重平均](../ADR/0023-総合スコアの加重平均.md) — 総合スコアの合成比率を等価平均から加重平均へ置き換えた決定
- [評価仕様](../評価仕様.md) — 定量スコアと総合スコアの計算規則
- [ADR-0010 音声認識とLLMの基盤選定](../ADR/0010-音声認識とLLMの基盤選定.md) — STT は AmiVoice、LLM は Bedrock
- [ADR-0011 会員登録と利用アカウント](../ADR/0011-会員登録と利用アカウント.md) — 会員登録を作らず固定の ID / パスワード1組を使う
- [画面と API の対応](../frontend/01_design/screen_api_map.md) — どの画面がどの API を呼ぶか
- [Issue #17](https://github.com/study-basic-hackathon/hanasu/issues/17) — 応募企業情報の項目定義
- [検討記録: 応募企業情報の項目定義](../00_検討/20260823_応募企業情報項目定義.md) — 現行の画面・API・実装の照合と決定経緯
- [検討記録: 会話セッションのAPI構成](../00_検討/20260816_会話セッションAPI構成.md) — API 構成に至る経緯と案の比較
