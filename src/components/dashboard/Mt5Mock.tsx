type Focus = "navigator" | "run";

// open/high/low/close as a percentage of the chart's height — enough of a
// gold session to read as a real M5 chart rather than a bar chart.
const CANDLES: { o: number; h: number; l: number; c: number }[] = [
  { o: 30, h: 44, l: 26, c: 41 },
  { o: 41, h: 46, l: 30, c: 33 },
  { o: 33, h: 38, l: 24, c: 27 },
  { o: 27, h: 52, l: 25, c: 49 },
  { o: 49, h: 58, l: 45, c: 56 },
  { o: 56, h: 61, l: 42, c: 45 },
  { o: 45, h: 68, l: 43, c: 65 },
  { o: 65, h: 74, l: 60, c: 71 },
  { o: 71, h: 76, l: 55, c: 58 },
  { o: 58, h: 63, l: 48, c: 52 },
  { o: 52, h: 84, l: 50, c: 80 },
  { o: 80, h: 92, l: 76, c: 89 },
];

/**
 * A drawn MetaTrader 5 window. It exists so a customer can match what they see
 * on screen to what the instructions are talking about: the Navigator tree,
 * the Algo Trading button, the expert badge in the chart's top-right corner,
 * and the Journal tab where "loaded successfully" shows up.
 *
 * `focus` rings the parts that matter for the current step and dims the rest —
 * install points at the Navigator, run points at the button, badge and Journal.
 */
export default function Mt5Mock({
  focus,
  eaName = "AL-ai-FX_goldbot…",
}: {
  focus: Focus;
  eaName?: string;
}) {
  const live = focus === "run";

  return (
    <figure className="mt5-mock" data-focus={focus}>
      <div className="mt5-titlebar">
        <span className="mt5-dot" />
        <span className="mt5-dot" />
        <span className="mt5-dot" />
        <span className="mt5-mock-title">
          900909621120 — Contest Account — Hedge — [XAUUSD,M5]
        </span>
      </div>

      <div className="mt5-toolbar">
        <span className="mt5-algo" data-on={live ? "true" : "false"}>
          <span className="mt5-algo-icon" aria-hidden="true">
            ▶
          </span>
          Algo Trading
        </span>
        <span className="mt5-tf-group" aria-hidden="true">
          <span className="mt5-tf">M1</span>
          <span className="mt5-tf is-active">M5</span>
          <span className="mt5-tf">M15</span>
          <span className="mt5-tf">H1</span>
        </span>
      </div>

      <div className="mt5-mock-body">
        <div className="mt5-nav">
          <p className="mt5-nav-label">Navigator</p>
          <p className="mt5-nav-group">▾ Expert Advisors / Experten</p>
          <p className="mt5-nav-group is-sub">▾ alaifx</p>
          <p className="mt5-nav-item is-ea is-sub">{eaName}</p>
          <p className="mt5-nav-item">Advisors</p>
          <p className="mt5-nav-item">Examples</p>
        </div>

        <div className="mt5-chart">
          <span className="mt5-ea-badge" data-on={live ? "true" : "false"}>
            {eaName}
            <span className="mt5-face" aria-hidden="true">
              {live ? "☺" : "☹"}
            </span>
          </span>
          <span className="mt5-chart-tag" aria-hidden="true">
            XAUUSD, M5
          </span>
          <span className="mt5-candles" aria-hidden="true">
            {CANDLES.map((k, i) => {
              const up = k.c >= k.o;
              const bodyBottom = Math.min(k.o, k.c);
              return (
                <span key={i} className={`candle ${up ? "up" : "down"}`}>
                  <span
                    className="candle-wick"
                    style={{ bottom: `${k.l}%`, height: `${k.h - k.l}%` }}
                  />
                  <span
                    className="candle-body"
                    style={{
                      bottom: `${bodyBottom}%`,
                      height: `${Math.max(Math.abs(k.c - k.o), 1.5)}%`,
                    }}
                  />
                </span>
              );
            })}
          </span>
        </div>
      </div>

      <div className="mt5-terminal">
        <div className="mt5-tabs" aria-hidden="true">
          <span>Trade</span>
          <span>History</span>
          <span>News</span>
          <span>Alerts</span>
          <span>Experts</span>
          <span className="is-active">Journal</span>
        </div>
        <div className="mt5-journal">
          {live ? (
            <>
              <p className="mt5-log is-good">
                <span>18:56:14</span> expert {eaName} (XAUUSD,M5) loaded successfully
              </p>
              <p className="mt5-log is-good">
                <span>18:59:48</span> automated trading is enabled
              </p>
              <p className="mt5-log">
                <span>18:59:48</span> buy stop 0.1 XAUUSD at 4116.31 sl: 4095.31 tp: 4119.85
              </p>
            </>
          ) : (
            <>
              <p className="mt5-log">
                <span>18:51:34</span> terminal synchronized, trading has been enabled
              </p>
              <p className="mt5-log is-muted">
                <span>18:51:42</span> waiting for an expert to be attached to a chart…
              </p>
            </>
          )}
        </div>
      </div>

      <figcaption className="mt5-legend">
        {live
          ? "Live: the button is pressed, the badge in the top-right shows a smiling face, and the Journal says loaded successfully."
          : "After you paste the file and refresh, your robot appears in the Navigator under Expert Advisors."}
      </figcaption>
    </figure>
  );
}
