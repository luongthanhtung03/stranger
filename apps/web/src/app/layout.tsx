import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/lib/socket";
import { MediaProvider } from "@/lib/media-context";
import { InviteToast } from "@/components/InviteToast";
import { ThemeProvider } from "@/lib/theme";
import { THEME_COLOR, themeScript } from "@/lib/theme-script";

const bvp = Be_Vietnam_Pro({
  variable: "--font-bvp",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stranger — gặp một người lạ trong trường",
  description: "Video call 5 phút với một sinh viên ngẫu nhiên. Không tài khoản, không lưu gì cả.",
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR.dark,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="dark" suppressHydrationWarning className={`${bvp.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <SocketProvider>
            <MediaProvider>
              {children}
              <InviteToast />
            </MediaProvider>
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
