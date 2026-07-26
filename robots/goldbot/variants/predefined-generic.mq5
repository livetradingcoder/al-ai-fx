//+------------------------------------------------------------------+
//|                                                GoldBot-Hybrid.mq5|
//|                                                               GG |
//+------------------------------------------------------------------+
#property copyright "GG"
#property version "1.00"

/////////////////////////////////////////////////////////////////////////
// LICENSING & PROTECTION
bool ExpiredON = true;
datetime ExpiredTime = D'2050.2.5 23:59:59';
bool AccountProtectON = true;
const long allowed_accounts[] = {5112157, 50156064, 125729100};
/////////////////////////////////////////////////////////////////////////

#include <Trade\Trade.mqh>
CTrade trade;

enum EnumRiskMode {
  FIXED_LOT,   // Lot size
  RISK_PERCENT // Compound
};

/////////////////////////////////////////////////////////////////////////
// USER INPUTS
input string BS = "----------BASIC SETTING----------";                   // BS
input EnumRiskMode RiskMode = FIXED_LOT;       // Lotsize Mode
input double LotSize = 0.1;                    // Fixed Lot Size
input double Compound = 1.0;                   // Risk Percent (%)
input int MagicNumber = 20250526;              // Magic Number Base (Range 1 uses this, Range 2 uses +1)
input string comm = "GG - GoldBot";            // Trade Comment base (no "_" allowed)

input string TR = "----------TRADE RESTRICTIONS----------";              // TR
input string IgnoreDates = "";                 // Custom holiday dates (YYYY.MM.DD, YYYY.MM.DD)

input string TM1 = "----------TIME SETTING 1----------";                 // TM1
input int TimeStart = 1;                       // Range 1 Start Hour
input int TimeStartMinute = 0;                 // Range 1 Start Minute (0-59)
input int TimeStop = 5;                        // Range 1 Stop Hour
input int TimeStopMinute = 0;                  // Range 1 Stop Minute (0-59)

input string TM2 = "----------TIME SETTING 2----------";                 // TM2
input int TimeStart2 = 2;                      // Range 2 Start Hour
input int TimeStartMinute2 = 35;               // Range 2 Start Minute (0-59)
input int TimeStop2 = 11;                      // Range 2 Stop Hour
input int TimeStopMinute2 = 5;                 // Range 2 Stop Minute (0-59)

input string FB1 = "----------FIRST BUY SETTING - RANGE 1----------";    // FB1
input double StopLossFB1 = 21.0;               // Maximum Stop Loss in $ (Range 1)
input double TakeProfitFB1 = 3.7;              // Take Profit in $ (Range 1)
input double Buffer1 = 0.16;                   // Buffer in $ (Range 1)

input string FS1 = "----------FIRST SELL SETTING - RANGE 1----------";   // FS1
input double StopLossFS1 = 11.2;               // Maximum Stop Loss in $ (Range 1)
input double TakeProfitFS1 = 1.5;              // Take Profit in $ (Range 1)

input string ST1 = "----------SECOND TRADE SETTING - RANGE 1----------"; // ST1
input double Multiplier1 = 5.0;                // Lotsize Multiplier for Hedge (Range 1)
input double TakeProfitST1 = 2.0;              // Take Profit in $ for Hedge (Range 1)

input string FB2 = "----------FIRST BUY SETTING - RANGE 2----------";    // FB2
input double StopLossFB2 = 11.8;               // Maximum Stop Loss in $ (Range 2)
input double TakeProfitFB2 = 2.1;              // Take Profit in $ (Range 2)
input double Buffer2 = 0.16;                   // Buffer in $ (Range 2)

input string FS2 = "----------FIRST SELL SETTING - RANGE 2----------";   // FS2
input double StopLossFS2 = 12.0;               // Maximum Stop Loss in $ (Range 2)
input double TakeProfitFS2 = 1.8;              // Take Profit in $ (Range 2)

input string ST2 = "----------SECOND TRADE SETTING - RANGE 2----------"; // ST2
input double Multiplier2 = 3.0;                // Lotsize Multiplier for Hedge (Range 2)
input double TakeProfitST2 = 4.5;              // Take Profit in $ for Hedge (Range 2)

input string HB = "----------HYBRID SETTING----------";                  // HB
input double MinDistanceMultiplier = 1.5;      // Min Distance Multiplier (x stops level)
/////////////////////////////////////////////////////////////////////////

int lotdigit = 3;

