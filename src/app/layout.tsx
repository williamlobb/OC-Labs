import type { Metadata } from "next";
import "./globals.css";
import { inter, spaceGrotesk } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "OC Labs",
  description: "Internal project discovery and collaboration board for the Omnia Collective Skunkworks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
