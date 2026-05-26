import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slumpad rotation",
  description: "Webbapp för avdelningsrotation och slumpad zonfördelning."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <div className="mx-auto flex min-h-screen w-full max-w-[96rem] flex-col px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </body>
    </html>
  );
}
