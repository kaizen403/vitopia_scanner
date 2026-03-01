import type { Metadata } from "next";
import { Outfit, Anton } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "PRAANA '26 | Scanner",
  description: "PIMS International Cultural and Sports Fest 2026 - Entry Scanner",
  icons: {
    icon: "https://praana.pims.ac.in/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} ${anton.variable} antialiased bg-black text-white`}
      >
        {children}
      </body>
    </html>
  );
}
