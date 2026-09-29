"use client"

import dynamic from "next/dynamic"

// The editor (TipTap + ProseMirror) is heavy; pages load it only when a description is shown

export const DescriptionField = dynamic(
  () => import("./description-field").then((mod) => mod.DescriptionField),
  {
    ssr: false,
    loading: () => <div className="h-[130px] animate-pulse rounded-md border bg-muted/30" />,
  }
)

export const RichTextView = dynamic(
  () => import("./rich-text-editor").then((mod) => mod.RichTextView),
  {
    ssr: false,
    loading: () => <div className="h-12 animate-pulse rounded bg-muted/40" />,
  }
)
