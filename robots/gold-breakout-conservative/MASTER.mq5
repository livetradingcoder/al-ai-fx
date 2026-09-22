//+------------------------------------------------------------------+
//|                          AL-ai-FX Gold Breakout Conservative.mq5 |
//|                                                         AL-ai-FX |
//|                                             https://al-ai-fx.xyz |
//+------------------------------------------------------------------+
#property copyright "AL-ai-FX"
#property link "https://al-ai-fx.xyz"
#property version "1.00"
#property description "Gold Breakout Conservative - one session-range breakout a day on XAUUSD with tight targets and a light hedge"

/////////////////////////////////////////////////////////////////////////
// LICENSING & PROTECTION
// The compile daemon rewrites these four lines for every buyer: account
// lock on, allowed_accounts = the buyer's MT5 login, ExpiredTime = the
// subscription end. Keep each on one line in exactly this form.
bool ExpiredON = true;
datetime ExpiredTime = D'2050.2.5 23:59:59';
bool AccountProtectON = false;
const long allowed_accounts[] = {0};
/////////////////////////////////////////////////////////////////////////

#include <Trade\Trade.mqh>
CTrade trade;

//--- User Inputs
input string BS = "---------AL-ai-FX Gold Breakout Conservative---------";
input double LotSize = 0.03;  // Lot Size
input double x = 5.0;          // Multiplier (x)
input string TS = "---------Time Settings---------";
input int StartHour = 7;       // Start Hour (0-23)
input int StartMinute = 0;     // Start Minute (0-59)
input int StopHour = 10;       // Stop Hour (0-23)
input int StopMinute = 0;      // Stop Minute (0-59)

//--- Hardcoded Settings

const int MagicNumber = 20260512;
const string comm = "AL-ai-FX BreakoutC";   // MUST NOT contain "_"
const double StopLossFB = 13.3;
const double TakeProfitFB = 2.0;
const double Buffer = 0.16;
const double StopLossFS = 13.3;
const double TakeProfitFS = 2.0;
const double TakeProfitST = 2.0;

int lotdigit = 3;
bool StartTrade = false;