// Range 1 tracking
bool PendingOrdersPlaced1 = false;
bool BuyPendingActive1 = false;
bool SellPendingActive1 = false;
bool TradeTakenToday1 = false;
double HighRange1 = 0;
double LowRange1 = 0;

// Range 2 tracking
bool PendingOrdersPlaced2 = false;
bool BuyPendingActive2 = false;
bool SellPendingActive2 = false;
bool TradeTakenToday2 = false;
double HighRange2 = 0;
double LowRange2 = 0;

// Magic numbers for each range
int MagicNumber1;
int MagicNumber2;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
  bool IsAccount = false;
  bool IsExpired = false;

  long account = AccountInfoInteger(ACCOUNT_LOGIN);

  if (AccountProtectON) {
    for (int i = 0; i < ArraySize(allowed_accounts); i++) {
      if (account == allowed_accounts[i]) {
        IsAccount = true;
        Print("GG: Account verified.");
        break;
      }
    }
  } else {
    IsAccount = true;
  }

  if (TimeCurrent() <= ExpiredTime)
    IsExpired = false;
  else
    IsExpired = true;

  if (ExpiredON && IsExpired) {
    Print("GG: EA has expired.");
    return (INIT_FAILED);
  }

  if (AccountProtectON && !IsAccount) {
    Print("GG: Unauthorized account.");
    return (INIT_FAILED);
  }

  // Set magic numbers for each range
  MagicNumber1 = MagicNumber;
  MagicNumber2 = MagicNumber + 1;

  double min_volume = SymbolInfoDouble(NULL, SYMBOL_VOLUME_MIN);
  if (min_volume >= 0.01)
    lotdigit = 2;
  if (min_volume >= 0.1)
    lotdigit = 1;
  if (min_volume >= 1.0)
    lotdigit = 0;

  return (INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {}

//+------------------------------------------------------------------+
//| Helper functions to get settings based on active range           |
//+------------------------------------------------------------------+
double GetStopLossFB(int range) { return (range == 2) ? StopLossFB2 : StopLossFB1; }
double GetTakeProfitFB(int range) { return (range == 2) ? TakeProfitFB2 : TakeProfitFB1; }
double GetBuffer(int range) { return (range == 2) ? Buffer2 : Buffer1; }
double GetStopLossFS(int range) { return (range == 2) ? StopLossFS2 : StopLossFS1; }
double GetTakeProfitFS(int range) { return (range == 2) ? TakeProfitFS2 : TakeProfitFS1; }
double GetMultiplier(int range) { return (range == 2) ? Multiplier2 : Multiplier1; }
double GetTakeProfitST(int range) { return (range == 2) ? TakeProfitST2 : TakeProfitST1; }
int GetMagicNumber(int range) { return (range == 2) ? MagicNumber2 : MagicNumber1; }

//+------------------------------------------------------------------+
//| Get tracking variable values by range                            |
//+------------------------------------------------------------------+
bool GetTradeTaken(int range) { return (range == 2) ? TradeTakenToday2 : TradeTakenToday1; }
bool GetBuyPending(int range) { return (range == 2) ? BuyPendingActive2 : BuyPendingActive1; }
bool GetSellPending(int range) { return (range == 2) ? SellPendingActive2 : SellPendingActive1; }
bool GetPendingPlaced(int range) { return (range == 2) ? PendingOrdersPlaced2 : PendingOrdersPlaced1; }
double GetHighRange(int range) { return (range == 2) ? HighRange2 : HighRange1; }
double GetLowRange(int range) { return (range == 2) ? LowRange2 : LowRange1; }

//+------------------------------------------------------------------+
//| Set tracking variables by range                                  |
//+------------------------------------------------------------------+
void SetTradeTaken(int range, bool value) { if (range == 2) TradeTakenToday2 = value; else TradeTakenToday1 = value; }
void SetBuyPending(int range, bool value) { if (range == 2) BuyPendingActive2 = value; else BuyPendingActive1 = value; }
void SetSellPending(int range, bool value) { if (range == 2) SellPendingActive2 = value; else SellPendingActive1 = value; }
void SetPendingPlaced(int range, bool value) { if (range == 2) PendingOrdersPlaced2 = value; else PendingOrdersPlaced1 = value; }
void SetHighRange(int range, double value) { if (range == 2) HighRange2 = value; else HighRange1 = value; }
void SetLowRange(int range, double value) { if (range == 2) LowRange2 = value; else LowRange1 = value; }

//+------------------------------------------------------------------+
//| Check which range a timestamp falls into (returns 1 or 2)        |
//+------------------------------------------------------------------+
int GetTimeRange(long time) {
  MqlDateTime dt;
  TimeToStruct(time, dt);
  int curSecs = 3600 * dt.hour + 60 * dt.min + dt.sec;
  
  // Check Range 1
  int startSecs1 = 3600 * TimeStart + 60 * TimeStartMinute;
  int stopSecs1 = 3600 * TimeStop + 60 * TimeStopMinute;
  bool inRange1 = false;
  if (stopSecs1 >= startSecs1)
    inRange1 = (curSecs >= startSecs1 && curSecs < stopSecs1);
  else
    inRange1 = (curSecs >= startSecs1 || curSecs < stopSecs1);
  
  // Check Range 2
  int startSecs2 = 3600 * TimeStart2 + 60 * TimeStartMinute2;
  int stopSecs2 = 3600 * TimeStop2 + 60 * TimeStopMinute2;
  bool inRange2 = false;
  if (stopSecs2 >= startSecs2)
    inRange2 = (curSecs >= startSecs2 && curSecs < stopSecs2);
  else
    inRange2 = (curSecs >= startSecs2 || curSecs < stopSecs2);
  
  if (inRange1) return 1;
  if (inRange2) return 2;
  return 0;
}

//+------------------------------------------------------------------+
//| Get minimum distance for pending orders in price                 |
//+------------------------------------------------------------------+
double GetMinStopDistance() {
  long stopsLevel = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
  long spreadPoints = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
  double spread = spreadPoints * _Point;
  double minDistance = stopsLevel * _Point;
  
  // Add spread and apply multiplier for safety margin
  minDistance = (minDistance + spread) * MinDistanceMultiplier;
  
  // Minimum of 0.50$ for Gold
  if (minDistance < 0.50)
    minDistance = 0.50;
    
  return minDistance;
}

//+------------------------------------------------------------------+
//| Process a single range independently                           |
//+------------------------------------------------------------------+
void ProcessRangeIndependent(int range) {
  int OriginBuy, OriginSell, HedgeOrderBuy, HedgeOrderSell;
  int PrimaryBuyStop, PrimarySellStop;
  GetTradeInfoForRange(range, OriginBuy, OriginSell, HedgeOrderBuy, HedgeOrderSell, 
                       PrimaryBuyStop, PrimarySellStop);

  // Cleanup stray hedge orders if primary position is closed
  if (OriginBuy <= 0 && HedgeOrderSell > 0)
    DeleteHedgeOrderForRange(range, ORDER_TYPE_SELL_STOP);
  if (OriginSell <= 0 && HedgeOrderBuy > 0)
    DeleteHedgeOrderForRange(range, ORDER_TYPE_BUY_STOP);

  // Update pending order tracking for this range
  SetBuyPending(range, PrimaryBuyStop > 0);
  SetSellPending(range, PrimarySellStop > 0);

  // Skip if we already have a position for this range or already traded today for this range
  if (GetTradeTaken(range) || OriginBuy > 0 || OriginSell > 0)
    return;
    
  // Check if trade exists in history for today for this range
  if (IsTradeTodayForRange(range)) {
    SetTradeTaken(range, true);
    return;
  }

  // Check Holiday First
  if (IsHoliday())
    return;

  // Only proceed after this range's TimeStop
  if (!IsGoodTimeForRange(range))
    return;

  // Get range if not already set
  if (GetHighRange(range) <= 0 || GetLowRange(range) <= 0) {
    double hr = 0, lr = 0;
    GetRangeForTime(range, hr, lr);
    SetHighRange(range, hr);
    SetLowRange(range, lr);
    if (hr <= 0 || lr <= 0)
      return;
  }

  double AskPrice = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
  double BidPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
  double minDistance = GetMinStopDistance();

  ProcessRangeLogic(range, GetHighRange(range), GetLowRange(range), AskPrice, BidPrice, minDistance);
}

//+------------------------------------------------------------------+
//| Expert tick function - process each range independently          |
//+------------------------------------------------------------------+
void OnTick() {
  // Reset flags at start of new day for both ranges
  MqlDateTime dt;
  TimeToStruct(TimeCurrent(), dt);
  static int lastDay = -1;
  if (dt.day_of_year != lastDay) {
    lastDay = dt.day_of_year;
    PendingOrdersPlaced1 = false;
    BuyPendingActive1 = false;
    SellPendingActive1 = false;
    TradeTakenToday1 = false;
    HighRange1 = 0;
    LowRange1 = 0;
    PendingOrdersPlaced2 = false;
    BuyPendingActive2 = false;
    SellPendingActive2 = false;
    TradeTakenToday2 = false;
    HighRange2 = 0;
    LowRange2 = 0;
  }

  // Process Range 1 independently
  ProcessRangeIndependent(1);
  
  // Process Range 2 independently  
  ProcessRangeIndependent(2);
}

//+------------------------------------------------------------------+
//| Process trading logic for a specific range                       |
//+------------------------------------------------------------------+
void ProcessRangeLogic(int range, double highRange, double lowRange, double askPrice, double bidPrice, double minDistance) {
  double BuyStopEntry = NormalizeDouble(highRange + GetBuffer(range), _Digits);
  double SellStopEntry = NormalizeDouble(lowRange, _Digits);
  string CMPrimary = comm + "_1_R" + IntegerToString(range) + "_";

  //=== HANDLE BUY SIDE ===
  if (!GetBuyPending(range) && !GetTradeTaken(range)) {
    double distanceToBuyLevel = BuyStopEntry - askPrice;
    
    // Price already above breakout level - immediate market execution
    if (askPrice >= BuyStopEntry) {
      Print("GG: Range ", range, " - Price already above Buy level - MARKET EXECUTION");
      ExecuteMarketBuy(askPrice, CMPrimary, range, highRange);
    }
    // Price too close for pending order - wait and use market execution
    else if (distanceToBuyLevel < minDistance && distanceToBuyLevel > 0) {
      Print("GG: Range ", range, " - Buy level too close for pending (", 
            DoubleToString(distanceToBuyLevel, 2), " < ", 
            DoubleToString(minDistance, 2), ") - monitoring for market entry");
    }
    // Far enough for pending order
    else if (distanceToBuyLevel >= minDistance) {
      double BuySL = NormalizeDouble(BuyStopEntry - GetStopLossFB(range), _Digits);
      double BuyTP = NormalizeDouble(highRange + GetTakeProfitFB(range), _Digits);
      double BuyLot = LotSize;
      if (RiskMode == RISK_PERCENT) {
        BuyLot = LotSizeCal(MathAbs(BuyStopEntry - BuySL));
      }
      
      trade.SetExpertMagicNumber(GetMagicNumber(range));
      if (trade.BuyStop(BuyLot, BuyStopEntry, NULL, BuySL, BuyTP,
                        ORDER_TIME_DAY, 0, CMPrimary)) {
        SetBuyPending(range, true);
        Print("GG: Range ", range, " - Buy Stop placed at ", BuyStopEntry, 
              " (distance: ", DoubleToString(distanceToBuyLevel, 2), ")");
      }
    }
  }

  //=== HANDLE SELL SIDE ===
  if (!GetSellPending(range) && !GetTradeTaken(range)) {
    double distanceToSellLevel = bidPrice - SellStopEntry;
    
    // Price already below breakout level - immediate market execution
    if (bidPrice <= SellStopEntry) {
      Print("GG: Range ", range, " - Price already below Sell level - MARKET EXECUTION");
      ExecuteMarketSell(bidPrice, CMPrimary, range, lowRange);
    }
    // Price too close for pending order - wait and use market execution
    else if (distanceToSellLevel < minDistance && distanceToSellLevel > 0) {
      Print("GG: Range ", range, " - Sell level too close for pending (", 
            DoubleToString(distanceToSellLevel, 2), " < ", 
            DoubleToString(minDistance, 2), ") - monitoring for market entry");
    }
    // Far enough for pending order
    else if (distanceToSellLevel >= minDistance) {
      double SellSL = NormalizeDouble(SellStopEntry + GetStopLossFS(range), _Digits);
      double SellTP = NormalizeDouble(SellStopEntry - GetTakeProfitFS(range), _Digits);
      double SellLot = LotSize;
      if (RiskMode == RISK_PERCENT) {
        SellLot = LotSizeCal(MathAbs(SellStopEntry - SellSL));
      }
      
      trade.SetExpertMagicNumber(GetMagicNumber(range));
      if (trade.SellStop(SellLot, SellStopEntry, NULL, SellSL, SellTP,
                         ORDER_TIME_DAY, 0, CMPrimary)) {
        SetSellPending(range, true);
        Print("GG: Range ", range, " - Sell Stop placed at ", SellStopEntry,
              " (distance: ", DoubleToString(distanceToSellLevel, 2), ")");
      }
    }
  }
}

//+------------------------------------------------------------------+
//| Execute market buy with hedge                                    |
//+------------------------------------------------------------------+
void ExecuteMarketBuy(double price, string comment, int range, double highRange) {
  double BuySL = NormalizeDouble(price - GetStopLossFB(range), _Digits);
  double BuyTP = NormalizeDouble(highRange + GetTakeProfitFB(range), _Digits);
  double BuyLot = LotSize;
  
  if (RiskMode == RISK_PERCENT) {
    BuyLot = LotSizeCal(MathAbs(price - BuySL));
  }

  trade.SetExpertMagicNumber(GetMagicNumber(range));
  if (trade.Buy(BuyLot, NULL, price, BuySL, BuyTP, comment)) {
    SetTradeTaken(range, true);
    
    // Cancel opposite pending order if exists
    DeletePrimaryOrderForRange(range, ORDER_TYPE_SELL_STOP);
    
    // Place Hedge
    double HedgeEntry = BuySL;
    double HedgeSL = NormalizeDouble(price, _Digits);
    double HedgeLot = NormalizeDouble(GetMultiplier(range) * BuyLot, lotdigit);
    double HedgeTP = NormalizeDouble(HedgeEntry - GetTakeProfitST(range), _Digits);
    string CMHedge = comm + "_2_R" + IntegerToString(range) + "_";
    
    trade.SellStop(HedgeLot, HedgeEntry, NULL, HedgeSL, HedgeTP,
                   ORDER_TIME_GTC, 0, CMHedge);
    Print("GG: Range ", range, " - Market Buy executed, Hedge Sell Stop placed at ", HedgeEntry);
  }
}

//+------------------------------------------------------------------+
//| Execute market sell with hedge                                   |
//+------------------------------------------------------------------+
void ExecuteMarketSell(double price, string comment, int range, double lowRange) {
  double SellSL = NormalizeDouble(price + GetStopLossFS(range), _Digits);
  double SellTP = NormalizeDouble(price - GetTakeProfitFS(range), _Digits);
  double SellLot = LotSize;
  
  if (RiskMode == RISK_PERCENT) {
    SellLot = LotSizeCal(MathAbs(price - SellSL));
  }

  trade.SetExpertMagicNumber(GetMagicNumber(range));
  if (trade.Sell(SellLot, NULL, price, SellSL, SellTP, comment)) {
    SetTradeTaken(range, true);
    
    // Cancel opposite pending order if exists
    DeletePrimaryOrderForRange(range, ORDER_TYPE_BUY_STOP);
    
    // Place Hedge
    double HedgeEntry = SellSL;
    double HedgeSL = NormalizeDouble(price, _Digits);
    double HedgeLot = NormalizeDouble(GetMultiplier(range) * SellLot, lotdigit);
    double HedgeTP = NormalizeDouble(HedgeEntry + GetTakeProfitST(range), _Digits);
    string CMHedge = comm + "_2_R" + IntegerToString(range) + "_";
    
    trade.BuyStop(HedgeLot, HedgeEntry, NULL, HedgeSL, HedgeTP,
                  ORDER_TIME_GTC, 0, CMHedge);
    Print("GG: Range ", range, " - Market Sell executed, Hedge Buy Stop placed at ", HedgeEntry);
  }
}

//+------------------------------------------------------------------+
//| Extract range number from comment (e.g., "1p_GG_GoldBot_1_R2_")   |
//+------------------------------------------------------------------+
int ExtractRangeFromComment(string comment) {
  int pos = StringFind(comment, "_R");
  if (pos >= 0) {
    string rangeStr = StringSubstr(comment, pos + 2, 1);
    return (int)StringToInteger(rangeStr);
  }
  return 1; // Default to range 1 if not found
}

//+------------------------------------------------------------------+
//| Trade transaction handler - for pending order fills              |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result) {
  
  if (trans.type == TRADE_TRANSACTION_DEAL_ADD) {
    ulong dealTicket = trans.deal;
    
    if (HistoryDealSelect(dealTicket)) {
      long dealMagic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
      string dealSymbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      string dealComment = HistoryDealGetString(dealTicket, DEAL_COMMENT);
      long dealType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      long dealEntry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      double dealVolume = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
      double dealPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      
      // Check if deal belongs to either range's magic number
      if ((dealMagic == MagicNumber1 || dealMagic == MagicNumber2) && 
          dealSymbol == _Symbol && dealEntry == DEAL_ENTRY_IN) {
        
        // Determine range from magic number
        int range = (dealMagic == MagicNumber2) ? 2 : 1;
        
        // Check if this is a primary order fill (from pending)
        if (StringFind(dealComment, "_1_") >= 0) {
          SetTradeTaken(range, true);
          
          // Primary BUY filled
          if (dealType == DEAL_TYPE_BUY) {
            Print("GG: Range ", range, " - Buy Stop filled at ", dealPrice);
            DeletePrimaryOrderForRange(range, ORDER_TYPE_SELL_STOP);
            
            double HedgeEntry = NormalizeDouble(dealPrice - GetStopLossFB(range), _Digits);
            double HedgeSL = NormalizeDouble(dealPrice, _Digits);
            double HedgeLot = NormalizeDouble(GetMultiplier(range) * dealVolume, lotdigit);
            double HedgeTP = NormalizeDouble(HedgeEntry - GetTakeProfitST(range), _Digits);
            string CMHedge = comm + "_2_R" + IntegerToString(range) + "_";
            
            trade.SetExpertMagicNumber(GetMagicNumber(range));
            trade.SellStop(HedgeLot, HedgeEntry, NULL, HedgeSL, HedgeTP,
                           ORDER_TIME_GTC, 0, CMHedge);
            Print("GG: Range ", range, " - Hedge Sell Stop placed at ", HedgeEntry);
          }
          // Primary SELL filled
          else if (dealType == DEAL_TYPE_SELL) {
            Print("GG: Range ", range, " - Sell Stop filled at ", dealPrice);
            DeletePrimaryOrderForRange(range, ORDER_TYPE_BUY_STOP);
            
            double HedgeEntry = NormalizeDouble(dealPrice + GetStopLossFS(range), _Digits);
            double HedgeSL = NormalizeDouble(dealPrice, _Digits);
            double HedgeLot = NormalizeDouble(GetMultiplier(range) * dealVolume, lotdigit);
            double HedgeTP = NormalizeDouble(HedgeEntry + GetTakeProfitST(range), _Digits);
            string CMHedge = comm + "_2_R" + IntegerToString(range) + "_";
            
            trade.SetExpertMagicNumber(GetMagicNumber(range));
            trade.BuyStop(HedgeLot, HedgeEntry, NULL, HedgeSL, HedgeTP,
                          ORDER_TIME_GTC, 0, CMHedge);
            Print("GG: Range ", range, " - Hedge Buy Stop placed at ", HedgeEntry);
          }
        }
      }
    }
  }
}

