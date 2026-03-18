import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const gothamBook = localFont({
  src: "../fonts/GothamBook.otf",
  variable: "--font-gotham",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Simulador de Parcelas — Decorafit",
  description:
    "Simule rapidamente o valor das parcelas da reforma de apartamento.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${montserrat.variable} ${gothamBook.variable} antialiased`}>{children}</body>
    </html>
  );
}
