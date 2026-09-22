//+------------------------------------------------------------------+
//|                                   AL-ai-FX Gold MultiRange 4.mq5 |
//|                                                         AL-ai-FX |
//|                                             https://al-ai-fx.xyz |
//+------------------------------------------------------------------+
#property copyright "AL-ai-FX"
#property link "https://al-ai-fx.xyz"
#property version "1.00"
#property description "Gold MultiRange 4 - four independent session-range breakouts on XAUUSD, each with its own hedge"

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

enum EnumRiskMode {
  FIXED_LOT,   // Fixed Lotsize
  RISK_PERCENT // Risk percent
};

input string BS = "---------BASIC SETTING---------";
input EnumRiskMode RiskMode = FIXED_LOT;  // Lotsize Mode
input double LotSize = 0.1;               // Fixed Lot Size
input double RiskPercent = 1.0;           // Risk Percent (%)
input int MagicNumber = 20260401;         // Magic Number Base (1=base,2=+1,3=+2,4=+3,5=+4,6=+5,7=+6)
// Hidden: an underscore typed into an input here would break the "_1_R" /
// "_2_R" parsing the EA uses to recognise its own orders.
string comm = "AL-ai-FX MR4";             // Trade Comment base - MUST NOT contain "_"

input string SR = "---------RANGE ON/OFF---------";
input bool Range1Enabled = true;  // Range 1 - Enable
bool Range2Enabled = false; // Range 2 - DISABLED (hidden)
bool Range3Enabled = false; // Range 3 - DISABLED (hidden)
input bool Range4Enabled = true;  // Range 4 - Enable
bool Range5Enabled = false; // Range 5 - DISABLED (hidden)
input bool Range6Enabled = true;  // Range 6 - Enable
input bool Range7Enabled = true;  // Range 7 - Enable

// Hidden settings (not visible to client)
string IgnoreDates = "";

// Range 1 time (hidden)
int TimeStart = 1;           int TimeStartMinute = 0;
int TimeStop  = 5;           int TimeStopMinute  = 0;

// Range 2 time (hidden)
int TimeStart2 = 2;          int TimeStartMinute2 = 35;
int TimeStop2  = 11;         int TimeStopMinute2  = 5;

// Range 3 time (hidden)
int TimeStart3 = 7;          int TimeStartMinute3 = 0;
int TimeStop3  = 10;         int TimeStopMinute3  = 0;

// Range 4 time (hidden)
int TimeStart4 = 0;          int TimeStartMinute4 = 0;
int TimeStop4  = 4;          int TimeStopMinute4  = 35;

// Range 5 time (hidden)
int TimeStart5 = 0;          int TimeStartMinute5 = 0;
int TimeStop5  = 6;          int TimeStopMinute5  = 00;

// Range 6 time (hidden) - copy of Range 5
int TimeStart6 = 1;          int TimeStartMinute6 = 0;
int TimeStop6  = 3;          int TimeStopMinute6  = 00;

// Range 7 time (hidden) - copy of Range 6
int TimeStart7 = 2;          int TimeStartMinute7 = 0;
int TimeStop7  = 3;          int TimeStopMinute7  = 00;

// Range 1 params
double StopLossFB1 = 21.0;   double TakeProfitFB1 = 3.7;   double Buffer1 = 0.16;
double StopLossFS1 = 11.2;   double TakeProfitFS1 = 1.5;
double Multiplier1 = 5.0;    double TakeProfitST1 = 2.0;

// Range 2 params
double StopLossFB2 = 11.8;   double TakeProfitFB2 = 2.1;   double Buffer2 = 0.16;
double StopLossFS2 = 12.0;   double TakeProfitFS2 = 1.8;
double Multiplier2 = 3.0;    double TakeProfitST2 = 4.5;

// Range 3 params
double StopLossFB3 = 13.3;   double TakeProfitFB3 = 2.0;   double Buffer3 = 0.16;
double StopLossFS3 = 12.5;   double TakeProfitFS3 = 1.7;
double Multiplier3 = 5.0;    double TakeProfitST3 = 2.0;

// Range 4 params
double StopLossFB4 = 13.8;   double TakeProfitFB4 = 2.1;   double Buffer4 = 0.16;
double StopLossFS4 = 12.5;   double TakeProfitFS4 = 1.8;
double Multiplier4 = 5.0;    double TakeProfitST4 = 2.5;

// Range 5 params
double StopLossFB5 = 11.8;   double TakeProfitFB5 = 2.1;   double Buffer5 = 0.16;
double StopLossFS5 = 12.0;   double TakeProfitFS5 = 1.8;
double Multiplier5 = 3.0;    double TakeProfitST5 = 4.5;

// Range 6 params - copy of Range 5
double StopLossFB6 = 11.8;   double TakeProfitFB6 = 2.1;   double Buffer6 = 0.16;
double StopLossFS6 = 12.0;   double TakeProfitFS6 = 1.8;
double Multiplier6 = 5.0;    double TakeProfitST6 = 2.5;

// Range 7 params - copy of Range 6
double StopLossFB7 = 11.8;   double TakeProfitFB7 = 2.1;   double Buffer7 = 0.16;
double StopLossFS7 = 12.0;   double TakeProfitFS7 = 1.8;
double Multiplier7 = 5.0;    double TakeProfitST7 = 2.5;

double MinDistanceMultiplier = 1.5;
int lotdigit = 3;

// Range 1 tracking
bool PendingOrdersPlaced1 = false;
bool BuyPendingActive1    = false;
bool SellPendingActive1   = false;
bool TradeTakenToday1     = false;
double HighRange1 = 0;
double LowRange1  = 0;

