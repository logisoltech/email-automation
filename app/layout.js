import "./globals.css";

export const metadata = {
  title: "Logisol Mail",
  description: "Private email automation for Logisol",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
