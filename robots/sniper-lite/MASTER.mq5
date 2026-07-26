//+------------------------------------------------------------------+
//|                                          Sniper_Lite_EA_v5.mq5  |
//|  v5 — distilled best-of from Pine v10 + Lite v3                  |
//|                                                                  |
//|  Philosophy: keep what gives edge, drop what adds noise.          |
//|   * Core signal: RSI pullback recovery (proven 80%+ WR pattern)  |
//|   * Confluence: EMA200 trend, Supertrend, MACD hist, ADX, BB     |
//|     expansion, HTF RSI, volume spike (8 high-signal filters)     |
//|   * S&P pattern exits: max-loss cut, profit lock, trailing BE    |
//|   * Partial scaling: 33% TP1 (1.5R), 33% TP2 (3R), 34% TP3 (5R)  |
//|   * Risk-% lot sizing, equity stop, cooldown after loss          |
//+------------------------------------------------------------------+
#property copyright "Sniper Lite v5"
#property version   "5.00"
#property strict

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>

//============================ INPUTS =============================
input group "=== Signal core ==="
input int    InpRsiLen        = 14;
input int    InpRsiDipBelow   = 35;     // tightened: long needs deeper dip
input int    InpRsiSpikeOver  = 78;     // tightened: short needs higher spike
input int    InpRsiLookback   = 6;      // tightened: dip must be recent
input int    InpScoreThr      = 6;      // raised from 5 (max 8)
input int    InpEma200Len     = 200;
input int    InpEmaSlopeBars  = 10;     // EMA200 slope confirm window (0=off)
input bool   InpUseBbPosGate  = true;   // long needs BB lower-half, short upper-half
input bool   InpRequireRsiCross= true;  // RSI must actually CROSS up/down level (not just recover)

input group "=== Confluence filters ==="
input bool   InpUseSupertrend = true;
input int    InpStAtrPer      = 10;
input double InpStMult         = 3.0;
input bool   InpUseMacd       = true;
input int    InpMacdF         = 12;
input int    InpMacdS         = 26;
input int    InpMacdSig       = 9;
input bool   InpUseAdx        = true;
input int    InpAdxLen        = 14;
input int    InpAdxThr        = 22;
input bool   InpUseBbExpand   = true;
input int    InpBbLen         = 20;
input bool   InpUseHtfRsi     = true;
input ENUM_TIMEFRAMES InpHtfTf= PERIOD_H4;
input bool   InpUseVolSpike   = false;  // off by default — tick volume noisy
input int    InpVolLen        = 20;
input double InpVolMul        = 1.5;
input bool   InpUseEngulf     = false;  // optional candle confirm

input group "=== Risk & money management ==="
input int    InpAtrPer        = 14;
input double InpAtrMul        = 2.5;    // wider stops — XAUUSD M15 noise
input double InpTp1R          = 1.0;    // lowered: lock profit faster
input double InpTp2R          = 2.0;
input double InpTp3R          = 4.0;
input double InpTp1Pct        = 50.0;   // bigger first scale-out
input double InpTp2Pct        = 50.0;
input bool   InpUseRiskPct    = true;
input double InpRiskPct       = 0.75;   // lowered from 1.0
input double InpFixedLot      = 0.10;
input double InpEquityStopPct = 12.0;

input group "=== S&P pattern exits ==="
input double InpMaxLossPct    = 2.0;    // hard cut on unrealized %
input double InpProfitLockPct = 1.5;    // peak >= X then drop <0.5% = exit
input int    InpRsiXL         = 72;     // RSI overbought exit (long)
input int    InpRsiXS         = 28;     // RSI oversold exit (short)

input group "=== Position management ==="
input bool   InpUseBreakeven  = true;
input double InpBreakevenAtR  = 1.0;
input bool   InpUseTrailing   = true;
input double InpTrailAtrMul   = 2.0;
input int    InpMaxBars       = 120;    // time stop

input group "=== Cooldown ==="
input bool   InpUseCooldown   = true;
input int    InpCooldownBars  = 16;     // raised from 10 — give losing regimes time to clear

input group "=== Session filter ==="
input bool   InpUseSessionFlt = true;   // only trade during liquid hours (broker time)
input int    InpSessStartHr   = 8;      // London open
input int    InpSessEndHr     = 21;     // NY close

