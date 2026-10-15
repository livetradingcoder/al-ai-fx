import { ExternalLink, Server } from "lucide-react";

import { VPS_REFERRAL_URL } from "@/config/links";

// The one place that says where to get a VPS. Any article that tells people to
// run the EA on a VPS ends that section with a { type: "vps" } block, which
// renders this. Styled by the ca-* rules in content.css.
export default function VpsCallout() {
  return (
    <aside className="ca-callout is-info">
      <Server size={18} aria-hidden="true" />
      <div>
        <strong>Need a VPS?</strong>
        <p>
          A VPS keeps MetaTrader running 24/5, so the EA is never left unattended. Get one here:{" "}
          <a href={VPS_REFERRAL_URL} target="_blank" rel="sponsored noopener noreferrer">
            PowerVPS
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </p>
        <small>This is a referral link: we may earn a commission if you sign up.</small>
      </div>
    </aside>
  );
}
