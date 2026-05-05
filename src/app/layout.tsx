import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Accorsi Auto Peças",
  description: "Peças e acessórios automotivos. Loja em preparação.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} h-full overflow-x-hidden bg-white antialiased`}
    >
      <body className="flex min-h-full min-w-0 flex-col overflow-x-hidden bg-white font-sans">
        {children}
      </body>
    </html>
  );
}