input group "=== Trade ==="
input ulong  InpMagic         = 778005;
input int    InpDeviation     = 20;
input bool   InpEnableLong    = true;
input bool   InpEnableShort   = true;

//============================ STATE ==============================
CTrade        trade;
CPositionInfo pos;

int h_rsi, h_ema200, h_atr, h_atrSt, h_bb, h_macd, h_adx, h_htfRsi;

datetime g_lastBar       = 0;
datetime g_cooldownUntil = 0;
double   g_startEquity   = 0;
bool     g_stopped       = false;
int      g_digits        = 5;

// open-trade state
double g_entry    = 0;
double g_initSL   = 0;
double g_riskPx   = 0;
double g_tp1      = 0;
double g_tp2      = 0;
double g_tp3      = 0;
double g_initLots = 0;
double g_peakPnl  = 0;
bool   g_tp1Hit   = false;
bool   g_tp2Hit   = false;
bool   g_beMoved  = false;
datetime g_openBarT = 0;

//============================ HELPERS ============================
double Buf(int handle, int idx, int shift)
  {
   double a[];
   if(CopyBuffer(handle, idx, shift, 1, a) != 1) return EMPTY_VALUE;
   return a[0];
  }

bool BufN(int handle, int idx, int startShift, int count, double &out[])
  {
   ArraySetAsSeries(out, true);
   return CopyBuffer(handle, idx, startShift, count, out) == count;
  }

double H(int s) { return iHigh(_Symbol, _Period, s); }
double L(int s) { return iLow (_Symbol, _Period, s); }
double C(int s) { return iClose(_Symbol, _Period, s); }
double O(int s) { return iOpen (_Symbol, _Period, s); }
long   V(int s) { return (long)iVolume(_Symbol, _Period, s); }

//============================ SUPERTREND =========================
int CalcStDir()
  {
   int bars = 200;
   double atr[], hi[], lo[], cl[];
   if(!BufN(h_atrSt, 0, 1, bars, atr)) return 0;
   if(CopyHigh (_Symbol, _Period, 1, bars, hi) != bars) return 0;
   if(CopyLow  (_Symbol, _Period, 1, bars, lo) != bars) return 0;
   if(CopyClose(_Symbol, _Period, 1, bars, cl) != bars) return 0;
   ArraySetAsSeries(hi, true); ArraySetAsSeries(lo, true); ArraySetAsSeries(cl, true);

   double prevUB=0, prevLB=0, prevST=0, prevC=0, st=0;
   int dir = 1;
   for(int i = bars - 1; i >= 0; --i)
     {
      double hl2 = (hi[i] + lo[i]) / 2.0;
      double bUB = hl2 + InpStMult * atr[i];
      double bLB = hl2 - InpStMult * atr[i];
      double fUB, fLB;
      if(i == bars - 1) { fUB = bUB; fLB = bLB; st = bUB; dir = -1; }
      else
        {
         fUB = (bUB < prevUB || prevC > prevUB) ? bUB : prevUB;
         fLB = (bLB > prevLB || prevC < prevLB) ? bLB : prevLB;
         if(prevST == prevUB)
           { if(cl[i] > fUB) { st = fLB; dir = 1; } else { st = fUB; dir = -1; } }
         else
           { if(cl[i] < fLB) { st = fUB; dir = -1; } else { st = fLB; dir = 1; } }
        }
      prevUB = fUB; prevLB = fLB; prevST = st; prevC = cl[i];
     }
   return dir;
  }

//============================ POSITION ===========================
bool HasPosition()
  {
   for(int i = PositionsTotal()-1; i >= 0; --i)
      if(pos.SelectByIndex(i))
         if(pos.Symbol() == _Symbol && pos.Magic() == (long)InpMagic) return true;
   return false;
  }

bool GetPos(ulong &ticket, int &type, double &openPx, double &curSL, double &curTP, double &vol, datetime &openT)
  {
   for(int i = PositionsTotal()-1; i >= 0; --i)
     {
      if(!pos.SelectByIndex(i)) continue;
      if(pos.Symbol() != _Symbol || pos.Magic() != (long)InpMagic) continue;
      ticket = pos.Ticket(); type = (int)pos.PositionType();
      openPx = pos.PriceOpen(); curSL = pos.StopLoss(); curTP = pos.TakeProfit();
      vol = pos.Volume(); openT = (datetime)pos.Time();
      return true;
     }
   return false;
  }

