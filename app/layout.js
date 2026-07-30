import { Poppins } from "next/font/google";
import "./globals.css";
import { Notifications } from "@/components/ui/notifications";
import { ThemeScript } from "@/components/theme/theme-script";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata = {
  title: "OutreachOS",
  description: "AI-powered outreach email platform for your team",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full antialiased">
        {children}
        <Notifications />
      </body>
    </html>
  );
}
