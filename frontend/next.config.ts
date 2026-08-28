import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Playwright は Compose 内の `web` hostname から開発サーバーへ接続する。
  allowedDevOrigins: ["web"],
};

export default nextConfig;
