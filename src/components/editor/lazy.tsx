"use client"

import dynamic from "next/dynamic"

// The editor (TipTap + ProseMirror) is heavy; pages load it only when a description is shown

const loadDescriptionField = () => import("./description-field")
const loadRichTextEditor = () => import("./rich-text-editor")

export const DescriptionField = dynamic(
  () => loadDescriptionField().then((mod) => mod.DescriptionField),
  {
    ssr: false,
    loading: () => <div className="h-[130px] animate-pulse rounded-md border bg-muted/30" />,
  }
)

export const RichTextView = dynamic(
  () => loadRichTextEditor().then((mod) => mod.RichTextView),
  {
    ssr: false,
    loading: () => <div className="h-12 animate-pulse rounded bg-muted/40" />,
  }
)

// Loads the editor ahead (same files as when it's shown) - e.g. so notes can be
// opened later without internet
export const preloadEditor = () => Promise.all([loadDescriptionField(), loadRichTextEditor()])
