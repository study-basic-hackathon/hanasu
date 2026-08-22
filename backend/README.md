# Backend

## CORS 設定

`CORS_ALLOWED_ORIGINS` に、ブラウザから API へ接続する Origin をカンマ区切りで指定します。Origin はスキーム、ホスト、必要な場合はポートまでを含め、パスや末尾の `/` は含めません。

ローカルと Amplify Hosting の両方を許可する例:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://main.<app-id>.amplifyapp.com
```

Amplify の発行 URL が確定したら、`https://<branch>.<app-id>.amplifyapp.com` を ECS タスク定義の `CORS_ALLOWED_ORIGINS` に追加してください。新しいタスク定義リビジョンをサービスへ反映すると設定が有効になります。

環境変数が未設定、空文字、空要素のみの場合は、ローカル開発用の `http://localhost:3000` だけを許可します。`*` は安全のため指定できません。Authorization ヘッダーを使うリクエストと preflight を許可しつつ、設定した Origin 以外には `Access-Control-Allow-Origin` を返しません。

## CORS テスト

```bash
cd backend
uv run python -m unittest discover -s tests
```
