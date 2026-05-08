import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Inventory Tracker",
  description: "Track trading card inventory, sales, fees, and profit/loss.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
