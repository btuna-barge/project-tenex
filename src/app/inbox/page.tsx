"use client";

import dynamic from "next/dynamic";

const InboxContent = dynamic(
  () => import("@/components/inbox/inbox-content"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    ),
  }
);

export default function InboxPage() {
  return <InboxContent />;
}
