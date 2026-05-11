import "./globals.css";

export const metadata = {
  title: "Matchmake - Scrim Board",
  description: "Find and post esports scrim listings.",
};

export default function RootLayout({ children }) {
  const themeScript = `
    (function() {
      try {
        var storedTheme = window.localStorage.getItem("matchmake-theme");
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
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background pb-24 font-['Inter'] text-on-background antialiased md:pb-0">
        {children}
      </body>
    </html>
  );
}