// Range 2 tracking
bool PendingOrdersPlaced2 = false;
bool BuyPendingActive2    = false;
bool SellPendingActive2   = false;
bool TradeTakenToday2     = false;
double HighRange2 = 0;
double LowRange2  = 0;

// Range 3 tracking
bool PendingOrdersPlaced3 = false;
bool BuyPendingActive3    = false;
bool SellPendingActive3   = false;
bool TradeTakenToday3     = false;
double HighRange3 = 0;
double LowRange3  = 0;

// Range 4 tracking
bool PendingOrdersPlaced4 = false;
bool BuyPendingActive4    = false;
bool SellPendingActive4   = false;
bool TradeTakenToday4     = false;
double HighRange4 = 0;
double LowRange4  = 0;

// Range 5 tracking
bool PendingOrdersPlaced5 = false;
bool BuyPendingActive5    = false;
bool SellPendingActive5   = false;
bool TradeTakenToday5     = false;
double HighRange5 = 0;
double LowRange5  = 0;

// Range 6 tracking
bool PendingOrdersPlaced6 = false;
bool BuyPendingActive6    = false;
bool SellPendingActive6   = false;
bool TradeTakenToday6     = false;
double HighRange6 = 0;
double LowRange6  = 0;

// Range 7 tracking
bool PendingOrdersPlaced7 = false;
bool BuyPendingActive7    = false;
bool SellPendingActive7   = false;
bool TradeTakenToday7     = false;
double HighRange7 = 0;
double LowRange7  = 0;

// Magic numbers
int MagicNumber1;
int MagicNumber2;
int MagicNumber3;
int MagicNumber4;
int MagicNumber5;
int MagicNumber6;
int MagicNumber7;

//+------------------------------------------------------------------+
//| Helper: check if current time has passed TimeStop for a range    |
//+------------------------------------------------------------------+
bool IsRangeAlreadyOver(int r) {
  int stopSecs;
  if      (r==7) stopSecs = 3600*TimeStop7 + 60*TimeStopMinute7;
  else if (r==6) stopSecs = 3600*TimeStop6 + 60*TimeStopMinute6;
  else if (r==5) stopSecs = 3600*TimeStop5 + 60*TimeStopMinute5;
  else if (r==4) stopSecs = 3600*TimeStop4 + 60*TimeStopMinute4;
  else if (r==3) stopSecs = 3600*TimeStop3 + 60*TimeStopMinute3;
  else if (r==2) stopSecs = 3600*TimeStop2 + 60*TimeStopMinute2;
  else           stopSecs = 3600*TimeStop  + 60*TimeStopMinute;

  MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
  int curSecs = 3600*dt.hour + 60*dt.min + dt.sec;
  return (curSecs >= stopSecs);
}

