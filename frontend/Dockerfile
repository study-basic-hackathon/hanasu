# 開発専用イメージ。本番はGitHub Actionsでビルドし、Amplify Hostingへ配備する（ADR-0017）
# ベースイメージの選定根拠は documents/ADR/0006-開発用Dockerベースイメージ.md
FROM node:24-bookworm-slim

WORKDIR /app

# 依存だけ先に入れることで、ソース変更時に npm ci をやり直さずに済む
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# コンテナ外（ホスト）からアクセスできるよう全インターフェースで待ち受ける
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
