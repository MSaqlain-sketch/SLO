import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./home-page.css";
import "./info-pages.css";
import { SelectionProvider } from "../lib/selection-context";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Babul Learn | AKU-EB Study Companion",
  description:
    "AKU-EB study material, textbook-verified answers, chapter notes and past paper practice.",
  verification: {
    google: "0we_a-R_o7Qn8uyZoUnQmZUJj7Ds3iyDr-dzG0eQoBM",
  },
  icons: {
    icon: "/babul-learn-logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SelectionProvider>{children}</SelectionProvider>
      </body>
    </html>
  );
}
