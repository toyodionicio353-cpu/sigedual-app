import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Oswald } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-label",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SIGEDUAL",
  description: "Sistema Integral de Gestión Dual",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`h-full ${inter.variable} ${spaceGrotesk.variable} ${oswald.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              var t = localStorage.getItem("sigedual-theme");
              if (t === "light" || t === "dark") {
                document.documentElement.setAttribute("data-theme", t);
              }
            } catch (e) {}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
