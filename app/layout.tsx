import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Oswald } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { PreferenciasProvider } from "@/lib/preferencias/context";
import { ToastProvider } from "@/lib/toast-context";

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
              var raw = localStorage.getItem("sigedual_preferences");
              var p = raw ? JSON.parse(raw) : {};
              var tema = p.tema || "sistema";
              var oscuro = tema === "sistema"
                ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
                : tema === "oscuro";
              var html = document.documentElement;
              html.setAttribute("data-theme", oscuro ? "dark" : "light");
              html.setAttribute("data-density", p.densidad === "compacta" ? "compacta" : "comoda");
              html.setAttribute("data-contrast", p.altoContraste ? "alto" : "normal");
              html.setAttribute("data-width", p.anchoContenido === "completo" ? "completo" : "fijo");
              var escalas = { pequeno: "87.5%", mediano: "100%", grande: "112.5%", "muy-grande": "125%" };
              html.style.fontSize = escalas[p.tamanoFuente] || "100%";
              var acentos = { amarillo: ["#FFD100","#E6BC00"], teal: ["#14B8A6","#12A292"], morado: ["#AB8ED6","#967DBC"], "rojo-coral": ["#E7786E","#CB6A61"], "azul-suave": ["#6CB2D6","#5F9DBC"] };
              var ac = acentos[p.colorAcento] || acentos.amarillo;
              html.style.setProperty("--accent", ac[0]);
              html.style.setProperty("--accent-light", ac[0]);
              html.style.setProperty("--accent-hover", ac[1]);
              if (p.idioma === "en") html.setAttribute("lang", "en");
            } catch (e) {}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <PreferenciasProvider>
            <ToastProvider>{children}</ToastProvider>
          </PreferenciasProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
