import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/lib/socket";
import { MediaProvider } from "@/lib/media-context";
import { InviteToast } from "@/components/InviteToast";

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
  themeColor: "#0b0b12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${bvp.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SocketProvider>
          <MediaProvider>
            {children}
            <InviteToast />
          </MediaProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
