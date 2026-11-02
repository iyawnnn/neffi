import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/config/site";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Neffi", template: "%s | Neffi" },
  description: "Neffi is an NFC digital business card in the Philippines. Tap to share your contact details, links and profile instantly, with no app required.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
