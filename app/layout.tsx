import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synth Studio | Digital Twin Learning System",
  description: "Play, patch and learn classic hardware synths as digital twins, then wire them into a studio and make full tracks.",
  applicationName: "Synth Studio",
  // Added to the iPad home screen it opens without browser bars, like an app
  appleWebApp: { capable: true, title: "Synth Studio", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
