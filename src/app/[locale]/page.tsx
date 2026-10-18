import HomeClient from "./HomeClient";
import PricingSection from "@/components/marketing/pricing/PricingSection";

// The page itself is a server component so the pricing section can read the
// live robots and prices; everything interactive lives in HomeClient.
export default function Home() {
  return <HomeClient pricing={<PricingSection />} />;
}
