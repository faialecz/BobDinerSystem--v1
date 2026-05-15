import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../css/global.css"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bob's Diner Inventory and Sales System",
  description: "An Inventory and Sales System for Bob's Diner",
  icons: {
    // Make sure this matches the actual file name in /public
    icon: "/bob-logo.png", 
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}