//+------------------------------------------------------------------+
//| Get information about active trades and pending orders           |
//+------------------------------------------------------------------+
void GetTradeInfoForRange(int range, int &originBuy, int &originSell, int &hedgeOrderBuy, 
                          int &hedgeOrderSell, int &primaryBuyStop, int &primarySellStop) {
  originBuy = 0;
  originSell = 0;
  hedgeOrderBuy = 0;
  hedgeOrderSell = 0;
  primaryBuyStop = 0;
  primarySellStop = 0;
  
  int magic = GetMagicNumber(range);

  for (int i = OrdersTotal() - 1; i >= 0; i--) {
    if (OrderSelect(OrderGetTicket(i))) {
      if (OrderGetInteger(ORDER_MAGIC) == magic &&
          OrderGetString(ORDER_SYMBOL) == _Symbol) {
        string cmt = OrderGetString(ORDER_COMMENT);
        long orderType = OrderGetInteger(ORDER_TYPE);

        if (StringFind(cmt, "_1_R") >= 0) {
          if (orderType == ORDER_TYPE_BUY_STOP)
            primaryBuyStop++;
          else if (orderType == ORDER_TYPE_SELL_STOP)
            primarySellStop++;
        }
        else if (StringFind(cmt, "_2_R") >= 0) {
          if (orderType == ORDER_TYPE_BUY_STOP)
            hedgeOrderBuy++;
          else if (orderType == ORDER_TYPE_SELL_STOP)
            hedgeOrderSell++;
        }
      }
    }
  }

  for (int i = PositionsTotal() - 1; i >= 0; i--) {
    if (PositionSelectByTicket(PositionGetTicket(i))) {
      if (PositionGetInteger(POSITION_MAGIC) == magic &&
          PositionGetString(POSITION_SYMBOL) == _Symbol) {
        if (StringFind(PositionGetString(POSITION_COMMENT), "_1_R") >= 0) {
          if (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
            originBuy++;
          else if (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL)
            originSell++;
        }
      }
    }
  }
}

//+------------------------------------------------------------------+
//| Calculate the High/Low range for specified hours (specific range)|
//+------------------------------------------------------------------+
void GetRangeForTime(int rangeNum, double &aboverange, double &belowrange) {
  aboverange = 0;
  belowrange = 0;
  for (int i = 1; i < 1000; i++) {
    long timei = iTime(_Symbol, PERIOD_H1, i);
    if (GetTimeRange(timei) == rangeNum) {
      for (int k = i; k < 1000; k++) {
        long timek = iTime(_Symbol, PERIOD_H1, k);
        if (GetTimeRange(timek) == rangeNum) {
          double highk = iHigh(_Symbol, PERIOD_H1, k);
          double lowk = iLow(_Symbol, PERIOD_H1, k);
          if (highk > aboverange || aboverange <= 0)
            aboverange = highk;
          if (lowk < belowrange || belowrange <= 0)
            belowrange = lowk;
        } else
          break;
      }
      break;
    }
  }
}

//+------------------------------------------------------------------+
//| Calculate both ranges                                            |
//+------------------------------------------------------------------+
void GetBothRanges() {
  GetRangeForTime(1, HighRange1, LowRange1);
  GetRangeForTime(2, HighRange2, LowRange2);
}

//+------------------------------------------------------------------+
//| Check if a timestamp falls within either Range 1 or Range 2    |
//+------------------------------------------------------------------+
bool IsTimeRange(long time) {
  MqlDateTime dt;
  TimeToStruct(time, dt);
  int curSecs = 3600 * dt.hour + 60 * dt.min + dt.sec;
  
  // Check Range 1
  int startSecs1 = 3600 * TimeStart + 60 * TimeStartMinute;
  int stopSecs1 = 3600 * TimeStop + 60 * TimeStopMinute;
  bool inRange1 = false;
  if (stopSecs1 >= startSecs1)
    inRange1 = (curSecs >= startSecs1 && curSecs < stopSecs1);
  else
    inRange1 = (curSecs >= startSecs1 || curSecs < stopSecs1);
  
  // Check Range 2
  int startSecs2 = 3600 * TimeStart2 + 60 * TimeStartMinute2;
  int stopSecs2 = 3600 * TimeStop2 + 60 * TimeStopMinute2;
  bool inRange2 = false;
  if (stopSecs2 >= startSecs2)
    inRange2 = (curSecs >= startSecs2 && curSecs < stopSecs2);
  else
    inRange2 = (curSecs >= startSecs2 || curSecs < stopSecs2);
  
  return (inRange1 || inRange2);
}

//+------------------------------------------------------------------+
//| Check if current time is after the specified range end             |
//+------------------------------------------------------------------+
bool IsGoodTimeForRange(int range) {
  int stopSecs;
  if (range == 2)
    stopSecs = 3600 * TimeStop2 + 60 * TimeStopMinute2;
  else
    stopSecs = 3600 * TimeStop + 60 * TimeStopMinute;
  
  MqlDateTime dt;
  TimeToStruct(TimeCurrent(), dt);
  int curSecs = 3600 * dt.hour + 60 * dt.min + dt.sec;
  
  return (curSecs >= stopSecs);
}

//+------------------------------------------------------------------+
//| Check if either range has completed today                          |
//+------------------------------------------------------------------+
bool IsGoodTime() {
  // Check if after Range 1 end OR after Range 2 end
  return IsGoodTimeForRange(1) || IsGoodTimeForRange(2);
}

//+------------------------------------------------------------------+
//| Check if today is a Holiday in the ignore list                   |
//+------------------------------------------------------------------+
bool IsHoliday() {
  string today = TimeToString(TimeCurrent(), TIME_DATE); // Returns "YYYY.MM.DD"

  // 1. Check User Custom Dates
  if (IgnoreDates != "") {
    string dates[];
    StringSplit(IgnoreDates, ',', dates);
    for (int i = 0; i < ArraySize(dates); i++) {
      string d = dates[i];
      StringTrimLeft(d);
      StringTrimRight(d);
      if (d == today) {
        return true;
      }
    }
  }

  // 2. Check Hardcoded Consolidated UK, USA, DE, FR, IT Bank Holidays (2023-2027)
  string hardcoded =
      "2023.01.01," +
      "2024.01.01," +
      "2025.01.01," +
      "2026.01.01," +
      "2027.01.01," +
      "2028.01.01," +
      "2029.01.01," +
      "2030.01.01," +
      "2031.01.01";

  if (StringFind(hardcoded, today) >= 0) {
    return true;
  }

  return false;
}

//+------------------------------------------------------------------+
//| Check if a trade has already occurred today                      |
//+------------------------------------------------------------------+
bool IsTradeTodayForRange(int range) {
  HistorySelect(iTime(_Symbol, PERIOD_D1, 0), TimeCurrent());
  int magic = GetMagicNumber(range);
  for (int i = HistoryDealsTotal() - 1; i >= 0; i--) {
    ulong Ticket = HistoryDealGetTicket(i);
    if (HistoryDealGetInteger(Ticket, DEAL_MAGIC) == magic &&
        HistoryDealGetString(Ticket, DEAL_SYMBOL) == _Symbol) {
      return (true);
    }
  }
  return (false);
}

//+------------------------------------------------------------------+
//| Delete all pending orders for this EA                            |
//+------------------------------------------------------------------+
void DeleteOrder() {
  for (int i = OrdersTotal() - 1; i >= 0; i--) {
    ulong Ticket = OrderGetTicket(i);
    if (OrderGetInteger(ORDER_MAGIC) == MagicNumber &&
        OrderGetString(ORDER_SYMBOL) == _Symbol) {
      trade.OrderDelete(Ticket);
    }
  }
}

//+------------------------------------------------------------------+
//| Delete primary pending orders of specific type                   |
//+------------------------------------------------------------------+
void DeletePrimaryOrderForRange(int range, const ENUM_ORDER_TYPE type) {
  int magic = GetMagicNumber(range);
  for (int i = OrdersTotal() - 1; i >= 0; i--) {
    ulong Ticket = OrderGetTicket(i);
    if (OrderSelect(Ticket)) {
      if (OrderGetInteger(ORDER_MAGIC) == magic &&
          OrderGetString(ORDER_SYMBOL) == _Symbol) {
        if (OrderGetInteger(ORDER_TYPE) == type) {
          if (StringFind(OrderGetString(ORDER_COMMENT), "_1_R") >= 0) {
            trade.OrderDelete(Ticket);
            Print("GG: Range ", range, " - Deleted primary order ticket ", Ticket);
          }
        }
      }
    }
  }
}

//+------------------------------------------------------------------+
//| Calculate lot size based on risk and distance                    |
//+------------------------------------------------------------------+
double LotSizeCal(double PointSL) {
  double lostMoney = 0.01 * Compound * AccountInfoDouble(ACCOUNT_BALANCE);
  double min_volume = SymbolInfoDouble(NULL, SYMBOL_VOLUME_MIN);
  double max_volume = SymbolInfoDouble(NULL, SYMBOL_VOLUME_MAX);
  double LossPerLot =
      (PointSL / _Point) * SymbolInfoDouble(NULL, SYMBOL_TRADE_TICK_VALUE);

  if (LossPerLot == 0)
    return (min_volume);

  double lotsize = NormalizeDouble(lostMoney / LossPerLot, lotdigit);
  if (lotsize < min_volume)
    lotsize = min_volume;
  if (lotsize > max_volume)
    lotsize = max_volume;
  return (lotsize);
}

//+------------------------------------------------------------------+
//| Delete specific hedge orders                                     |
//+------------------------------------------------------------------+
void DeleteHedgeOrderForRange(int range, const ENUM_ORDER_TYPE type) {
  int magic = GetMagicNumber(range);
  for (int i = OrdersTotal() - 1; i >= 0; i--) {
    ulong Ticket = OrderGetTicket(i);
    if (OrderSelect(Ticket)) {
      if (OrderGetInteger(ORDER_MAGIC) == magic &&
          OrderGetString(ORDER_SYMBOL) == _Symbol) {
        if (OrderGetInteger(ORDER_TYPE) == type) {
          if (StringFind(OrderGetString(ORDER_COMMENT), "_2_R") >= 0)
            trade.OrderDelete(Ticket);
        }
      }
    }
  }
}
//+------------------------------------------------------------------+