//+------------------------------------------------------------------+
//| Licence check while running                                      |
//+------------------------------------------------------------------+
// OnInit only runs when the EA is attached or the terminal restarts, so a
// terminal left running would otherwise keep trading past the expiry. Once
// expired: no new trades, but stray hedge orders are still cleaned up.
bool IsLicenceExpired() {
  if (!ExpiredON || TimeCurrent() <= ExpiredTime) return false;
  static bool announced = false;
  if (!announced) {
    announced = true;
    Print("BreakoutC: Licence expired - no new trades. Open positions keep their stops.");
    Comment("AL-ai-FX Gold Breakout Conservative: licence expired - renew at al-ai-fx.xyz");
  }
  return true;
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
  bool IsAccount = false;
  bool IsExpired = false;

  long account = AccountInfoInteger(ACCOUNT_LOGIN);

  // Check Account Protection
  if (AccountProtectON) {
    for (int i = 0; i < ArraySize(allowed_accounts); i++) {
      if (account == allowed_accounts[i]) {
        IsAccount = true;
        Print("BreakoutC: Account verified.");
        break;
      }
    }
  } else {
    IsAccount = true;
  }

  // Check Expiry
  if (TimeCurrent() <= ExpiredTime)
    IsExpired = false;
  else
    IsExpired = true;

  if (ExpiredON && IsExpired) {
    Print("BreakoutC: EA has expired.");
    return (INIT_FAILED);
  }

  if (AccountProtectON && !IsAccount) {
    Print("BreakoutC: Unauthorized account.");
    return (INIT_FAILED);
  }

  trade.SetExpertMagicNumber(MagicNumber);
  Print("BreakoutC: Initialized successfully.");

  // Determine Lot Digits
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
void OnDeinit(const int reason) { Comment(""); }

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick() {
  int OriginBuy, OriginSell, HedgeOrderBuy, HedgeOrderSell;
  GetTradeInfo(OriginBuy, OriginSell, HedgeOrderBuy, HedgeOrderSell);

  // Cleanup stray hedge orders if primary position is closed
  if (OriginBuy <= 0 && HedgeOrderSell > 0)
    DeleteHedgeOrder(ORDER_TYPE_SELL_STOP);
  if (OriginSell <= 0 && HedgeOrderBuy > 0)
    DeleteHedgeOrder(ORDER_TYPE_BUY_STOP);

  // Past the licence end: keep cleaning up, open nothing new.
  if (IsLicenceExpired())
    return;

  // Check if it's time to start monitoring range breakout
  if (!StartTrade) {
    MqlDateTime dt;
    TimeToStruct(TimeCurrent(), dt);
    int curSecs = 3600 * dt.hour + 60 * dt.min + dt.sec;
    int stopSecs = 3600 * StopHour + 60 * StopMinute;
    if (curSecs >= stopSecs && curSecs < stopSecs + 3600) {
      StartTrade = true;
    }
  }

  // Trading Logic
  if (StartTrade) {
    if (!IsTradeToday()) {
      if (IsGoodTime()) {
        double HighRange, LowRange;
        GetRange(HighRange, LowRange);

        if (HighRange > 0 && LowRange > 0) {
          double AskPrice =
              NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_ASK), _Digits);
          double BidPrice =
              NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits);
          string CM = comm + "_1_";

          // Buy Condition: Breakout above HighRange + Buffer
          if (AskPrice >= HighRange + Buffer) {
            double BuySL = AskPrice - StopLossFB;
            double BuyTP = HighRange + TakeProfitFB;
            double BuyLot = LotSize;

            BuySL = NormalizeDouble(BuySL, _Digits);
            BuyTP = NormalizeDouble(BuyTP, _Digits);

            bool result = trade.Buy(BuyLot, NULL, AskPrice, BuySL, BuyTP, CM);

            if (result) {
              // Place Hedge Order (Sell Stop at Buy SL)
              double HedgeEntry = BuySL;
              double HedgeSL = AskPrice;
              double HedgeLot = NormalizeDouble(x * BuyLot, lotdigit);
              double HedgeTP = HedgeEntry - TakeProfitST;
              HedgeTP = NormalizeDouble(HedgeTP, _Digits);
              string CMHedge = comm + "_2_";
              trade.SellStop(HedgeLot, HedgeEntry, NULL, HedgeSL, HedgeTP,
                             ORDER_TIME_GTC, 0, CMHedge);
            }
          }

          // Sell Condition: Breakout below LowRange
          if (BidPrice <= LowRange) {
            double SellPrice = BidPrice;
            double SellSL = BidPrice + StopLossFS;
            double SellTP = SellPrice - TakeProfitFS;
            double SellLot = LotSize;

            SellSL = NormalizeDouble(SellSL, _Digits);
            SellTP = NormalizeDouble(SellTP, _Digits);

            bool result =
                trade.Sell(SellLot, NULL, BidPrice, SellSL, SellTP, CM);

            if (result) {
              // Place Hedge Order (Buy Stop at Sell SL)
              double HedgeEntry = SellSL;
              double HedgeSL = BidPrice;
              double HedgeLot = NormalizeDouble(x * SellLot, lotdigit);
              double HedgeTP = HedgeEntry + TakeProfitST;
              HedgeTP = NormalizeDouble(HedgeTP, _Digits);
              string CMHedge = comm + "_2_";
              trade.BuyStop(HedgeLot, HedgeEntry, NULL, HedgeSL, HedgeTP,
                            ORDER_TIME_GTC, 0, CMHedge);
            }
          }
        }
      }
    }
  }
}

