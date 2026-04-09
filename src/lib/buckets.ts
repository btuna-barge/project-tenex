import type { Bucket } from "@/types";

export const DEFAULT_BUCKETS: Bucket[] = [
  {
    id: "important",
    label: "Important",
    description:
      "Requires your direct attention or action. A real person (colleague, manager, friend) addressing you specifically — asking for a reply, assigning work, or raising something only you can handle.",
    color: "#ef4444",
  },
  {
    id: "can-wait",
    label: "Can Wait",
    description:
      "Useful but not urgent. FYI threads, low-priority updates, informational messages that don't need an immediate response.",
    color: "#f59e0b",
  },
  {
    id: "newsletter",
    label: "Newsletter",
    description:
      "Subscribed content and digests. Blog updates, Substack, Medium, industry newsletters, curated content you signed up for.",
    color: "#8b5cf6",
  },
  {
    id: "promotions",
    label: "Promotions",
    description:
      "Marketing emails, sales, deals, coupons, product announcements from brands and services.",
    color: "#06b6d4",
  },
  {
    id: "auto-archive",
    label: "Auto-archive",
    description:
      "Noise that needs no attention. Automated notifications, shipping updates, receipts, password resets, CI/CD alerts, calendar auto-responses.",
    color: "#6b7280",
  },
  {
    id: "spam",
    label: "Spam",
    description:
      "Unsolicited junk. Cold outreach, phishing attempts, scam offers, unwanted bulk email from senders you never subscribed to.",
    color: "#dc2626",
  },
];