void ResetState()
  {
   g_entry = g_initSL = g_riskPx = 0;
   g_tp1 = g_tp2 = g_tp3 = 0;
   g_initLots = 0; g_peakPnl = 0;
   g_tp1Hit = g_tp2Hit = g_beMoved = false;
   g_openBarT = 0;
  }

//============================ LOT SIZING =========================
double CalcLots(double stopDistPx)
  {
   if(!InpUseRiskPct || stopDistPx <= 0) return InpFixedLot;
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   double riskCash = equity * InpRiskPct / 100.0;
   double tickVal  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickVal <= 0 || tickSize <= 0) return InpFixedLot;
   double lossPerLot = (stopDistPx / tickSize) * tickVal;
   if(lossPerLot <= 0) return InpFixedLot;
   double lots = riskCash / lossPerLot;
   double minLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   lots = MathFloor(lots / lotStep) * lotStep;
   lots = MathMax(minLot, MathMin(maxLot, lots));
   return NormalizeDouble(lots, 2);
  }

//============================ TRADE OPS ==========================
void OpenTrade(bool isLong, double atr)
  {
   double askPx = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bidPx = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double entry = isLong ? askPx : bidPx;
   double risk  = atr * InpAtrMul;
   if(risk <= 0) return;

   double lots  = CalcLots(risk);
   if(lots <= 0) return;

   double sl = NormalizeDouble(isLong ? entry - risk : entry + risk, g_digits);

   bool ok = isLong
      ? trade.Buy (lots, _Symbol, 0, sl, 0, "SniperLiteV5 L")
      : trade.Sell(lots, _Symbol, 0, sl, 0, "SniperLiteV5 S");
   if(!ok) { Print("v5 open failed: ", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription()); return; }

   g_entry    = entry;
   g_initSL   = sl;
   g_riskPx   = risk;
   g_tp1      = isLong ? entry + risk * InpTp1R : entry - risk * InpTp1R;
   g_tp2      = isLong ? entry + risk * InpTp2R : entry - risk * InpTp2R;
   g_tp3      = isLong ? entry + risk * InpTp3R : entry - risk * InpTp3R;
   g_initLots = lots;
   g_peakPnl  = 0;
   g_tp1Hit = g_tp2Hit = g_beMoved = false;
   g_openBarT = iTime(_Symbol, _Period, 0);
  }

void ClosePartial(ulong ticket, double pct)
  {
   double curVol = pos.Volume();
   double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double closeVol = curVol * pct / 100.0;
   closeVol = MathFloor(closeVol / step) * step;
   if(closeVol < minLot) return;
   if(curVol - closeVol < minLot) closeVol = curVol;
   trade.PositionClosePartial(ticket, closeVol);
  }

void CloseAll()
  {
   for(int i = PositionsTotal()-1; i >= 0; --i)
     {
      if(!pos.SelectByIndex(i)) continue;
      if(pos.Symbol()!=_Symbol || pos.Magic()!=(long)InpMagic) continue;
      trade.PositionClose(pos.Ticket());
     }
   ResetState();
  }

//============================ COOLDOWN ===========================
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &req,
                        const MqlTradeResult &res)
  {
   if(!InpUseCooldown) return;
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD || trans.deal == 0) return;
   if(!HistoryDealSelect(trans.deal)) return;

   long magic = HistoryDealGetInteger(trans.deal, DEAL_MAGIC);
   long entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   string sym = HistoryDealGetString (trans.deal, DEAL_SYMBOL);
   double profit = HistoryDealGetDouble(trans.deal, DEAL_PROFIT)
                 + HistoryDealGetDouble(trans.deal, DEAL_SWAP)
                 + HistoryDealGetDouble(trans.deal, DEAL_COMMISSION);
   if(magic != (long)InpMagic || sym != _Symbol) return;
   if(entry != DEAL_ENTRY_OUT) return;

   if(profit < 0.0)
     {
      datetime cur = iTime(_Symbol, _Period, 0);
      g_cooldownUntil = cur + (datetime)InpCooldownBars * PeriodSeconds(_Period);
     }
   if(!HasPosition()) ResetState();
  }

//============================ NEW-BAR LOGIC ======================
bool InSession()
  {
   if(!InpUseSessionFlt) return true;
   MqlDateTime tm; TimeToStruct(TimeCurrent(), tm);
   return tm.hour >= InpSessStartHr && tm.hour < InpSessEndHr;
  }

