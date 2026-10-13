"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { ensureFbcCookie, syncConsentCookie, trackPageView } from "@/lib/marketing-client";

export default function MarketingPageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = searchParams?.toString();
    const url = `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;
    syncConsentCookie();
    ensureFbcCookie();
    trackPageView(url);
  }, [pathname, searchParams]);

  return null;
}
