import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cask Carnival | 부스 지도 & 실시간 보틀 현황",
  description: "페스티벌 부스 지도, 시음/판매 보틀 목록 및 실시간 매진·평점 공유",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#0f0d0b] text-[#f5efe6] antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