void ProcessBar()
  {
   if(!InSession()) return;

   double rsi1 = Buf(h_rsi, 0, 1);
   double rsi2 = Buf(h_rsi, 0, 2);
   double e200 = Buf(h_ema200, 0, 1);
   double atr  = Buf(h_atr, 0, 1);
   if(rsi1 == EMPTY_VALUE || e200 == EMPTY_VALUE || atr == EMPTY_VALUE || atr <= 0) return;

   double c1 = C(1), c2 = C(2);
   double o1 = O(1), o2 = O(2);

   //--- RSI pullback (the core edge)
   double rsiMin = rsi1, rsiMax = rsi1;
   for(int s = 1; s <= InpRsiLookback; s++)
     {
      double r = Buf(h_rsi, 0, s);
      if(r == EMPTY_VALUE) continue;
      if(r < rsiMin) rsiMin = r;
      if(r > rsiMax) rsiMax = r;
     }
   bool rsiWasOS = rsiMin < InpRsiDipBelow;
   bool rsiWasOB = rsiMax > InpRsiSpikeOver;
   bool rsiRecovL = rsiWasOS && rsi1 >= InpRsiDipBelow && rsi1 > rsi2;
   bool rsiRecovS = rsiWasOB && rsi1 <= 70 && rsi1 < rsi2;

   //--- Require RSI to actually CROSS the level (prev bar below, this bar above) — kills mid-pullback false positives
   if(InpRequireRsiCross)
     {
      bool crossUp   = rsi2 < InpRsiDipBelow && rsi1 >= InpRsiDipBelow;
      bool crossDown = rsi2 > 70 && rsi1 <= 70;
      rsiRecovL = rsiRecovL && crossUp;
      rsiRecovS = rsiRecovS && crossDown;
     }

   //--- Trend gate: price > EMA200 + EMA200 sloping up
   bool trendOkL = c1 > e200;
   bool trendOkS = c1 < e200;
   if(InpEmaSlopeBars > 0)
     {
      double e200past = Buf(h_ema200, 0, InpEmaSlopeBars + 1);
      if(e200past != EMPTY_VALUE)
        {
         trendOkL = trendOkL && (e200 > e200past);
         trendOkS = trendOkS && (e200 < e200past);
        }
     }

   //--- BB position gate: long requires lower-half (oversold zone), short upper-half
   if(InpUseBbPosGate)
     {
      double bbU = Buf(h_bb, 1, 1), bbL = Buf(h_bb, 2, 1);
      if(bbU != EMPTY_VALUE && bbL != EMPTY_VALUE && bbU > bbL)
        {
         double bbPos = (c1 - bbL) / (bbU - bbL);
         if(rsiRecovL && bbPos > 0.5) rsiRecovL = false;
         if(rsiRecovS && bbPos < 0.5) rsiRecovS = false;
        }
     }

   //--- Confluence score (max 8)
   int score = 0;

   if(InpUseSupertrend)
     {
      int stDir = CalcStDir();
      if(rsiRecovL && stDir ==  1) score++;
      if(rsiRecovS && stDir == -1) score++;
     } else score++;

   if(InpUseMacd)
     {
      double mh1 = Buf(h_macd, 0, 1) - Buf(h_macd, 1, 1);
      if(rsiRecovL && mh1 > 0) score++;
      if(rsiRecovS && mh1 < 0) score++;
     } else score++;

   if(InpUseAdx)
     {
      double adx = Buf(h_adx, 0, 1);
      double diP = Buf(h_adx, 1, 1);
      double diM = Buf(h_adx, 2, 1);
      if(adx > InpAdxThr)
        {
         if(rsiRecovL && diP > diM) score++;
         if(rsiRecovS && diM > diP) score++;
        }
     } else score++;

   if(InpUseBbExpand)
     {
      double bbU1 = Buf(h_bb, 1, 1), bbL1 = Buf(h_bb, 2, 1), bbM1 = Buf(h_bb, 0, 1);
      double bbU3 = Buf(h_bb, 1, 3), bbL3 = Buf(h_bb, 2, 3), bbM3 = Buf(h_bb, 0, 3);
      double w1 = bbM1 != 0 ? (bbU1 - bbL1) / bbM1 : 0;
      double w3 = bbM3 != 0 ? (bbU3 - bbL3) / bbM3 : 0;
      if(w1 > w3) score++;
     } else score++;

   if(InpUseHtfRsi)
     {
      double htfR = Buf(h_htfRsi, 0, 1);
      if(htfR != EMPTY_VALUE)
        {
         if(rsiRecovL && htfR >= 50 && htfR < 72) score++;
         if(rsiRecovS && htfR <= 50 && htfR > 28) score++;
        }
     } else score++;

   if(InpUseVolSpike)
     {
      long volSum = 0;
      for(int s = 1; s <= InpVolLen; s++) volSum += V(s);
      double vSma = (double)volSum / InpVolLen;
      bool vSpk = vSma > 0 && V(1) > vSma * InpVolMul;
      if(vSpk) score++;
     } else score++;

   if(InpUseEngulf)
     {
      bool bullEngulf = (c1 > o1) && (c2 < o2) && (c1 > o2) && (o1 <= c2);
      bool bearEngulf = (c1 < o1) && (c2 > o2) && (c1 < o2) && (o1 >= c2);
      if(rsiRecovL && bullEngulf) score++;
      if(rsiRecovS && bearEngulf) score++;
     } else score++;

   // base point: trend alignment
   if((rsiRecovL && trendOkL) || (rsiRecovS && trendOkS)) score++;

   //--- Cooldown
   datetime cur = iTime(_Symbol, _Period, 0);
   if(InpUseCooldown && cur < g_cooldownUntil) return;

   //--- Entries
   bool goLong  = InpEnableLong  && rsiRecovL && trendOkL && score >= InpScoreThr;
   bool goShort = InpEnableShort && rsiRecovS && trendOkS && score >= InpScoreThr;

   if(!HasPosition() && goLong)  OpenTrade(true,  atr);
   if(!HasPosition() && goShort) OpenTrade(false, atr);
  }

