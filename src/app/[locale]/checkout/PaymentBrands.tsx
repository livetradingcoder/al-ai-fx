/**
 * The marks on the pay buttons: Visa and Mastercard on the card buttons, the
 * big three coins on the crypto one. Decorative — each button already says what
 * it does in words — so they are hidden from assistive tech.
 *
 * Glyph paths for Visa, Bitcoin, Ethereum and Tether come from Simple Icons
 * (CC0); the Mastercard circles are drawn here. The marks belong to their
 * owners and are shown only to say which payment methods are accepted.
 */

const VISA_PATH =
  "M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z";

const BITCOIN_PATH =
  "M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z";

const ETHEREUM_PATH =
  "M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z";

const TETHER_PATH =
  "M18.7538 10.5176c0 .6251-2.2379 1.1483-5.2381 1.2812l.0028.0007c-.0848.0064-.5233.0325-1.5012.0325-.7778 0-1.33-.0233-1.5237-.0325-3.0059-.1322-5.2495-.6555-5.2495-1.2819s2.2436-1.149 5.2495-1.2834v2.0442c.1965.0142.7594.0474 1.5372.0474.9334 0 1.4008-.0389 1.4849-.0466V9.2356c2.9994.1337 5.2381.657 5.2381 1.282zm5.19.5466L12.1248 22.389a.1803.1803 0 0 1-.2496 0L.0562 11.0635a.1781.1781 0 0 1-.0382-.2079l4.3762-9.1921a.1767.1767 0 0 1 .1626-.1026h14.8878a.1768.1768 0 0 1 .1612.1032l4.3762 9.1922a.1782.1782 0 0 1-.0382.2079zm-4.478-.4038c0-.8068-2.5515-1.4799-5.9473-1.6369V7.195h4.186V4.4055H6.3076V7.195h4.1852v1.8286c-3.4018.1562-5.9601.83-5.9601 1.6376 0 .8075 2.5583 1.4806 5.9601 1.6376v5.8618h3.025v-5.8639c3.394-.1563 5.948-.8295 5.948-1.6363z";

function Visa() {
  return (
    <span className="co-brand">
      <svg viewBox="0 7 24 10" width="26" height="11" focusable="false">
        <path fill="#1A1F71" d={VISA_PATH} />
      </svg>
    </span>
  );
}

function Mastercard() {
  return (
    <span className="co-brand">
      <svg viewBox="1 4 22 16" width="23" height="17" focusable="false">
        <circle cx="9" cy="12" r="7" fill="#EB001B" />
        <circle cx="15" cy="12" r="7" fill="#F79E1B" />
        {/* the overlap: where the two circles cross */}
        <path fill="#FF5F00" d="M12 5.675A7 7 0 0 1 12 18.325A7 7 0 0 1 12 5.675Z" />
      </svg>
    </span>
  );
}

// A coin is a white disc under the glyph, so a mark drawn as a knocked-out
// shape (the Bitcoin B, the Tether T) reads white whatever the button is.
function Coin({ children }: { children: React.ReactNode }) {
  return (
    <span className="co-brand is-coin">
      <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
        <circle cx="12" cy="12" r="12" fill="#fff" />
        {children}
      </svg>
    </span>
  );
}

export function CardBrands() {
  return (
    <span className="co-brands" aria-hidden="true">
      <Visa />
      <Mastercard />
    </span>
  );
}

export function CryptoBrands() {
  return (
    <span className="co-brands" aria-hidden="true">
      <Coin>
        <path fill="#F7931A" d={BITCOIN_PATH} />
      </Coin>
      <Coin>
        <circle cx="12" cy="12" r="12" fill="#627EEA" />
        <path fill="#fff" transform="translate(6 6) scale(0.5)" d={ETHEREUM_PATH} />
      </Coin>
      <Coin>
        <path fill="#26A17B" d={TETHER_PATH} />
      </Coin>
    </span>
  );
}
