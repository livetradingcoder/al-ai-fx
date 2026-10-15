import type { MetadataRoute } from "next";

// Web app manifest: name, colours and icon for home-screen installs and for
// search engines that read it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GoldBot by AL-ai-FX",
    short_name: "GoldBot",
    description:
      "Automated gold (XAUUSD) trading robots for MetaTrader 5, delivered as account-locked builds.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0e11",
    theme_color: "#0b0e11",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed with the robot inside the safe zone, so a phone can crop it to a circle.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
