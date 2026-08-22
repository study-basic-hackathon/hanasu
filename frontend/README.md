This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

**ホストに Node を入れる前提はありません。開発はすべてコンテナ内で行います。**

### Docker Compose で起動する

```bash
docker compose up -d --build   # 初回・依存変更時
docker compose up -d           # 2回目以降
docker compose logs -f         # ログを追う
docker compose down            # 停止
```

[http://localhost:3000](http://localhost:3000) を開くとページが表示されます。`src/app/page.tsx` を編集すると、ホットリロード(Turbopack)で自動的に反映されます。

`node_modules` と `.next` は名前付きボリュームに分離しているため、ホスト側には作られません。依存を追加したら `docker compose up -d --build` でイメージを作り直してください。

### API 接続先を設定する

フロントエンドが参照するバックエンド API の接続先は、公開環境変数 `NEXT_PUBLIC_API_BASE_URL` だけで設定します。ローカル開発では `.env.example` を `.env.local` にコピーし、必要に応じて値を変更してください。

```bash
cp .env.example .env.local
```

既定の例は `http://localhost:8000` です。値の前後の空白と末尾の `/` は共通設定で除去されます。未設定または空文字のまま共通設定を参照すると、設定漏れを示すエラーになります。`NEXT_PUBLIC_*` の値はブラウザへ公開されるため、認証情報や秘密情報は設定しないでください。

Amplify へ配備する GitHub Actions では、CloudFront の HTTPS URL を Repository variable `NEXT_PUBLIC_API_BASE_URL` からビルド時に渡します。Amplify の環境変数は使用しません。

### Dev Container で開発する

VSCode でこの `frontend/` を開き、「Reopen in Container」を実行すると、上の `compose.yaml` の `web` サービスにそのまま入ります。ワークスペースは `/app` です。

- 入った時点で `npm run dev` が動いているので、そのまま [http://localhost:3000](http://localhost:3000) を開けます
- dev サーバーが落ちるとコンテナごと停止します(`overrideCommand: false` のため)
- ESLint / Tailwind CSS IntelliSense 拡張がコンテナ側に入ります
- **マウントしているのは `frontend/` だけで `.git` は含まれません。git 操作はホスト側で行ってください**

### lint / build

Next.js 16 では `next build` が Linter を実行しないため、lint は個別に回します。

```bash
docker compose run --rm web npm run lint
docker compose run --rm web npm run build
```

### テスト

UT とコンポーネントテストは Vitest、React Testing Library、jsdom で実行します。変更を監視しながら実行する場合は `npm run test`、CI と同じ一回限りの実行には `npm run test:run` を使います。

```bash
docker compose run --rm web npm run test
docker compose run --rm web npm run test:run
docker compose run --rm web npm run test:coverage
```

`test:coverage` はターミナルに要約を表示し、HTML レポートを `coverage/` に出力します。初回導入ではカバレッジの閾値を設けません。Playwright による E2E テストは別途導入します。

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Amplify Hosting へ配備する

`next.config.ts` の静的出力により、`npm run build` は `out/` を生成します。`.github/workflows/deploy-frontend-to-amplify.yml` は `main` への push と `workflow_dispatch` で起動し、次の処理だけを行います。

1. `frontend/package.json` の `engines.node` から Node.js 24.x を設定する
2. `NEXT_PUBLIC_API_BASE_URL` を渡して依存関係をインストールし、静的成果物をビルドする
3. `out/` の中身をルートとする ZIP を作成する
4. GitHub OIDC で配備専用 AWS IAM ロールを引き受ける
5. Amplify の `CreateDeployment`、署名付き URL への ZIP upload、`StartDeployment` を実行し、`GetJob` で完了まで確認する

Terraform の `plan` / `apply` / `destroy` はこの workflow では実行しません。Amplify App や配備専用ロールなどのインフラは `infra/dev/` を手動で apply して用意します。

Terraform apply 後、Repository Variables に以下を設定してください。取得元の詳細は `infra/dev/README.md` を参照してください。

| Variable | 用途 |
|---|---|
| `AWS_REGION` | Amplify App を作成した AWS リージョン |
| `AWS_ROLE_TO_ASSUME` | GitHub OIDC で引き受ける Amplify 配備専用ロール ARN |
| `AMPLIFY_APP_ID` | 配備先の Amplify App ID |
| `AMPLIFY_BRANCH_NAME` | 配備先 branch。現在は `main` |
| `NEXT_PUBLIC_API_BASE_URL` | API 用 CloudFront の HTTPS URL |

長期 AWS アクセスキーは GitHub Secrets へ保存しません。`workflow_dispatch` を使う場合も、OIDC ロールの信頼条件に合わせて `main` を選択してください。