//+------------------------------------------------------------------+
//| Licence check while running                                      |
//+------------------------------------------------------------------+
// OnInit only runs when the EA is attached or the terminal restarts, so a
// terminal left running would otherwise keep trading past the expiry. Once
// expired: no new trades, but open positions and their hedges are still
// managed until they close.
bool IsLicenceExpired() {
  if (!ExpiredON || TimeCurrent() <= ExpiredTime) return false;
  static bool announced = false;
  if (!announced) {
    announced = true;
    Print("MR4: Licence expired - no new trades. Open positions are still managed.");
    Comment("AL-ai-FX Gold MultiRange 4: licence expired - renew at al-ai-fx.xyz");
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

  if (AccountProtectON) {
    for (int i = 0; i < ArraySize(allowed_accounts); i++) {
      if (account == allowed_accounts[i]) { IsAccount = true; Print("MR4: Account verified."); break; }
    }
  } else { IsAccount = true; }

  if (TimeCurrent() <= ExpiredTime) IsExpired = false; else IsExpired = true;

  if (ExpiredON && IsExpired)        { Print("MR4: EA has expired.");       return (INIT_FAILED); }
  if (AccountProtectON && !IsAccount){ Print("MR4: Unauthorized account."); return (INIT_FAILED); }

  MagicNumber1 = MagicNumber;
  MagicNumber2 = MagicNumber + 1;
  MagicNumber3 = MagicNumber + 2;
  MagicNumber4 = MagicNumber + 3;
  MagicNumber5 = MagicNumber + 4;
  MagicNumber6 = MagicNumber + 5;
  MagicNumber7 = MagicNumber + 6;

  double min_volume = SymbolInfoDouble(NULL, SYMBOL_VOLUME_MIN);
  if (min_volume >= 0.01) lotdigit = 2;
  if (min_volume >= 0.1)  lotdigit = 1;
  if (min_volume >= 1.0)  lotdigit = 0;

  for (int r = 1; r <= 7; r++) {
    if (IsRangeAlreadyOver(r)) {
      if (r==1) TradeTakenToday1 = true;
      if (r==2) TradeTakenToday2 = true;
      if (r==3) TradeTakenToday3 = true;
      if (r==4) TradeTakenToday4 = true;
      if (r==5) TradeTakenToday5 = true;
      if (r==6) TradeTakenToday6 = true;
      if (r==7) TradeTakenToday7 = true;
      Print("MR4: R",r," - Started after TimeStop, blocked for today.");
    }
  }

  return (INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { Comment(""); }

//+------------------------------------------------------------------+
//| Getters - settings per range                                    |
//+------------------------------------------------------------------+
double GetStopLossFB(int r)  { return (r==7)?StopLossFB7  :(r==6)?StopLossFB6  :(r==5)?StopLossFB5  :(r==4)?StopLossFB4  :(r==3)?StopLossFB3  :(r==2)?StopLossFB2  :StopLossFB1;  }
double GetTakeProfitFB(int r){ return (r==7)?TakeProfitFB7:(r==6)?TakeProfitFB6:(r==5)?TakeProfitFB5:(r==4)?TakeProfitFB4:(r==3)?TakeProfitFB3:(r==2)?TakeProfitFB2:TakeProfitFB1;}
double GetBuffer(int r)      { return (r==7)?Buffer7      :(r==6)?Buffer6      :(r==5)?Buffer5      :(r==4)?Buffer4      :(r==3)?Buffer3      :(r==2)?Buffer2      :Buffer1;      }
double GetStopLossFS(int r)  { return (r==7)?StopLossFS7  :(r==6)?StopLossFS6  :(r==5)?StopLossFS5  :(r==4)?StopLossFS4  :(r==3)?StopLossFS3  :(r==2)?StopLossFS2  :StopLossFS1;  }
double GetTakeProfitFS(int r){ return (r==7)?TakeProfitFS7:(r==6)?TakeProfitFS6:(r==5)?TakeProfitFS5:(r==4)?TakeProfitFS4:(r==3)?TakeProfitFS3:(r==2)?TakeProfitFS2:TakeProfitFS1;}
double GetMultiplier(int r)  { return (r==7)?Multiplier7  :(r==6)?Multiplier6  :(r==5)?Multiplier5  :(r==4)?Multiplier4  :(r==3)?Multiplier3  :(r==2)?Multiplier2  :Multiplier1;  }
double GetTakeProfitST(int r){ return (r==7)?TakeProfitST7:(r==6)?TakeProfitST6:(r==5)?TakeProfitST5:(r==4)?TakeProfitST4:(r==3)?TakeProfitST3:(r==2)?TakeProfitST2:TakeProfitST1;}
int    GetMagicNumber(int r) { return (r==7)?MagicNumber7 :(r==6)?MagicNumber6 :(r==5)?MagicNumber5 :(r==4)?MagicNumber4 :(r==3)?MagicNumber3 :(r==2)?MagicNumber2 :MagicNumber1; }

//+------------------------------------------------------------------+
//| Getters/Setters - tracking per range                            |
//+------------------------------------------------------------------+
bool   GetTradeTaken(int r)   { return (r==7)?TradeTakenToday7 :(r==6)?TradeTakenToday6 :(r==5)?TradeTakenToday5 :(r==4)?TradeTakenToday4 :(r==3)?TradeTakenToday3 :(r==2)?TradeTakenToday2 :TradeTakenToday1; }
bool   GetBuyPending(int r)   { return (r==7)?BuyPendingActive7 :(r==6)?BuyPendingActive6 :(r==5)?BuyPendingActive5 :(r==4)?BuyPendingActive4 :(r==3)?BuyPendingActive3 :(r==2)?BuyPendingActive2 :BuyPendingActive1; }
bool   GetSellPending(int r)  { return (r==7)?SellPendingActive7:(r==6)?SellPendingActive6:(r==5)?SellPendingActive5:(r==4)?SellPendingActive4:(r==3)?SellPendingActive3:(r==2)?SellPendingActive2:SellPendingActive1; }
bool   GetPendingPlaced(int r){ return (r==7)?PendingOrdersPlaced7:(r==6)?PendingOrdersPlaced6:(r==5)?PendingOrdersPlaced5:(r==4)?PendingOrdersPlaced4:(r==3)?PendingOrdersPlaced3:(r==2)?PendingOrdersPlaced2:PendingOrdersPlaced1; }
double GetHighRange(int r)    { return (r==7)?HighRange7:(r==6)?HighRange6:(r==5)?HighRange5:(r==4)?HighRange4:(r==3)?HighRange3:(r==2)?HighRange2:HighRange1; }
double GetLowRange(int r)     { return (r==7)?LowRange7 :(r==6)?LowRange6 :(r==5)?LowRange5 :(r==4)?LowRange4 :(r==3)?LowRange3 :(r==2)?LowRange2 :LowRange1;  }

void SetTradeTaken(int r, bool v)   { if(r==7)TradeTakenToday7=v;  else if(r==6)TradeTakenToday6=v;  else if(r==5)TradeTakenToday5=v;  else if(r==4)TradeTakenToday4=v;  else if(r==3)TradeTakenToday3=v;  else if(r==2)TradeTakenToday2=v;  else TradeTakenToday1=v;  }
void SetBuyPending(int r, bool v)   { if(r==7)BuyPendingActive7=v;  else if(r==6)BuyPendingActive6=v;  else if(r==5)BuyPendingActive5=v;  else if(r==4)BuyPendingActive4=v;  else if(r==3)BuyPendingActive3=v;  else if(r==2)BuyPendingActive2=v;  else BuyPendingActive1=v;  }
void SetSellPending(int r, bool v)  { if(r==7)SellPendingActive7=v; else if(r==6)SellPendingActive6=v; else if(r==5)SellPendingActive5=v; else if(r==4)SellPendingActive4=v; else if(r==3)SellPendingActive3=v; else if(r==2)SellPendingActive2=v; else SellPendingActive1=v; }
void SetPendingPlaced(int r, bool v){ if(r==7)PendingOrdersPlaced7=v;else if(r==6)PendingOrdersPlaced6=v;else if(r==5)PendingOrdersPlaced5=v;else if(r==4)PendingOrdersPlaced4=v;else if(r==3)PendingOrdersPlaced3=v;else if(r==2)PendingOrdersPlaced2=v;else PendingOrdersPlaced1=v;}
void SetHighRange(int r, double v)  { if(r==7)HighRange7=v; else if(r==6)HighRange6=v; else if(r==5)HighRange5=v; else if(r==4)HighRange4=v; else if(r==3)HighRange3=v; else if(r==2)HighRange2=v; else HighRange1=v; }
void SetLowRange(int r, double v)   { if(r==7)LowRange7=v;  else if(r==6)LowRange6=v;  else if(r==5)LowRange5=v;  else if(r==4)LowRange4=v;  else if(r==3)LowRange3=v;  else if(r==2)LowRange2=v;  else LowRange1=v;  }

//+------------------------------------------------------------------+
//| GetTimeRange                                                     |
//+------------------------------------------------------------------+
int GetTimeRange(long time) {
  MqlDateTime dt; TimeToStruct(time, dt);
  int cur = 3600*dt.hour + 60*dt.min + dt.sec;

  int s1=3600*TimeStart+60*TimeStartMinute,   e1=3600*TimeStop+60*TimeStopMinute;
  int s2=3600*TimeStart2+60*TimeStartMinute2, e2=3600*TimeStop2+60*TimeStopMinute2;
  int s3=3600*TimeStart3+60*TimeStartMinute3, e3=3600*TimeStop3+60*TimeStopMinute3;
  int s4=3600*TimeStart4+60*TimeStartMinute4, e4=3600*TimeStop4+60*TimeStopMinute4;
  int s5=3600*TimeStart5+60*TimeStartMinute5, e5=3600*TimeStop5+60*TimeStopMinute5;
  int s6=3600*TimeStart6+60*TimeStartMinute6, e6=3600*TimeStop6+60*TimeStopMinute6;
  int s7=3600*TimeStart7+60*TimeStartMinute7, e7=3600*TimeStop7+60*TimeStopMinute7;

  if ((e1>=s1)?(cur>=s1&&cur<e1):(cur>=s1||cur<e1)) return 1;
  if ((e2>=s2)?(cur>=s2&&cur<e2):(cur>=s2||cur<e2)) return 2;
  if ((e3>=s3)?(cur>=s3&&cur<e3):(cur>=s3||cur<e3)) return 3;
  if ((e4>=s4)?(cur>=s4&&cur<e4):(cur>=s4||cur<e4)) return 4;
  if ((e5>=s5)?(cur>=s5&&cur<e5):(cur>=s5||cur<e5)) return 5;
  if ((e6>=s6)?(cur>=s6&&cur<e6):(cur>=s6||cur<e6)) return 6;
  if ((e7>=s7)?(cur>=s7&&cur<e7):(cur>=s7||cur<e7)) return 7;
  return 0;
}

//+------------------------------------------------------------------+
//| GetMinStopDistance                                               |
//+------------------------------------------------------------------+
double GetMinStopDistance() {
  long stopsLevel   = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
  long spreadPoints = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
  double minDistance = (stopsLevel*_Point + spreadPoints*_Point) * MinDistanceMultiplier;
  if (minDistance < 0.50) minDistance = 0.50;
  return minDistance;
}

//+------------------------------------------------------------------+
//| IsBarInSpecificRange                                             |
//+------------------------------------------------------------------+
bool IsBarInSpecificRange(long barTime, int rn) {
  MqlDateTime dt; TimeToStruct(barTime, dt);
  int cur = 3600*dt.hour + 60*dt.min + dt.sec;
  int s, e;
  if      (rn==7) { s=3600*TimeStart7+60*TimeStartMinute7; e=3600*TimeStop7+60*TimeStopMinute7; }
  else if (rn==6) { s=3600*TimeStart6+60*TimeStartMinute6; e=3600*TimeStop6+60*TimeStopMinute6; }
  else if (rn==5) { s=3600*TimeStart5+60*TimeStartMinute5; e=3600*TimeStop5+60*TimeStopMinute5; }
  else if (rn==4) { s=3600*TimeStart4+60*TimeStartMinute4; e=3600*TimeStop4+60*TimeStopMinute4; }
  else if (rn==3) { s=3600*TimeStart3+60*TimeStartMinute3; e=3600*TimeStop3+60*TimeStopMinute3; }
  else if (rn==2) { s=3600*TimeStart2+60*TimeStartMinute2; e=3600*TimeStop2+60*TimeStopMinute2; }
  else            { s=3600*TimeStart +60*TimeStartMinute;  e=3600*TimeStop +60*TimeStopMinute;  }
  return (e>=s) ? (cur>=s && cur<e) : (cur>=s || cur<e);
}

//+------------------------------------------------------------------+
//| GetRangeForTime                                                  |
//+------------------------------------------------------------------+
void GetRangeForTime(int rn, double &hi, double &lo) {
  hi=0; lo=0;
  for (int i=1; i<1000; i++) {
    long ti = iTime(_Symbol, PERIOD_H1, i);
    if (IsBarInSpecificRange(ti, rn)) {
      for (int k=i; k<1000; k++) {
        long tk = iTime(_Symbol, PERIOD_H1, k);
        if (IsBarInSpecificRange(tk, rn)) {
          double hk=iHigh(_Symbol,PERIOD_H1,k), lk=iLow(_Symbol,PERIOD_H1,k);
          if (hk>hi||hi<=0) hi=hk;
          if (lk<lo||lo<=0) lo=lk;
        } else break;
      }
      break;
    }
  }
}

//+------------------------------------------------------------------+
//| IsGoodTimeForRange                                               |
//+------------------------------------------------------------------+
bool IsGoodTimeForRange(int r) {
  int e;
  if      (r==7) e=3600*TimeStop7+60*TimeStopMinute7;
  else if (r==6) e=3600*TimeStop6+60*TimeStopMinute6;
  else if (r==5) e=3600*TimeStop5+60*TimeStopMinute5;
  else if (r==4) e=3600*TimeStop4+60*TimeStopMinute4;
  else if (r==3) e=3600*TimeStop3+60*TimeStopMinute3;
  else if (r==2) e=3600*TimeStop2+60*TimeStopMinute2;
  else           e=3600*TimeStop +60*TimeStopMinute;
  MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
  return (3600*dt.hour+60*dt.min+dt.sec >= e);
}

//+------------------------------------------------------------------+
//| Bank Holiday Filter                                              |
//+------------------------------------------------------------------+
bool IsHoliday() {
  string today = TimeToString(TimeCurrent(), TIME_DATE);
  if (IgnoreDates != "") {
    string dates[]; StringSplit(IgnoreDates, ',', dates);
    for (int i=0; i<ArraySize(dates); i++) {
      string d=dates[i]; StringTrimLeft(d); StringTrimRight(d);
      if (d==today) return true;
    }
  }
  string h1="2023.01.01,2024.01.01,2025.01.01,2026.01.01,2027.01.01,2028.01.01,2029.01.01,2030.01.01";
  string h2="2023.04.07,2024.03.29,2025.04.18,2026.04.03,2027.03.26,2028.04.14,2029.03.30,2030.04.19";
  string h3="2023.07.04,2024.07.04,2025.07.04,2026.07.04,2027.07.04,2028.07.04,2029.07.04,2030.07.04";
  string h4="2023.12.25,2024.12.25,2025.12.25,2026.12.25,2027.12.25,2028.12.25,2029.12.25,2030.12.25";
  string h5="2023.12.26,2024.12.26,2025.12.26,2026.12.26,2027.12.26,2028.12.26,2029.12.26,2030.12.26";
  string s1="2023.01.16,2024.01.15,2025.01.20,2026.01.19,2027.01.18,2028.01.17,2029.01.15,2030.01.21";
  string s2="2023.02.20,2024.02.19,2025.02.17,2026.02.16,2027.02.15,2028.02.21,2029.02.19,2030.02.18";
  string s3="2023.04.10,2024.04.01,2025.04.21,2026.04.06,2027.03.29,2028.04.17,2029.04.02,2030.04.22";
  string s4="2023.05.01,2024.05.01,2025.05.01,2026.05.01,2027.05.01,2028.05.01,2029.05.01,2030.05.01";
  string s5="2023.05.29,2024.05.27,2025.05.26,2026.05.25,2027.05.31,2028.05.29,2029.05.28,2030.05.27";
  string s6="2023.09.04,2024.09.02,2025.09.01,2026.09.07,2027.09.06,2028.09.04,2029.09.03,2030.09.02";
  string s7="2023.11.23,2024.11.28,2025.11.27,2026.11.26,2027.11.25,2028.11.23,2029.11.22,2030.11.28";
  if (StringFind(h1,today)>=0) return true;
  if (StringFind(h2,today)>=0) return true;
  if (StringFind(h3,today)>=0) return true;
  if (StringFind(h4,today)>=0) return true;
  if (StringFind(h5,today)>=0) return true;
  if (StringFind(s1,today)>=0) return true;
  if (StringFind(s2,today)>=0) return true;
  if (StringFind(s3,today)>=0) return true;
  if (StringFind(s4,today)>=0) return true;
  if (StringFind(s5,today)>=0) return true;
  if (StringFind(s6,today)>=0) return true;
  if (StringFind(s7,today)>=0) return true;
  return false;
}

//+------------------------------------------------------------------+
//| IsTradeTodayForRange                                             |
//+------------------------------------------------------------------+
bool IsTradeTodayForRange(int range) {
  HistorySelect(iTime(_Symbol, PERIOD_D1, 0), TimeCurrent());
  int magic = GetMagicNumber(range);
  for (int i=HistoryDealsTotal()-1; i>=0; i--) {
    ulong t=HistoryDealGetTicket(i);
    if (HistoryDealGetInteger(t,DEAL_MAGIC)==magic && HistoryDealGetString(t,DEAL_SYMBOL)==_Symbol)
      return true;
  }
  return false;
}

//+------------------------------------------------------------------+
//| LotSizeCal                                                       |
//+------------------------------------------------------------------+
double LotSizeCal(double PointSL) {
  double lost   = 0.01*RiskPercent*AccountInfoDouble(ACCOUNT_BALANCE);
  double minVol = SymbolInfoDouble(NULL, SYMBOL_VOLUME_MIN);
  double maxVol = SymbolInfoDouble(NULL, SYMBOL_VOLUME_MAX);
  double lpl    = (PointSL/_Point)*SymbolInfoDouble(NULL, SYMBOL_TRADE_TICK_VALUE);
  if (lpl==0) return minVol;
  double lot = NormalizeDouble(lost/lpl, lotdigit);
  if (lot<minVol) lot=minVol;
  if (lot>maxVol) lot=maxVol;
  return lot;
}

//+------------------------------------------------------------------+
//| DeletePrimaryOrderForRange                                       |
//+------------------------------------------------------------------+
void DeletePrimaryOrderForRange(int range, const ENUM_ORDER_TYPE type) {
  int magic = GetMagicNumber(range);
  for (int i=OrdersTotal()-1; i>=0; i--) {
    ulong t=OrderGetTicket(i);
    if (OrderSelect(t) && OrderGetInteger(ORDER_MAGIC)==magic &&
        OrderGetString(ORDER_SYMBOL)==_Symbol && OrderGetInteger(ORDER_TYPE)==type) {
      string cm[]; int k=StringSplit(OrderGetString(ORDER_COMMENT),StringGetCharacter("_",0),cm);
      if (k>=2 && (int)StringToInteger(cm[1])==1) { trade.OrderDelete(t); Print("MR4: R",range," - Deleted primary ",t); }
    }
  }
}

//+------------------------------------------------------------------+
//| DeleteHedgeOrderForRange                                         |
//+------------------------------------------------------------------+
void DeleteHedgeOrderForRange(int range, const ENUM_ORDER_TYPE type) {
  int magic = GetMagicNumber(range);
  for (int i=OrdersTotal()-1; i>=0; i--) {
    ulong t=OrderGetTicket(i);
    if (OrderSelect(t) && OrderGetInteger(ORDER_MAGIC)==magic &&
        OrderGetString(ORDER_SYMBOL)==_Symbol && OrderGetInteger(ORDER_TYPE)==type) {
      string cm[]; int k=StringSplit(OrderGetString(ORDER_COMMENT),StringGetCharacter("_",0),cm);
      if (k>=2 && (int)StringToInteger(cm[1])==2) trade.OrderDelete(t);
    }
  }
}

//+------------------------------------------------------------------+
//| GetTradeInfoForRange                                             |
//+------------------------------------------------------------------+
void GetTradeInfoForRange(int range, int &oBuy, int &oSell, int &hBuy, int &hSell, int &pBuy, int &pSell) {
  oBuy=0; oSell=0; hBuy=0; hSell=0; pBuy=0; pSell=0;
  int magic = GetMagicNumber(range);

  for (int i=OrdersTotal()-1; i>=0; i--) {
    if (OrderSelect(OrderGetTicket(i)) && OrderGetInteger(ORDER_MAGIC)==magic && OrderGetString(ORDER_SYMBOL)==_Symbol) {
      string cm[]; int k=StringSplit(OrderGetString(ORDER_COMMENT),StringGetCharacter("_",0),cm);
      if (k>=2) {
        int num=(int)StringToInteger(cm[1]); long type=OrderGetInteger(ORDER_TYPE);
        if (num==1) { if(type==ORDER_TYPE_BUY_STOP) pBuy++; else if(type==ORDER_TYPE_SELL_STOP) pSell++; }
        if (num==2) { if(type==ORDER_TYPE_BUY_STOP) hBuy++; else if(type==ORDER_TYPE_SELL_STOP) hSell++; }
      }
    }
  }
  for (int i=PositionsTotal()-1; i>=0; i--) {
    if (PositionSelectByTicket(PositionGetTicket(i)) && PositionGetInteger(POSITION_MAGIC)==magic && PositionGetString(POSITION_SYMBOL)==_Symbol) {
      string cm[]; int k=StringSplit(PositionGetString(POSITION_COMMENT),StringGetCharacter("_",0),cm);
      if (k>=2 && (int)StringToInteger(cm[1])==1) {
        if (PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY)  oBuy++;
        else if (PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_SELL) oSell++;
      }
    }
  }
}

//+------------------------------------------------------------------+
//| GetActualPositionSL - slippage-safe                             |
//+------------------------------------------------------------------+
double GetActualPositionSL(long magic, ENUM_POSITION_TYPE posType) {
  for (int j=PositionsTotal()-1; j>=0; j--) {
    if (PositionSelectByTicket(PositionGetTicket(j))) {
      if (PositionGetInteger(POSITION_MAGIC)==magic &&
          PositionGetString(POSITION_SYMBOL)==_Symbol &&
          PositionGetInteger(POSITION_TYPE) ==posType &&
          StringFind(PositionGetString(POSITION_COMMENT),"_1_")>=0)
        return PositionGetDouble(POSITION_SL);
    }
  }
  return 0;
}

//+------------------------------------------------------------------+
//| ExecuteMarketBuy                                                 |
//+------------------------------------------------------------------+
void ExecuteMarketBuy(double price, string comment, int range, double highRange) {
  double BuySL  = NormalizeDouble(price - GetStopLossFB(range), _Digits);
  double BuyTP  = NormalizeDouble(highRange + GetTakeProfitFB(range), _Digits);
  double BuyLot = (RiskMode==RISK_PERCENT) ? LotSizeCal(MathAbs(price-BuySL)) : LotSize;

  trade.SetExpertMagicNumber(GetMagicNumber(range));
  if (trade.Buy(BuyLot, NULL, price, BuySL, BuyTP, comment)) {
    SetTradeTaken(range, true);
    DeletePrimaryOrderForRange(range, ORDER_TYPE_SELL_STOP);
    double actualSL   = GetActualPositionSL(GetMagicNumber(range), POSITION_TYPE_BUY);
    double HedgeEntry = (actualSL > 0) ? actualSL : BuySL;
    double HedgeSL    = NormalizeDouble(price, _Digits);
    double HedgeLot   = NormalizeDouble(GetMultiplier(range) * BuyLot, lotdigit);
    double HedgeTP    = NormalizeDouble(HedgeEntry - GetTakeProfitST(range), _Digits);
    string CMHedge    = comm + "_2_R" + IntegerToString(range) + "_";
    trade.SellStop(HedgeLot, HedgeEntry, NULL, HedgeSL, HedgeTP, ORDER_TIME_GTC, 0, CMHedge);
    Print("MR4: R",range," - Market Buy, Hedge SellStop @ ",HedgeEntry," (actual SL)");
  }
}

//+------------------------------------------------------------------+
//| ExecuteMarketSell                                                |
//+------------------------------------------------------------------+
void ExecuteMarketSell(double price, string comment, int range, double lowRange) {
  double SellSL  = NormalizeDouble(price + GetStopLossFS(range), _Digits);
  double SellTP  = NormalizeDouble(price - GetTakeProfitFS(range), _Digits);
  double SellLot = (RiskMode==RISK_PERCENT) ? LotSizeCal(MathAbs(price-SellSL)) : LotSize;

  trade.SetExpertMagicNumber(GetMagicNumber(range));
  if (trade.Sell(SellLot, NULL, price, SellSL, SellTP, comment)) {
    SetTradeTaken(range, true);
    DeletePrimaryOrderForRange(range, ORDER_TYPE_BUY_STOP);
    double actualSL   = GetActualPositionSL(GetMagicNumber(range), POSITION_TYPE_SELL);
    double HedgeEntry = (actualSL > 0) ? actualSL : SellSL;
    double HedgeSL    = NormalizeDouble(price, _Digits);
    double HedgeLot   = NormalizeDouble(GetMultiplier(range) * SellLot, lotdigit);
    double HedgeTP    = NormalizeDouble(HedgeEntry + GetTakeProfitST(range), _Digits);
    string CMHedge    = comm + "_2_R" + IntegerToString(range) + "_";
    trade.BuyStop(HedgeLot, HedgeEntry, NULL, HedgeSL, HedgeTP, ORDER_TIME_GTC, 0, CMHedge);
    Print("MR4: R",range," - Market Sell, Hedge BuyStop @ ",HedgeEntry," (actual SL)");
  }
}

//+------------------------------------------------------------------+
//| ProcessRangeLogic                                                |
//+------------------------------------------------------------------+
void ProcessRangeLogic(int range, double highRange, double lowRange, double askPrice, double bidPrice, double minDistance) {
  double BuyStopEntry  = NormalizeDouble(highRange + GetBuffer(range), _Digits);
  double SellStopEntry = NormalizeDouble(lowRange, _Digits);
  string CMPrimary     = comm + "_1_R" + IntegerToString(range) + "_";

  //=== BUY SIDE ===
  if (!GetBuyPending(range) && !GetTradeTaken(range)) {
    double dist = BuyStopEntry - askPrice;
    if (askPrice >= BuyStopEntry) {
      Print("MR4: R",range," - Price above Buy level - MARKET EXECUTION");
      ExecuteMarketBuy(askPrice, CMPrimary, range, highRange);
    }
    else if (dist < minDistance && dist > 0) {
      Print("MR4: R",range," - Buy too close (",DoubleToString(dist,2)," < ",DoubleToString(minDistance,2),") - monitoring");
    }
    else if (dist >= minDistance) {
      double BuySL  = NormalizeDouble(BuyStopEntry - GetStopLossFB(range), _Digits);
      double BuyTP  = NormalizeDouble(highRange + GetTakeProfitFB(range), _Digits);
      double BuyLot = (RiskMode==RISK_PERCENT) ? LotSizeCal(MathAbs(BuyStopEntry-BuySL)) : LotSize;
      trade.SetExpertMagicNumber(GetMagicNumber(range));
      if (trade.BuyStop(BuyLot, BuyStopEntry, NULL, BuySL, BuyTP, ORDER_TIME_DAY, 0, CMPrimary)) {
        SetBuyPending(range, true);
        Print("MR4: R",range," - BuyStop @ ",BuyStopEntry);
      }
    }
  }

  //=== SELL SIDE ===
  if (!GetSellPending(range) && !GetTradeTaken(range)) {
    double dist = bidPrice - SellStopEntry;
    if (bidPrice <= SellStopEntry) {
      Print("MR4: R",range," - Price below Sell level - MARKET EXECUTION");
      ExecuteMarketSell(bidPrice, CMPrimary, range, lowRange);
    }
    else if (dist < minDistance && dist > 0) {
      Print("MR4: R",range," - Sell too close (",DoubleToString(dist,2)," < ",DoubleToString(minDistance,2),") - monitoring");
    }
    else if (dist >= minDistance) {
      double SellSL  = NormalizeDouble(SellStopEntry + GetStopLossFS(range), _Digits);
      double SellTP  = NormalizeDouble(SellStopEntry - GetTakeProfitFS(range), _Digits);
      double SellLot = (RiskMode==RISK_PERCENT) ? LotSizeCal(MathAbs(SellStopEntry-SellSL)) : LotSize;
      trade.SetExpertMagicNumber(GetMagicNumber(range));
      if (trade.SellStop(SellLot, SellStopEntry, NULL, SellSL, SellTP, ORDER_TIME_DAY, 0, CMPrimary)) {
        SetSellPending(range, true);
        Print("MR4: R",range," - SellStop @ ",SellStopEntry);
      }
    }
  }
}

//+------------------------------------------------------------------+
//| ProcessRangeIndependent                                          |
//+------------------------------------------------------------------+
void ProcessRangeIndependent(int range) {
  if (range==1 && !Range1Enabled) return;
  if (range==2 && !Range2Enabled) return;
  if (range==3 && !Range3Enabled) return;
  if (range==4 && !Range4Enabled) return;
  if (range==5 && !Range5Enabled) return;
  if (range==6 && !Range6Enabled) return;
  if (range==7 && !Range7Enabled) return;

  int oBuy, oSell, hBuy, hSell, pBuy, pSell;
  GetTradeInfoForRange(range, oBuy, oSell, hBuy, hSell, pBuy, pSell);

  if (oBuy <=0 && hSell>0) DeleteHedgeOrderForRange(range, ORDER_TYPE_SELL_STOP);
  if (oSell<=0 && hBuy >0) DeleteHedgeOrderForRange(range, ORDER_TYPE_BUY_STOP);

  SetBuyPending (range, pBuy  > 0);
  SetSellPending(range, pSell > 0);

  if (GetTradeTaken(range) || oBuy>0 || oSell>0) return;
  if (IsLicenceExpired())          return;
  if (IsTradeTodayForRange(range)) { SetTradeTaken(range, true); return; }
  if (IsHoliday())                 return;
  if (!IsGoodTimeForRange(range))  return;

  if (GetHighRange(range)<=0 || GetLowRange(range)<=0) {
    double hr=0, lr=0;
    GetRangeForTime(range, hr, lr);
    SetHighRange(range, hr); SetLowRange(range, lr);
    if (hr<=0||lr<=0) return;
  }

  double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
  double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);
  double minD=GetMinStopDistance();

  ProcessRangeLogic(range, GetHighRange(range), GetLowRange(range), ask, bid, minD);
}

//+------------------------------------------------------------------+
//| OnTick                                                           |
//+------------------------------------------------------------------+
void OnTick() {
  MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
  static int lastDay = -1;
  if (dt.day_of_year != lastDay) {
    lastDay = dt.day_of_year;
    PendingOrdersPlaced1=false; BuyPendingActive1=false; SellPendingActive1=false; TradeTakenToday1=false; HighRange1=0; LowRange1=0;
    PendingOrdersPlaced2=false; BuyPendingActive2=false; SellPendingActive2=false; TradeTakenToday2=false; HighRange2=0; LowRange2=0;
    PendingOrdersPlaced3=false; BuyPendingActive3=false; SellPendingActive3=false; TradeTakenToday3=false; HighRange3=0; LowRange3=0;
    PendingOrdersPlaced4=false; BuyPendingActive4=false; SellPendingActive4=false; TradeTakenToday4=false; HighRange4=0; LowRange4=0;
    PendingOrdersPlaced5=false; BuyPendingActive5=false; SellPendingActive5=false; TradeTakenToday5=false; HighRange5=0; LowRange5=0;
    PendingOrdersPlaced6=false; BuyPendingActive6=false; SellPendingActive6=false; TradeTakenToday6=false; HighRange6=0; LowRange6=0;
    PendingOrdersPlaced7=false; BuyPendingActive7=false; SellPendingActive7=false; TradeTakenToday7=false; HighRange7=0; LowRange7=0;
  }

  ProcessRangeIndependent(1);
  ProcessRangeIndependent(2);
  ProcessRangeIndependent(3);
  ProcessRangeIndependent(4);
  ProcessRangeIndependent(5);
  ProcessRangeIndependent(6);
  ProcessRangeIndependent(7);
}

//+------------------------------------------------------------------+
//| OnTradeTransaction                                               |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result) {

  if (trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
  ulong dealTicket = trans.deal;
  if (!HistoryDealSelect(dealTicket)) return;

  long   dealMagic   = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
  string dealSymbol  = HistoryDealGetString (dealTicket, DEAL_SYMBOL);
  string dealComment = HistoryDealGetString (dealTicket, DEAL_COMMENT);
  long   dealType    = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
  long   dealEntry   = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
  double dealVolume  = HistoryDealGetDouble (dealTicket, DEAL_VOLUME);
  double dealPrice   = HistoryDealGetDouble (dealTicket, DEAL_PRICE);

  bool belongsToEA = (dealMagic==MagicNumber1||dealMagic==MagicNumber2||dealMagic==MagicNumber3||dealMagic==MagicNumber4||dealMagic==MagicNumber5||dealMagic==MagicNumber6||dealMagic==MagicNumber7);
  if (!belongsToEA || dealSymbol!=_Symbol || dealEntry!=DEAL_ENTRY_IN) return;

  int range = (dealMagic==MagicNumber7)?7:(dealMagic==MagicNumber6)?6:(dealMagic==MagicNumber5)?5:(dealMagic==MagicNumber4)?4:(dealMagic==MagicNumber3)?3:(dealMagic==MagicNumber2)?2:1;

  if (StringFind(dealComment, "_1_") >= 0) {
    SetTradeTaken(range, true);

    // Primary BUY filled
    if (dealType == DEAL_TYPE_BUY) {
      Print("MR4: R",range," - BuyStop filled @ ",dealPrice);
      DeletePrimaryOrderForRange(range, ORDER_TYPE_SELL_STOP);
      double actualSL   = GetActualPositionSL(dealMagic, POSITION_TYPE_BUY);
      double HedgeEntry = (actualSL>0) ? actualSL : NormalizeDouble(dealPrice-GetStopLossFB(range),_Digits);
      double HedgeSL    = NormalizeDouble(dealPrice, _Digits);
      double HedgeLot   = NormalizeDouble(GetMultiplier(range)*dealVolume, lotdigit);
      double HedgeTP    = NormalizeDouble(HedgeEntry-GetTakeProfitST(range), _Digits);
      string CMHedge    = comm+"_2_R"+IntegerToString(range)+"_";
      trade.SetExpertMagicNumber(GetMagicNumber(range));
      trade.SellStop(HedgeLot, HedgeEntry, NULL, HedgeSL, HedgeTP, ORDER_TIME_GTC, 0, CMHedge);
      Print("MR4: R",range," - Hedge SellStop @ ",HedgeEntry," (actual SL)");
    }
    // Primary SELL filled
    else if (dealType == DEAL_TYPE_SELL) {
      Print("MR4: R",range," - SellStop filled @ ",dealPrice);
      DeletePrimaryOrderForRange(range, ORDER_TYPE_BUY_STOP);
      double actualSL   = GetActualPositionSL(dealMagic, POSITION_TYPE_SELL);
      double HedgeEntry = (actualSL>0) ? actualSL : NormalizeDouble(dealPrice+GetStopLossFS(range),_Digits);
      double HedgeSL    = NormalizeDouble(dealPrice, _Digits);
      double HedgeLot   = NormalizeDouble(GetMultiplier(range)*dealVolume, lotdigit);
      double HedgeTP    = NormalizeDouble(HedgeEntry+GetTakeProfitST(range), _Digits);
      string CMHedge    = comm+"_2_R"+IntegerToString(range)+"_";
      trade.SetExpertMagicNumber(GetMagicNumber(range));
      trade.BuyStop(HedgeLot, HedgeEntry, NULL, HedgeSL, HedgeTP, ORDER_TIME_GTC, 0, CMHedge);
      Print("MR4: R",range," - Hedge BuyStop @ ",HedgeEntry," (actual SL)");
    }
  }
}

//+------------------------------------------------------------------+