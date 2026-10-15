import { ExternalLink, Handshake } from "lucide-react";

import { PROP_FIRM } from "@/config/links";

// The one place that says where to get a prop firm account. ArticleOffers puts
// it at the end of every article. Styled by the ca-* rules in content.css.
export default function PropFirmCallout() {
  return (
    <aside className="ca-callout is-info">
      <Handshake size={18} aria-hidden="true" />
      <div>
        <strong>Need a prop firm account?</strong>
        <p>
          {PROP_FIRM.name}, our partner firm, takes {PROP_FIRM.discount} off a new account with the code{" "}
          <code>{PROP_FIRM.code}</code>.
        </p>
        <p className="ca-links">
          <a href={PROP_FIRM.checkoutUrl} target="_blank" rel="sponsored noopener noreferrer">
            Buy the {PROP_FIRM.challenge}, listed at {PROP_FIRM.price}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <a href={PROP_FIRM.url} target="_blank" rel="sponsored noopener noreferrer">
            Visit {PROP_FIRM.name}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </p>
        <small>
          Partner offer. {PROP_FIRM.name} sets its own prices and terms and can change them, so check its
          checkout for what you pay and when. Every prop firm sets its own rules on EAs, so read them before you
          attach a robot to one of its accounts.
        </small>
      </div>
    </aside>
  );
}
