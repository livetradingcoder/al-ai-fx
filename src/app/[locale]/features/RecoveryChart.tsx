"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import type {
  CandlestickData,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

// ---------------------------------------------------------------------------
// Illustrative data only. A seeded random walk shaped into the story the
// Adaptive Recovery panel tells: a quiet session range, a breakout, a false
// break back through the range, and the hedge taking the move. It is NOT
// market data and NOT a GoldBot trading result — the chart says so on screen.
// ---------------------------------------------------------------------------
const START = Date.UTC(2026, 8, 15, 6, 0) / 1000; // 15-minute bars from 06:00 UTC
const STEP = 15 * 60;
const RANGE_BARS = 16;

const TICK_MS = 150; // one candle per tick
const PHASE_HOLD_MS = 1300; // linger when a new phase starts so its caption can be read
const HOLD_MS = 2800; // pause on the finished picture before looping

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStory() {
  const rand = mulberry32(20260915);
  const mid = 2650;
  // Close targets per phase: range chop, push through the high, false break
  // back through the low, then the hedge leg.
  const path: number[] = [];
  for (let i = 0; i < RANGE_BARS; i++) path.push(mid + Math.sin(i * 1.3) * 2.2 + (rand() - 0.5) * 2);
  path.push(mid + 2.5, mid + 6.5, mid + 9);
  path.push(mid + 7, mid + 4, mid + 1, mid - 2, mid - 4.5, mid - 7);
  for (let i = 1; i <= 14; i++) path.push(mid - 7 - i * 1.25 + (rand() - 0.5) * 2.4);

  const candles: CandlestickData<UTCTimestamp>[] = [];
  let prev = mid - 0.8;
  path.forEach((close, i) => {
    const open = prev;
    const body = Math.abs(close - open);
    const wick = 0.6 + rand() * 1.6 + body * 0.15;
    candles.push({
      time: (START + i * STEP) as UTCTimestamp,
      open: +open.toFixed(2),
      close: +close.toFixed(2),
      high: +(Math.max(open, close) + wick * rand()).toFixed(2),
      low: +(Math.min(open, close) - wick * rand()).toFixed(2),
    });
    prev = close;
  });

  const range = candles.slice(0, RANGE_BARS);
  const rangeHigh = Math.max(...range.map((c) => c.high));
  const rangeLow = Math.min(...range.map((c) => c.low));

  // Events are read off the candles, so the markers always match the drawing.
  const breakoutBar = candles.findIndex((c, i) => i >= RANGE_BARS && c.close > rangeHigh);
  const hedgeBar = candles.findIndex((c, i) => i > breakoutBar && c.close < rangeLow);

  return {
    candles,
    rangeHigh,
    rangeLow,
    breakoutBar,
    hedgeBar,
    minLow: Math.min(...candles.map((c) => c.low)),
    maxHigh: Math.max(...candles.map((c) => c.high)),
  };
}

const STORY = buildStory();
const TOTAL = STORY.candles.length;
const FULL_RANGE = { from: -0.5, to: TOTAL + 1.5 };

type Phase = { key: string; step: number; label: string; tone: "muted" | "up" | "down" | "primary" };

// What the chart is showing once `shown` candles are on screen.
function phaseFor(shown: number): Phase {
  const { breakoutBar, hedgeBar } = STORY;
  if (shown < RANGE_BARS) return { key: "range", step: 1, label: "Marking the session range", tone: "muted" };
  if (shown <= breakoutBar) return { key: "wait", step: 1, label: "Range set — waiting for a clean break", tone: "primary" };
  if (shown <= breakoutBar + 3) return { key: "breakout", step: 2, label: "Breakout above the range — entry taken", tone: "up" };
  if (shown <= hedgeBar) return { key: "false", step: 3, label: "False break — price falls back through the range", tone: "down" };
  if (shown < TOTAL) return { key: "hedge", step: 4, label: "Hedge opens below the range low", tone: "primary" };
  return { key: "done", step: 4, label: "Hedge carries the move — exposure stays structured", tone: "primary" };
}

const COLORS = {
  up: "#0ecb81",
  down: "#f6465d",
  primary: "#fcd535",
  text: "#707a8a",
  grid: "rgba(43, 49, 57, 0.6)",
  border: "#2b3139",
};

