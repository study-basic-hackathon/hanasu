# API 仕様

**本サービスが提供する API の一覧と、その入出力を定める。** 実装は `backend/`（Python / FastAPI）が担う。

## 1. 共通事項

- **全 API に `Authorization: Bearer <access_token>` を付ける。** ただし**認証 API（`POST /token`）だけは未認証で実行できる**
- **サーバーは会話状態を持たない**（[ADR-0008](../ADR/0008-会話用APIの構成.md)）。会話履歴と質問強度はクライアントが保持し、毎リクエストに含めて送る
- **音声・会話履歴・文字起こしは永続化しない**（[ADR-0007](../ADR/0007-会話音声の取得と保存方式.md)）。サーバーは処理後に破棄する
- **会員登録 API は作らない。** 固定の ID / パスワード1組を使う（[ADR-0011](../ADR/0011-会員登録と利用アカウント.md)）
- **サインアウト API は作らない。** トークンの破棄はクライアント側で行う
- **ユーザーは1つだけのため、取得系をユーザーで絞り込まない**（[ADR-0011](../ADR/0011-会員登録と利用アカウント.md)）
- 本書のパス名・フィールド名の表記は実装時に確定する（→ [6. 未確定事項](#6-未確定事項)）

## 2. API 一覧

| # | エンドポイント | 役割 | 実装範囲 |
|---:|---|---|---|
| 1 | `POST /token` | 認証（ID / パスワード → JWT アクセストークン） | 作る |
| 2 | `GET /users/me` | 認証中のユーザーを返す | 作る |
| 3 | 応募情報 CRUD（Create / Read / List / Update / Delete） | 応募情報の登録・参照・更新・削除 | 作る |
| 4 | `POST /interviews/start` | 最初の質問を生成する | **任意。** 作らない場合はフロントが固定文字列を持つ |
| 5 | `POST /interviews/stt` | 文字起こし + フィラー数 + 話速 | 作る |
| 6 | `POST /interviews/chat` | 次の質問を生成する | 作る |
| 7 | `POST /interviews/tts` | 面接官の発言を音声化する | **任意。** 作らない場合は画面に文字表示するだけでよい |
| 8 | `POST /evaluations` | 評価を実行する（非同期） | 作る |
| 9 | `GET /evaluations/{evaluation_id}` | 評価結果を取得する | 作る |
| 10 | `GET /evaluations` | 評価履歴を一覧する | 作る |

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

| 操作 | インプット | アウトプット |
|---|---|---|
| **Create** | 応募情報（企業名・企業情報・志望動機・経歴） | 登録結果（企業ID） |
| **Read** | 企業ID | 応募情報 |
| **List** | なし | 登録済みの応募情報の一覧（**企業ID付き**） |
| **Update** | 企業ID / 更新する応募情報 | 更新結果 |
| **Delete** | 企業ID | 削除結果 |

- **List は必須。** 単体取得（Read）だけでは企業IDを知る手段がなく、モード選択の企業リストと応募企業情報の一覧画面がこの API に依存する
- **絞り込みは行わず全件を返す**（ユーザーは1つのため）
- 企業名は必須項目とする。**それ以外の項目の定義は未確定**（→ [6. 未確定事項](#6-未確定事項)）

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

```json
// レスポンス
{ "text": "前職ではどのような役割を担っていましたか？" }
```

- サーバーは `company_id` から応募情報を読み、**質問強度を system プロンプトの言い回しに反映する**
- **質問強度は毎ターン送る。** サーバーが状態を持たないため、開始時に一度だけ渡すことができない
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
  "turns": [
    { "role": "assistant", "content": "まず自己紹介をお願いします" },
    { "role": "user",      "content": "%えー% 田中と申します。前職では..." }
  ],
  "scores": {
    "speaking_speed": { "score": 80, "value": 284, "unit": "文字/分" },
    "filler":         { "score": 55, "value": 14,  "unit": "回" }
  }
}
```

```json
// レスポンス
{ "evaluation_id": 87 }
```

- **`company_id` はチュートリアルでは省略する**（評価結果テーブルの企業IDは NULL を許す）
- **`turns` は `role` / `content` のみ。** 定量指標は含めない
- **定量はコード、定性は LLM**（[ADR-0009](../ADR/0009-評価方式.md)）。`scores` は**クライアントが算出済みのものを受け取り、DB に保存するだけで LLM には渡さない**
- **LLM は `turns` だけを見て定性評価（構成・内容）を行う**
- レスポンスは `evaluation_id` のみ。**評価処理は非同期で走る**

### 5.6 `GET /evaluations/{evaluation_id}` — 評価結果の取得

```json
// 処理中
{ "evaluation_id": 87, "status": "processing" }
```

```json
// 完了
{
  "evaluation_id": 87,
  "company_id": 12,
  "status": "completed",
  "created_at": "2026-08-16T14:32:00Z",
  "total_score": 72,
  "scores": {
    "speaking_speed":    { "score": 80, "value": 284, "unit": "文字/分" },
    "filler":            { "score": 55, "value": 14,  "unit": "回" },
    "structure_content": { "score": 72, "comment": "結論が後半に来る回答が目立つ。具体例は良い" }
  },
  "advice": ["「結論 → 理由 → 具体例」の順で話すと伝わりやすくなります"]
}
```

```json
// 失敗
{ "evaluation_id": 87, "status": "failed", "error": "LLM 呼び出しに失敗しました" }
```

- **状態は `processing` / `completed` / `failed` の3つ。** `completed` になるまでクライアントがポーリングする。**`failed` がないと、LLM が落ちたときフロントが永久にポーリングし続ける**
- **`speaking_speed` / `filler` は `POST /evaluations` で受け取った値をそのまま返す。** `structure_content` と `advice` が LLM の出力
- **合否の目安は返さない。** クライアントが `total_score` から判定する
- **評価履歴からの詳細表示もこの API を使う**

### 5.7 `GET /evaluations` — 評価履歴の一覧

```json
// レスポンス
{
  "evaluations": [
    { "evaluation_id": 87, "created_at": "2026-08-16T14:32:00Z", "status": "completed", "total_score": 72 },
    { "evaluation_id": 64, "created_at": "2026-08-14T10:05:00Z", "status": "completed", "total_score": 65 }
  ]
}
```

- **企業では絞り込まず、全件を返す。** **企業IDを持たないチュートリアルの結果も同じ一覧に含まれる**
- 一覧に `evaluation_id` を含めることで、一覧 → 詳細（5.6）の導線がつながる

### 5.8 評価する指標

[ADR-0009](../ADR/0009-評価方式.md) で確定。

| 指標 | 算出 | scores のキー |
|---|---|---|
| 話の速さ | 文字数 ÷ 発話時間（**クライアントが点数化**） | `speaking_speed` |
| フィラーの数 | `POST /interviews/stt` の `filler_count`（**クライアントが点数化**） | `filler` |
| 構成・内容 | **LLM が評価する定性項目** | `structure_content` |
| 間の長さ | **任意。** 実装する場合は VAD の区間記録から算出する | 未確定 |

**「抑揚」「声の大きさ」は採らない**（[ADR-0009](../ADR/0009-評価方式.md)）。

## 6. データモデル

**保存するのは応募情報と評価結果だけで、会話履歴・音声・文字起こしは保存しない**（[ADR-0007](../ADR/0007-会話音声の取得と保存方式.md)）。

| テーブル | カラム | 備考 |
|---|---|---|
| `users` | `id` (PK) / `username` / `password_hash` | 固定アカウント1つ |
| `applications`（応募情報） | `id` (PK) / `company_name` / `company_info` / `motivation` / `resume` | 企業情報 + 志望動機 + 経歴を1レコードで持つ |
| `evaluations`（評価結果） | `evaluation_id` (PK) / `company_id` (FK + INDEX) / `status` / `total_score` / `scores` (JSON) / `advice` (JSON) / `created_at` | `status` は `processing` / `completed` / `failed` |

- **`evaluations` の PK は `evaluation_id` 単体。** `GET /evaluations/{evaluation_id}` で引く以上、これ単体で一意に特定できる必要がある
- **`evaluations.company_id` は NULL を許す**（チュートリアルの評価は応募情報を持たないため）
- **`session_id` は持たない。** 1セッション = 1評価であり `evaluation_id` と 1:1 になる
- **`user_id` は持たない。** ユーザーを1つしか用意しないため
- **作成日時・更新日時は必須としない。** 画面が使う日時は `evaluations.created_at`（練習の実施日時）だけである。**`users` / `applications` に持たせるかどうかは実装に委ねる**（[画面と API の対応](../frontend/01_design/screen_api_map.md) 6章）

## 7. 未確定事項

**API の入出力に影響するものに限って列挙する。** 本書では決めない。

| # | 未確定事項 | 決めるべき場所 |
|---:|---|---|
| 1 | **パス名と ID の命名。** `/interviews/*` に揃えるか、`company_id` を `application_id` に改める（既存 API は `/token` `/users/me` とプレフィックスなし） | 各 API の実装時 |
| 2 | **応募情報の項目定義**（企業名以外の入力項目と、CRUD の入出力の中身） | [#17](https://github.com/study-basic-hackathon/hanasu/issues/17) |
| 3 | **質問強度のフィールド名と値の表記**（楽々 / 標準 / 厳しめ をどう表すか） | 会話 API の実装時 |
| 4 | **定量スコアの点数化基準**（「284文字/分は何点か」）。**クライアント側に置かれる** | [ADR-0009](../ADR/0009-評価方式.md) のフォローアップ（実装時） |
| 5 | **「間の長さ」を評価に加える場合の `scores` のキー**と、項目別スコア表示との対応 | 実装時 |
| 6 | **フィラーの定義範囲。** `keepFillerToken=1` が期待どおり効くか、「なんか」「まあ」等を含めるか | [#36](https://github.com/study-basic-hackathon/hanasu/issues/36) |
| 7 | **非同期処理の実装方式**（`BackgroundTasks` / ワーカー分離）とポーリング間隔 | 評価 API の実装時 |
| 8 | **TTS のサービス選定**（Amazon Polly / 外部 API など） | TTS を作ると決めた時点 |
| 9 | **画面のために加えることが決まった項目**（評価結果の企業名・質問の強度・ターン数、評価履歴一覧の企業と項目別スコア）。**新しいエンドポイントは増えない** | [画面と API の対応](../frontend/01_design/screen_api_map.md) 6章に一覧がある。**本書への反映は各 API の実装時** |

## 8. 参考

- [必要api.md](../必要api.md) — **必要な API のメモ。** 正本は本書
- [ADR-0007 会話音声の取得と保存方式](../ADR/0007-会話音声の取得と保存方式.md) — 音声はブラウザで取得し永続化しない
- [ADR-0008 会話用APIの構成](../ADR/0008-会話用APIの構成.md) — API の分割とステートレス、非同期評価
- [ADR-0009 評価方式](../ADR/0009-評価方式.md) — 評価指標と、定量 / 定性の分担
- [ADR-0010 音声認識とLLMの基盤選定](../ADR/0010-音声認識とLLMの基盤選定.md) — STT は AmiVoice、LLM は Bedrock
- [ADR-0011 会員登録と利用アカウント](../ADR/0011-会員登録と利用アカウント.md) — 会員登録を作らず固定の ID / パスワード1組を使う
- [画面と API の対応](../frontend/01_design/screen_api_map.md) — どの画面がどの API を呼ぶか
- [検討記録: 会話セッションのAPI構成](../00_検討/20260816_会話セッションAPI構成.md) — API 構成に至る経緯と案の比較
