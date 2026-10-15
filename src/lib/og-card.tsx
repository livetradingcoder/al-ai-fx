import type { ReactElement, ReactNode } from "react";

import type { OgCard } from "@/lib/og-data";

// The share card: 1200 x 630, the shape WhatsApp, Facebook, X and Slack show
// when a link is pasted. Drawn with ImageResponse (Satori), which understands
// flexbox and a subset of CSS: every box is display: flex, positions are
// absolute where layers overlap, and nothing relies on grid.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const C = {
  bg: "#0c0907",
  cream: "#fff7e3",
  gold: "#f4dca2",
  body: "#d8cdb8",
  muted: "#b8ab94",
  line: "rgba(244, 220, 162, 0.3)",
  chip: "rgba(12, 9, 7, 0.72)",
};

const HEADING = "Outfit";
const TEXT = "Inter";

function titleSize(title: string, base: number): number {
  const length = title.length;
  if (length <= 22) return base;
  if (length <= 34) return Math.round(base * 0.88);
  if (length <= 52) return Math.round(base * 0.76);
  return Math.round(base * 0.66);
}

/** A robot's name is the headline: big for a short one, smaller so a long one breaks into two even lines, never one word alone. */
function robotTitleSize(name: string): number {
  const length = name.length;
  if (length <= 12) return 76;
  if (length <= 18) return 62;
  if (length <= 30) return 54;
  return 46;
}

function Chip({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "8px 16px",
        borderRadius: 999,
        border: `1px solid ${C.line}`,
        backgroundColor: C.chip,
        fontFamily: TEXT,
        fontWeight: 600,
        fontSize: 17,
        letterSpacing: 0.4,
        color: strong ? C.gold : C.cream,
      }}
    >
      {children}
    </div>
  );
}

function TopBar() {
  return (
    <div
      style={{
        position: "absolute",
        top: 36,
        left: 56,
        right: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 24,
            border: `1px solid ${C.line}`,
            backgroundColor: "rgba(244, 220, 162, 0.1)",
            fontFamily: HEADING,
            fontWeight: 700,
            fontSize: 19,
            color: C.gold,
          }}
        >
          GB
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 14 }}>
          <div style={{ display: "flex", fontFamily: HEADING, fontWeight: 700, fontSize: 25, letterSpacing: 1, color: C.cream }}>
            GOLDBOT
          </div>
          <div style={{ display: "flex", fontFamily: TEXT, fontWeight: 600, fontSize: 11, letterSpacing: 2.4, color: C.muted, marginTop: 4 }}>
            BY AL-AI-FX
          </div>
        </div>
      </div>
      <Chip>XAUUSD · MT5</Chip>
    </div>
  );
}

function Footer({ chips }: { chips: string[] }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        right: 56,
        bottom: 38,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", fontFamily: TEXT, fontWeight: 600, fontSize: 24, color: C.cream }}>al-ai-fx.xyz</div>
      <div style={{ display: "flex" }}>
        {chips.map((chip, i) => (
          <div key={chip} style={{ display: "flex", marginLeft: i === 0 ? 0 : 12 }}>
            <Chip>{chip}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: OG_WIDTH,
        height: OG_HEIGHT,
        backgroundColor: C.bg,
        backgroundImage:
          "radial-gradient(circle at 88% 8%, rgba(244, 220, 162, 0.2) 0%, rgba(244, 220, 162, 0) 46%), radial-gradient(circle at 8% 100%, rgba(244, 220, 162, 0.08) 0%, rgba(244, 220, 162, 0) 40%)",
        fontFamily: TEXT,
        color: C.cream,
      }}
    >
      {children}
    </div>
  );
}

