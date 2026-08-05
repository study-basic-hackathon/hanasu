ステータス：着手中
優先度：高
  
## 概要
動作確認用のサンプル作成

以下ができたら完了。
- docker上で動くNextJsのサンプルを作成する。
- その後、dev containerを構築し、開発もコンテナ上で行えるまで環境を整備する。

## 決定事項


## タスク

### フェーズ1: Docker 上で動く Next.js サンプル

- [ ] 事前決定: Node バージョン(Vercel のサポートに合わせる)/ パッケージマネージャ(npm / pnpm)/ create-next-app のオプション(App Router・TypeScript・ESLint 等)を決め「決定事項」に記録する
- [ ] `frontend/` に create-next-app で Next.js プロジェクトを作成する
- [ ] `.nvmrc`(または `package.json` の `engines`)で Node バージョンを固定する(ADR-0001 フォローアップ)
- [ ] 開発用 Dockerfile を作成する(`next dev` を実行する開発用途のもの)
- [ ] `compose.yaml` を作成する(ポート 3000 公開、ソースの bind mount、`node_modules` はコンテナ側に分離)
- [ ] `docker compose up` でサンプルページが表示されることを確認する
- [ ] ホットリロードが効くことを確認する(効かない場合は `WATCHPACK_POLLING=true` 等で対応)

### フェーズ2: Dev Container 化

- [ ] `.devcontainer/devcontainer.json` を作成する(フェーズ1の compose / サービスを再利用する構成)
- [ ] コンテナ内の開発ツールを整備する(VSCode 拡張: ESLint・Prettier 等、git が使えること)
- [ ] VSCode「Reopen in Container」でコンテナに入り、編集 → ホットリロード反映までの開発フローを確認する
- [ ] (任意)コンテナ内に Claude Code 等の AI ツールを導入し、履歴・認証をホストと連動させる

### 仕上げ

- [ ] 起動・開発コマンドを CLAUDE.md / README に追記する
- [ ] 本メモの「決定事項」「作業ログ」を更新し、ステータスを完了にする

## 参考

- [ADR-0001: フロントエンドのデプロイ先を Vercel とする](../ADR/0001-フロントエンド実行環境.md) — ローカル開発は Docker 上で `next dev`、Node バージョンを Vercel と統一する方針
- [検討記録: フロントエンド実行環境](../00_検討/20260804_フロントエンド実行環境.md)

---
# 作業ログ