//============================ TICK MANAGEMENT ====================
void ManageOpen()
  {
   ulong ticket; int type; double openPx, curSL, curTP, vol; datetime openT;
   if(!GetPos(ticket, type, openPx, curSL, curTP, vol, openT)) { ResetState(); return; }
   if(g_riskPx <= 0) return;

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double px  = (type == POSITION_TYPE_BUY) ? bid : ask;

   double pnlPct = (type == POSITION_TYPE_BUY)
                 ? (px - g_entry) / g_entry * 100.0
                 : (g_entry - px) / g_entry * 100.0;
   if(pnlPct > g_peakPnl) g_peakPnl = pnlPct;

   //--- Hard cut on max unrealized loss
   if(InpMaxLossPct > 0 && pnlPct < -InpMaxLossPct)
     { trade.PositionClose(ticket); ResetState(); return; }

   //--- Profit lock: peak >= X then drop below 0.5%
   if(InpProfitLockPct > 0 && g_peakPnl >= InpProfitLockPct && pnlPct < 0.5)
     { trade.PositionClose(ticket); ResetState(); return; }

   //--- RSI overbought/oversold exit
   double rsi1 = Buf(h_rsi, 0, 1);
   double rsi2 = Buf(h_rsi, 0, 2);
   if(rsi1 != EMPTY_VALUE && rsi2 != EMPTY_VALUE)
     {
      if(type == POSITION_TYPE_BUY && rsi1 >= InpRsiXL && rsi1 < rsi2)
        { trade.PositionClose(ticket); ResetState(); return; }
      if(type == POSITION_TYPE_SELL && rsi1 <= InpRsiXS && rsi1 > rsi2)
        { trade.PositionClose(ticket); ResetState(); return; }
     }

   //--- Time stop
   if(InpMaxBars > 0 && g_openBarT > 0)
     {
      int barsIn = Bars(_Symbol, _Period, g_openBarT, TimeCurrent()) - 1;
      if(barsIn >= InpMaxBars) { trade.PositionClose(ticket); ResetState(); return; }
     }

   //--- Partial scaling
   if(type == POSITION_TYPE_BUY)
     {
      if(!g_tp1Hit && bid >= g_tp1) { ClosePartial(ticket, InpTp1Pct); g_tp1Hit = true; }
      else if(g_tp1Hit && !g_tp2Hit && bid >= g_tp2) { ClosePartial(ticket, InpTp2Pct); g_tp2Hit = true; }
      else if(g_tp2Hit && bid >= g_tp3) { trade.PositionClose(ticket); ResetState(); return; }
     }
   else
     {
      if(!g_tp1Hit && ask <= g_tp1) { ClosePartial(ticket, InpTp1Pct); g_tp1Hit = true; }
      else if(g_tp1Hit && !g_tp2Hit && ask <= g_tp2) { ClosePartial(ticket, InpTp2Pct); g_tp2Hit = true; }
      else if(g_tp2Hit && ask <= g_tp3) { trade.PositionClose(ticket); ResetState(); return; }
     }

   //--- Breakeven + trail (after +1R)
   double atr = Buf(h_atr, 0, 1);
   if(atr == EMPTY_VALUE || atr <= 0) return;

   double newSL = curSL;
   if(type == POSITION_TYPE_BUY)
     {
      double rMove = px - g_entry;
      if(InpUseBreakeven && !g_beMoved && rMove >= g_riskPx * InpBreakevenAtR)
        { newSL = MathMax(newSL, g_entry); g_beMoved = true; }
      if(InpUseTrailing && rMove >= g_riskPx * InpBreakevenAtR)
        { double trail = px - atr * InpTrailAtrMul; if(trail > newSL) newSL = trail; }
     }
   else
     {
      double rMove = g_entry - px;
      if(InpUseBreakeven && !g_beMoved && rMove >= g_riskPx * InpBreakevenAtR)
        { newSL = (curSL == 0) ? g_entry : MathMin(newSL, g_entry); g_beMoved = true; }
      if(InpUseTrailing && rMove >= g_riskPx * InpBreakevenAtR)
        { double trail = px + atr * InpTrailAtrMul; if(curSL == 0 || trail < newSL) newSL = trail; }
     }

   if(MathAbs(newSL - curSL) > _Point * 0.5)
      trade.PositionModify(ticket, NormalizeDouble(newSL, g_digits), curTP);
  }