//+------------------------------------------------------------------+
//| Get information about active trades and pending orders           |
//+------------------------------------------------------------------+
void GetTradeInfo(int &originBuy, int &originSell, int &hedgeOrderBuy,
                  int &hedgeOrderSell) {
  originBuy = 0;
  originSell = 0;
  hedgeOrderBuy = 0;
  hedgeOrderSell = 0;

  // Scan Pending Orders
  for (int i = OrdersTotal() - 1; i >= 0; i--) {
    if (OrderSelect(OrderGetTicket(i))) {
      if (OrderGetInteger(ORDER_MAGIC) == MagicNumber &&
          OrderGetString(ORDER_SYMBOL) == _Symbol) {
        string CmAnaly[];
        int k = StringSplit(OrderGetString(ORDER_COMMENT),
                            StringGetCharacter("_", 0), CmAnaly);
        if (k >= 2 && (int)CmAnaly[1] == 2) {
          if (OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_BUY_STOP)
            hedgeOrderBuy++;
          else if (OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_SELL_STOP)
            hedgeOrderSell++;
        }
      }
    }
  }

  // Scan Open Positions
  for (int i = PositionsTotal() - 1; i >= 0; i--) {
    if (PositionSelectByTicket(PositionGetTicket(i))) {
      if (PositionGetInteger(POSITION_MAGIC) == MagicNumber &&
          PositionGetString(POSITION_SYMBOL) == _Symbol) {
        string CmAnaly[];
        int k = StringSplit(PositionGetString(POSITION_COMMENT),
                            StringGetCharacter("_", 0), CmAnaly);
        if (k >= 2 && (int)CmAnaly[1] == 1) {
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
//| Calculate the High/Low range for specified hours and minutes     |
//+------------------------------------------------------------------+
void GetRange(double &aboverange, double &belowrange) {
  aboverange = 0;
  belowrange = 0;
  int max_bars = 5000; // Look back up to 5000 minutes (~3.5 days) to find the range
  for (int i = 1; i < max_bars; i++) {
    long timei = iTime(_Symbol, PERIOD_M1, i);
    if (timei <= 0) continue;
    if (IsTimeRange(timei)) {
      for (int k = i; k < max_bars; k++) {
        long timek = iTime(_Symbol, PERIOD_M1, k);
        if (timek <= 0) continue;
        if (IsTimeRange(timek)) {
          double highk = iHigh(_Symbol, PERIOD_M1, k);
          double lowk = iLow(_Symbol, PERIOD_M1, k);
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
//| Check if a timestamp falls within the Range hours and minutes    |
//+------------------------------------------------------------------+
bool IsTimeRange(long time) {
  int startSecs = 3600 * StartHour + 60 * StartMinute;
  int stopSecs = 3600 * StopHour + 60 * StopMinute;
  MqlDateTime dt;
  TimeToStruct(time, dt);
  int curSecs = 3600 * dt.hour + 60 * dt.min + dt.sec;

  if (stopSecs >= startSecs)
    return (curSecs >= startSecs && curSecs < stopSecs);
  else
    return (curSecs >= startSecs || curSecs < stopSecs);
}

//+------------------------------------------------------------------+
//| Check if current time is after the range definition period       |
//+------------------------------------------------------------------+
bool IsGoodTime() {
  int startSecs = 3600 * StartHour + 60 * StartMinute;
  int stopSecs = 3600 * StopHour + 60 * StopMinute;
  MqlDateTime dt;
  TimeToStruct(TimeCurrent(), dt);
  int curSecs = 3600 * dt.hour + 60 * dt.min + dt.sec;

  if (stopSecs >= startSecs) {
    return (curSecs >= stopSecs);
  } else {
    return (curSecs >= stopSecs && curSecs < startSecs);
  }
}

//+------------------------------------------------------------------+
//| Check if a trade has already occurred today                      |
//+------------------------------------------------------------------+
bool IsTradeToday() {
  HistorySelect(iTime(_Symbol, PERIOD_D1, 0), TimeCurrent());
  for (int i = HistoryDealsTotal() - 1; i >= 0; i--) {
    ulong Ticket = HistoryDealGetTicket(i);
    if (HistoryDealGetInteger(Ticket, DEAL_MAGIC) == MagicNumber &&
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
//| Delete specific hedge orders                                     |
//+------------------------------------------------------------------+
void DeleteHedgeOrder(const ENUM_ORDER_TYPE type) {
  for (int i = OrdersTotal() - 1; i >= 0; i--) {
    ulong Ticket = OrderGetTicket(i);
    if (OrderGetInteger(ORDER_MAGIC) == MagicNumber &&
        OrderGetString(ORDER_SYMBOL) == _Symbol) {
      if (OrderGetInteger(ORDER_TYPE) == type) {
        string CmAnaly[];
        int k = StringSplit(OrderGetString(ORDER_COMMENT),
                            StringGetCharacter("_", 0), CmAnaly);
        if (k >= 2 && (int)CmAnaly[1] == 2)
          trade.OrderDelete(Ticket);
      }
    }
  }
}
//+------------------------------------------------------------------+