function Headline({ title, subtitle, size, top = 150, width = 1000 }: { title: string; subtitle: string; size: number; top?: number; width?: number }) {
  return (
    <div style={{ position: "absolute", left: 56, top, width, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          fontFamily: HEADING,
          fontWeight: 700,
          fontSize: titleSize(title, size),
          lineHeight: 1.06,
          color: C.cream,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", fontFamily: TEXT, fontWeight: 400, fontSize: 27, lineHeight: 1.42, color: C.body, marginTop: 22 }}>
        {subtitle}
      </div>
    </div>
  );
}

function RobotCard({ card }: { card: Extract<OgCard, { kind: "robot" }> }) {
  return (
    <Frame>
      {card.artwork && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.artwork}
          alt=""
          width={820}
          height={OG_HEIGHT}
          style={{ position: "absolute", top: 0, right: 0, width: 820, height: OG_HEIGHT, objectFit: "cover", objectPosition: "50% 22%" }}
        />
      )}
      {card.artwork && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 770,
            height: OG_HEIGHT,
            // Solid under the text, then fading into the picture. Starting at the
            // card's edge keeps a visible seam from forming where it began.
            backgroundImage: `linear-gradient(90deg, ${C.bg} 0%, ${C.bg} 44%, rgba(12, 9, 7, 0.88) 62%, rgba(12, 9, 7, 0) 100%)`,
          }}
        />
      )}
      <TopBar />
      <div style={{ position: "absolute", left: 56, top: 128, width: 580, display: "flex", flexDirection: "column" }}>
        {card.badge && (
          <div style={{ display: "flex", marginBottom: 20 }}>
            <Chip strong>{card.badge}</Chip>
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontFamily: HEADING,
            fontWeight: 700,
            fontSize: robotTitleSize(card.name),
            lineHeight: 1.04,
            color: C.cream,
          }}
        >
          {card.name}
        </div>
        <div style={{ display: "flex", fontFamily: TEXT, fontSize: 25, lineHeight: 1.4, color: C.body, marginTop: 18 }}>
          {card.blurb}
        </div>
        <div style={{ display: "flex", fontFamily: HEADING, fontWeight: 700, fontSize: 36, color: C.gold, marginTop: 22 }}>
          {card.price}
        </div>
      </div>
      <Footer chips={card.freeTrial ? ["Account-locked build", "Free trial"] : ["Account-locked build"]} />
    </Frame>
  );
}

const TILE_H = 150;
const TILE_GAP = 18;
const TILES_WIDTH = OG_WIDTH - 2 * 56;

/** Four tiles share the row; with fewer, each gets wider (up to a limit) instead of leaving the row empty. */
function tileWidth(count: number): number {
  return Math.max(255, Math.min(380, Math.floor((TILES_WIDTH - TILE_GAP * (count - 1)) / Math.max(count, 1))));
}

function Tile({ name, artwork, width }: { name: string; artwork: string | null; width: number }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width,
        height: TILE_H,
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${C.line}`,
        backgroundColor: "#17110d",
      }}
    >
      {artwork && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artwork} alt="" width={width} height={TILE_H} style={{ position: "absolute", top: 0, left: 0, width, height: TILE_H, objectFit: "cover" }} />
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          padding: "26px 14px 10px",
          backgroundImage: "linear-gradient(180deg, rgba(12, 9, 7, 0) 0%, rgba(12, 9, 7, 0.92) 100%)",
          fontFamily: TEXT,
          fontWeight: 600,
          fontSize: 17,
          color: C.cream,
        }}
      >
        {name}
      </div>
    </div>
  );
}

function CatalogCard({ card }: { card: Extract<OgCard, { kind: "catalog" }> }) {
  return (
    <Frame>
      <TopBar />
      <div style={{ position: "absolute", left: 56, top: 112, display: "flex" }}>
        <Chip strong>{card.count}</Chip>
      </div>
      <Headline title={card.title} subtitle={card.subtitle} size={68} top={168} />
      <div style={{ position: "absolute", left: 56, right: 56, top: 392, display: "flex" }}>
        {card.robots.map((robot, i) => (
          <div key={robot.name} style={{ display: "flex", marginLeft: i === 0 ? 0 : TILE_GAP }}>
            <Tile name={robot.name} artwork={robot.artwork} width={tileWidth(card.robots.length)} />
          </div>
        ))}
      </div>
      <Footer chips={card.freeTrial ? ["Account-locked build", "Free trial"] : ["Account-locked build"]} />
    </Frame>
  );
}

function TextCard({ card }: { card: Extract<OgCard, { kind: "text" }> }) {
  return (
    <Frame>
      <div
        style={{
          position: "absolute",
          top: 70,
          right: -150,
          width: 560,
          height: 560,
          borderRadius: 280,
          border: "1px solid rgba(244, 220, 162, 0.16)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 150,
          right: -70,
          width: 400,
          height: 400,
          borderRadius: 200,
          border: "1px solid rgba(244, 220, 162, 0.1)",
          display: "flex",
        }}
      />
      <TopBar />
      <div style={{ position: "absolute", left: 56, top: 128, display: "flex" }}>
        <Chip strong>{card.eyebrow}</Chip>
      </div>
      <Headline title={card.title} subtitle={card.subtitle} size={78} top={184} width={960} />
      <Footer chips={card.chips} />
    </Frame>
  );
}

export function OgCardView({ card }: { card: OgCard }): ReactElement {
  switch (card.kind) {
    case "robot":
      return <RobotCard card={card} />;
    case "catalog":
      return <CatalogCard card={card} />;
    case "text":
      return <TextCard card={card} />;
  }
}
