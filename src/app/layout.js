import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Matchmake - Scrim Board",
  description: "Find and post esports scrim listings.",
};

export default function RootLayout({ children }) {
  const themeScript = `
    (function() {
      try {
        var storedTheme = window.localStorage.getItem("matchmake-theme-v2");
        var theme = storedTheme === "dark" || storedTheme === "light"
          ? storedTheme
          : "light";
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.classList.toggle("light", theme !== "dark");
        document.documentElement.style.colorScheme = theme;
      } catch (error) {}
    })();
  `;

  return (
    <html className="light" lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} min-h-screen bg-background pb-24 text-on-background antialiased md:pb-0`}>
        {children}
      </body>
    </html>
  );
}
