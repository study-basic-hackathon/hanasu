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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
