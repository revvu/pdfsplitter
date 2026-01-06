import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