export default function RecoveryChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const shownRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const dashedRef = useRef<number>(2);

  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<Phase>(phaseFor(0));
  const inView = useInView(containerRef, { amount: 0.4 });
  const reduceMotion = useReducedMotion();

  // Create the chart once. The library touches the DOM, so it is loaded
  // client-side inside the effect rather than at module scope.
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | null = null;

    (async () => {
      const lc = await import("lightweight-charts");
      if (disposed || !containerRef.current) return;

      const chart = lc.createChart(containerRef.current, {
        autoSize: true,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: COLORS.text,
          fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
          fontSize: 11,
          attributionLogo: true, // TradingView attribution, as the library asks
        },
        grid: {
          vertLines: { color: COLORS.grid },
          horzLines: { color: COLORS.grid },
        },
        rightPriceScale: { borderColor: COLORS.border, scaleMargins: { top: 0.12, bottom: 0.08 } },
        timeScale: {
          borderColor: COLORS.border,
          timeVisible: true,
          secondsVisible: false,
          // Bars stream in on a loop; keep the session window still.
          shiftVisibleRangeOnNewBar: false,
        },
        crosshair: {
          vertLine: { color: COLORS.border, labelBackgroundColor: "#2b3139" },
          horzLine: { color: COLORS.border, labelBackgroundColor: "#2b3139" },
        },
        // Hover works; wheel and drag stay with the page.
        handleScroll: false,
        handleScale: false,
      });

      const series = chart.addSeries(lc.CandlestickSeries, {
        upColor: COLORS.up,
        downColor: COLORS.down,
        borderUpColor: COLORS.up,
        borderDownColor: COLORS.down,
        wickUpColor: COLORS.up,
        wickDownColor: COLORS.down,
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        lastValueVisible: false,
        priceLineVisible: false,
        // Fix the price axis to the whole story so it never jumps mid-loop.
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: STORY.minLow, maxValue: STORY.maxHigh },
        }),
      });

      dashedRef.current = lc.LineStyle.Dashed;
      chartRef.current = chart;
      seriesRef.current = series;
      markersRef.current = lc.createSeriesMarkers(series, []);
      chart.timeScale().setVisibleLogicalRange(FULL_RANGE);

      observer = new ResizeObserver(() => chart.timeScale().setVisibleLogicalRange(FULL_RANGE));
      observer.observe(containerRef.current);
      setReady(true);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, []);

  // Draw the chart as it looks with `shown` candles on screen.
  const render = (shown: number) => {
    const series = seriesRef.current;
    if (!series) return;

    // update() appends one bar; any other jump (restart, reduced motion)
    // redraws the whole slice.
    if (shown - shownRef.current === 1 && shown > 1) {
      series.update(STORY.candles[shown - 1]);
    } else {
      series.setData(STORY.candles.slice(0, shown));
      // setData resets the view; pin it back to the whole session window.
      chartRef.current?.timeScale().setVisibleLogicalRange(FULL_RANGE);
    }

    // Phone widths have no room for line titles or long marker text.
    const compact = (containerRef.current?.clientWidth ?? 600) < 480;

    // Range lines appear once the range has actually formed.
    const wantLines = shown >= RANGE_BARS;
    if (wantLines && linesRef.current.length === 0) {
      const style = { lineWidth: 1 as const, lineStyle: dashedRef.current, axisLabelVisible: true };
      linesRef.current = [
        series.createPriceLine({ ...style, price: STORY.rangeHigh, color: COLORS.primary, title: compact ? "" : "Range high" }),
        series.createPriceLine({ ...style, price: STORY.rangeLow, color: COLORS.primary, title: compact ? "" : "Range low" }),
      ];
    } else if (!wantLines && linesRef.current.length > 0) {
      linesRef.current.forEach((line) => series.removePriceLine(line));
      linesRef.current = [];
    }

    const markers: SeriesMarker<Time>[] = [];
    if (shown > STORY.breakoutBar) {
      markers.push({
        time: STORY.candles[STORY.breakoutBar].time,
        position: "belowBar",
        shape: "arrowUp",
        color: COLORS.up,
        text: compact ? "Entry" : "Breakout entry",
      });
    }
    if (shown > STORY.hedgeBar) {
      markers.push({
        time: STORY.candles[STORY.hedgeBar].time,
        position: "aboveBar",
        shape: "arrowDown",
        color: COLORS.primary,
        text: "Hedge",
      });
    }
    markersRef.current?.setMarkers(markers);
    setPhase(phaseFor(shown));
  };

  // The loop: one candle per tick, hold on the finished picture, start over.
  // Runs only while the chart is on screen and not paused.
  useEffect(() => {
    if (!ready) return;

    if (reduceMotion) {
      render(TOTAL);
      shownRef.current = TOTAL;
      return;
    }

    if (!inView || paused) return;

    const delayAfter = (shown: number) => {
      if (shown === TOTAL) return HOLD_MS;
      const phaseStarted = shown > 1 && phaseFor(shown).key !== phaseFor(shown - 1).key;
      return phaseStarted ? PHASE_HOLD_MS : TICK_MS;
    };

    const tick = () => {
      const next = shownRef.current >= TOTAL ? 1 : shownRef.current + 1;
      render(next);
      shownRef.current = next;
      timerRef.current = window.setTimeout(tick, delayAfter(next));
    };

    timerRef.current = window.setTimeout(tick, shownRef.current ? delayAfter(shownRef.current) : TICK_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [ready, inView, paused, reduceMotion]);

  return (
    <div className="ft-chart">
      <div className="ft-chart-head">
        <span className="ft-chart-symbol">
          XAUUSD <em>15m</em>
        </span>
        <span className="ft-chart-legend">
          <span><i className="is-range" /> Session range</span>
          <span><i className="is-up" /> Breakout</span>
          <span><i className="is-hedge" /> Hedge</span>
        </span>
        {!reduceMotion && (
          <button
            type="button"
            className="ft-chart-toggle"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            aria-label={paused ? "Play the chart animation" : "Pause the chart animation"}
          >
            {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
            {paused ? "Play" : "Pause"}
          </button>
        )}
      </div>

      <div className="ft-chart-phase" aria-live="polite">
        <span className="ft-chart-steps" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={n <= phase.step ? "is-on" : ""} />
          ))}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={phase.key}
            className={`ft-chart-phase-label is-${phase.tone}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {phase.label}
          </motion.span>
        </AnimatePresence>
      </div>

      <div
        ref={containerRef}
        className="ft-chart-canvas"
        role="img"
        aria-label="Illustrative XAUUSD candlestick chart: a session range forms, price breaks above it, falls back through the range, and a hedge below the range low carries the move."
      />
      <p className="ft-chart-note">Illustrative example — not market data or trading results.</p>
    </div>
  );
}
