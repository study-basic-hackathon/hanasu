import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "hanasu",
  description: "AI 面接官と話して、話し方を測る",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${notoSansJP.variable} h-full antialiased`}
    >
      {/*
        PC のみ・基準幅 1440px / 最小幅 1280px（共通仕様 3章）。
        1280px を下回る幅は横スクロールを許容し、レイアウトは組み替えない
      */}
      <body className="flex min-h-full min-w-[1280px] flex-col bg-canvas text-body text-ink">
        {children}
      </body>
    </html>
  );
}