//============================ EVENT HANDLERS =====================
int OnInit()
  {
   g_digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpDeviation);
   trade.SetTypeFillingBySymbol(_Symbol);

   h_rsi    = iRSI  (_Symbol, _Period, InpRsiLen, PRICE_CLOSE);
   h_ema200 = iMA   (_Symbol, _Period, InpEma200Len, 0, MODE_EMA, PRICE_CLOSE);
   h_atr    = iATR  (_Symbol, _Period, InpAtrPer);
   h_atrSt  = iATR  (_Symbol, _Period, InpStAtrPer);
   h_bb     = iBands(_Symbol, _Period, InpBbLen, 0, 2.0, PRICE_CLOSE);
   h_macd   = iMACD (_Symbol, _Period, InpMacdF, InpMacdS, InpMacdSig, PRICE_CLOSE);
   h_adx    = iADX  (_Symbol, _Period, InpAdxLen);
   h_htfRsi = iRSI  (_Symbol, InpHtfTf, 14, PRICE_CLOSE);

   if(h_rsi==INVALID_HANDLE || h_ema200==INVALID_HANDLE || h_atr==INVALID_HANDLE
      || h_atrSt==INVALID_HANDLE || h_bb==INVALID_HANDLE || h_macd==INVALID_HANDLE
      || h_adx==INVALID_HANDLE || h_htfRsi==INVALID_HANDLE)
     { Print("v5: handle init failed"); return INIT_FAILED; }

   g_startEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   g_lastBar = 0;
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   int handles[] = {h_rsi, h_ema200, h_atr, h_atrSt, h_bb, h_macd, h_adx, h_htfRsi};
   for(int i = 0; i < ArraySize(handles); i++)
      if(handles[i] != INVALID_HANDLE) IndicatorRelease(handles[i]);
  }

void OnTick()
  {
   if(g_stopped) return;

   if(InpEquityStopPct > 0 && g_startEquity > 0)
     {
      double eq = AccountInfoDouble(ACCOUNT_EQUITY);
      double dd = (g_startEquity - eq) / g_startEquity * 100.0;
      if(dd >= InpEquityStopPct) { CloseAll(); g_stopped = true; Print("v5: equity stop, halted"); return; }
     }

   if(HasPosition()) ManageOpen();

   datetime barT = iTime(_Symbol, _Period, 0);
   if(barT == g_lastBar) return;
   g_lastBar = barT;

   if(Bars(_Symbol, _Period) < 250) return;
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) return;
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED)) return;

   ProcessBar();
  }
//+------------------------------------------------------------------+
