import type { Metadata } from "next";
import { Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const libreBaskerville = Libre_Baskerville({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PDF Page Extractor",
  description: "Extract specific pages from your PDF files easily",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${libreBaskerville.variable} ${sourceSans.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
