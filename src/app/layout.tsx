import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Tomás Tello - Music Website",
    template: "%s | Tomás Tello",
  },
  description: "Official music website of Tomás Tello - Listen to live radio, discover music curation, and explore the sonic world of Eccos del Futuro",
  keywords: ["Tomás Tello", "music", "Eccos del Futuro", "radio", "DJ", "music curation", "live radio"],
  authors: [{ name: "Tomás Tello" }],
  creator: "Tomás Tello",
  publisher: "Tomás Tello",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://tomas-tello.stream",
    title: "Tomás Tello - Music Website",
    description: "Official music website of Tomás Tello - Listen to live radio, discover music curation, and explore the sonic world of Eccos del Futuro",
    siteName: "Tomás Tello",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tomás Tello - Music Website",
    description: "Official music website of Tomás Tello - Listen to live radio, discover music curation, and explore the sonic world of Eccos del Futuro",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "",
    yandex: "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${spaceMono.variable}`}>
      <body className={"antialiased min-w-[350px]"}>
        {children}
        <Footer />
      </body>
    </html>
  );
}
