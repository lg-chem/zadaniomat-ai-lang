import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin", "latin-ext"],
})

export const metadata: Metadata = {
  title: "Zadaniomat AI",
  description: "Inteligentny system zarządzania zadaniami z AI",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
