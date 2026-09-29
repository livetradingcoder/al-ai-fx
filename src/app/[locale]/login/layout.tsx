import { noIndexMetadata } from "@/lib/seo";

// Auth screens stay out of search results; the page is a client component,
// so its metadata lives here.
export const metadata = noIndexMetadata("Sign in | GoldBot by AL-ai-FX");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
