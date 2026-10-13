"use client";

import { useEffect, useRef } from "react";

import { trackViewContent, type MetaItem } from "@/lib/marketing-client";

/**
 * Reports that a product page was opened. Renders nothing. Once per robot: in
 * development React runs an effect twice on mount, and a second ViewContent
 * with its own event ID would be a second view in Meta, not a duplicate of the first.
 */
export default function TrackViewContent(item: MetaItem) {
  const { amount, currency, robotSlug, robotName, tierSlug } = item;
  const reported = useRef<string | null>(null);

  useEffect(() => {
    if (reported.current === robotSlug) return;
    reported.current = robotSlug ?? null;
    trackViewContent({ amount, currency, robotSlug, robotName, tierSlug });
  }, [amount, currency, robotSlug, robotName, tierSlug]);

  return null;
}
