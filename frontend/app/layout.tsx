import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Healthcare Intelligence Maps — MIT Hackathon Challenge 03',
  description:
    'Agentic AI system that reads 10,000 Indian hospital records, scores trustworthiness, and maps medical deserts across India.',
  keywords: ['healthcare', 'India', 'AI agent', 'medical deserts', 'MIT hackathon'],
  openGraph: {
    title: 'Building Agentic Healthcare Maps for 1.4 Billion Lives',
    description: 'MIT Challenge 03 — Powered by Databricks & Claude AI',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
