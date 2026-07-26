//+------------------------------------------------------------------+
//|                                                   VisionFX_EA.mq5|
//|                                                 VisionFX Academy |
//|                                       https://visionfxacademy.com|
//+------------------------------------------------------------------+
#property copyright "VisionFX Academy"
#property link      "https://visionfxacademy.com"
#property version   "1.00"
#property description "Professional Range Breakout EA with Hedges"

/////////////////////////////////////////////////////////////////////////
// LICENSING & PROTECTION
// Set ExpiredON to false to disable expiry
bool ExpiredON=false; 
datetime ExpiredTime=D'2050.2.5 23:59:59';
// Set AccountProtectON to false to allow on any account
bool AccountProtectON=false; 
const long allowed_accounts[]=
  {
   5112157,50156064,125729100
  };
/////////////////////////////////////////////////////////////////////////

#include <Trade\Trade.mqh>
CTrade trade;

enum EnumRiskMode {
   FIXED_LOT,    // Fixed Lotsize
   RISK_PERCENT  // Risk percent
};

enum EnumTPSLMode {
   MODE_PRICE_POINTS,  // Price Points (e.g., $11.8 for Gold)
   MODE_PIPS           // Pips (e.g., 118 pips)
};

input string BS="---------BASIC SETTING---------";
input EnumRiskMode RiskMode=FIXED_LOT;     // Lotsize Mode
input double LotSize=0.05;                 // Fixed Lot Size
input double RiskPercent=1.0;              // Risk Percent (%)
input EnumTPSLMode TPSLMode=MODE_PRICE_POINTS; // TP/SL/Buffer Mode
input int MagicNumber=20250526;           // Magic Number
input string comm="VisionFX - GoldBot";   // Trade Comment base

input string TM="---------TIME SETTING---------";
input int TimeStart=7;                    // Range Start Hour (e.g. 7 AM)
input int TimeStop=10;                    // Range Stop Hour (e.g. 10 AM)

input string FB="---------FIRST BUY SETTING---------";
input double StopLossFB=11.8;             // Maximum Stop Loss (Price Points or Pips)
input double TakeProfitFB=2.8;            // Take Profit (Price Points or Pips)
input double BufferBuy=0.16;              // Buy Buffer (Price Points or Pips)

input string FS="---------FIRST SELL SETTING---------";
input double StopLossFS=12.0;             // Maximum Stop Loss (Price Points or Pips)
input double TakeProfitFS=1.7;            // Take Profit (Price Points or Pips)
input double BufferSell=0.0;              // Sell Buffer (Price Points or Pips)

input string ST="---------SECOND TRADE SETTING---------";
input double Multiplier=3.0;              // Lotsize Multiplier for Hedge
input double TakeProfitST=4.0;            // Take Profit (Price Points or Pips)

int lotdigit=3;
bool StartTrade=false;
double PipMultiplier=1.0; // Calculated in OnInit based on symbol
int LastTradeDay=-1; // Track the last day we checked for trades

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   bool IsAccount=false;
   bool IsExpired=false;
   
   long account=AccountInfoInteger(ACCOUNT_LOGIN);
   
   // Check Account Protection
   if(AccountProtectON) {
      for(int i=0; i<ArraySize(allowed_accounts); i++) {
         if(account==allowed_accounts[i]) {
            IsAccount=true;
            Print("VisionFX: Account verified.");
            break;
         }
      }
   } else {
      IsAccount=true;
   }
   
   // Check Expiry
   if(TimeCurrent() <= ExpiredTime) IsExpired=false;
   else IsExpired=true;
   
   if(ExpiredON && IsExpired) {
      Print("VisionFX: EA has expired.");
      return(INIT_FAILED);
   }
   
   if(AccountProtectON && !IsAccount) {
      Print("VisionFX: Unauthorized account.");
      return(INIT_FAILED);
   }

   trade.SetExpertMagicNumber(MagicNumber);
   
   // Calculate pip multiplier for the current symbol
   CalculatePipMultiplier();
   
   // Determine Lot Digits
   double min_volume=SymbolInfoDouble(NULL,SYMBOL_VOLUME_MIN);
   if(min_volume>=0.01) lotdigit=2;
   if(min_volume>=0.1)  lotdigit=1;
   if(min_volume>=1.0)  lotdigit=0;
   
   // Validate Inputs
   if(!ValidateInputs()) {
      return(INIT_PARAMETERS_INCORRECT);
   }
   
   // Print startup configuration report
   PrintStartupReport();

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   int OriginBuy,OriginSell,HedgeOrderBuy,HedgeOrderSell;
   GetTradeInfo(OriginBuy,OriginSell,HedgeOrderBuy,HedgeOrderSell);
   
   // Cleanup stray hedge orders if primary position is closed
   if(OriginBuy<=0 && HedgeOrderSell>0) DeleteHedgeOrder(ORDER_TYPE_SELL_STOP);
   if(OriginSell<=0 && HedgeOrderBuy>0) DeleteHedgeOrder(ORDER_TYPE_BUY_STOP);

   // Check if it's a new trading day and reset flag
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(),dt);
   int currentDay = dt.day_of_year;
   
   if(LastTradeDay != currentDay) {
      // New day detected, reset the trading flag
      StartTrade = false;
      LastTradeDay = currentDay;
      Print("VisionFX: New trading day detected. StartTrade reset to false.");
   }
   
   // Check if it's time to start monitoring range breakout
   if(!StartTrade) {
      if(dt.hour == TimeStop) {
         StartTrade=true;
         Print("VisionFX: Range session ended at ", TimeStop, ":00. Monitoring for breakouts...");
      }
   }

   // Trading Logic
   if(StartTrade) {
      if(!IsTradeToday()) {
         if(IsGoodTime()) {
            double HighRange,LowRange;
            GetRange(HighRange,LowRange);
            
            if(HighRange>0 && LowRange>0) {
               double AskPrice=NormalizeDouble(SymbolInfoDouble(_Symbol,SYMBOL_ASK),_Digits);
               double BidPrice=NormalizeDouble(SymbolInfoDouble(_Symbol,SYMBOL_BID),_Digits);
               string CM=comm+"_1_";
               
               // Buy Condition: Breakout above HighRange + Buffer
               double BuyBufferPrice = ConvertToPrice(BufferBuy);
               if(AskPrice >= HighRange + BuyBufferPrice) {
                  double BuySL=AskPrice - ConvertToPrice(StopLossFB);
                  double BuyTP=HighRange + ConvertToPrice(TakeProfitFB);
                  double BuyLot=LotSize;
                  
                  if(RiskMode==RISK_PERCENT) {
                     BuyLot=LotSizeCal(MathAbs(AskPrice-BuySL));
                  }
                  
                  BuySL=NormalizeDouble(BuySL,_Digits);
                  BuyTP=NormalizeDouble(BuyTP,_Digits);
                  
                  bool result=trade.Buy(BuyLot,NULL,AskPrice,BuySL,BuyTP,CM);
                  
                  if(result) {
                     // Place Hedge Order (Sell Stop at Buy SL)
                     double HedgeEntry=BuySL;
                     double HedgeSL=AskPrice;
                     double HedgeLot=NormalizeDouble(Multiplier*BuyLot,lotdigit);
                     double HedgeTP=HedgeEntry-ConvertToPrice(TakeProfitST);
                     HedgeTP=NormalizeDouble(HedgeTP,_Digits);
                     string CMHedge=comm+"_2_";
                     trade.SellStop(HedgeLot,HedgeEntry,NULL,HedgeSL,HedgeTP,ORDER_TIME_GTC,0,CMHedge);
                  }
               }
               
               // Sell Condition: Breakout below LowRange (with optional buffer)
               double SellBufferPrice = ConvertToPrice(BufferSell);
               if(BidPrice <= LowRange - SellBufferPrice) {
                  double SellPrice=BidPrice;
                  double SellSL=BidPrice + ConvertToPrice(StopLossFS);
                  double SellTP=SellPrice - ConvertToPrice(TakeProfitFS);
                  double SellLot=LotSize;
                  
                  if(RiskMode==RISK_PERCENT) {
                     SellLot=LotSizeCal(MathAbs(SellPrice-SellSL));
                  }
                  
                  SellSL=NormalizeDouble(SellSL,_Digits);
                  SellTP=NormalizeDouble(SellTP,_Digits);
                  
                  bool result=trade.Sell(SellLot,NULL,BidPrice,SellSL,SellTP,CM);
                  
                  if(result) {
                     // Place Hedge Order (Buy Stop at Sell SL)
                     double HedgeEntry=SellSL;
                     double HedgeSL=BidPrice;
                     double HedgeLot=NormalizeDouble(Multiplier*SellLot,lotdigit);
                     double HedgeTP=HedgeEntry+ConvertToPrice(TakeProfitST);
                     HedgeTP=NormalizeDouble(HedgeTP,_Digits);
                     string CMHedge=comm+"_2_";
                     trade.BuyStop(HedgeLot,HedgeEntry,NULL,HedgeSL,HedgeTP,ORDER_TIME_GTC,0,CMHedge);
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
void GetTradeInfo(int &originBuy,int &originSell,int &hedgeOrderBuy,int &hedgeOrderSell)
{
   originBuy=0; originSell=0; hedgeOrderBuy=0; hedgeOrderSell=0;
   
   // Scan Pending Orders
   for(int i=OrdersTotal()-1; i>=0; i--) {
      if(OrderSelect(OrderGetTicket(i))) {
         if(OrderGetInteger(ORDER_MAGIC)==MagicNumber && OrderGetString(ORDER_SYMBOL)==_Symbol) {
            string CmAnaly[];
            int k=StringSplit(OrderGetString(ORDER_COMMENT),StringGetCharacter("_",0),CmAnaly);
            if(k>=2 && (int)CmAnaly[1]==2) {
               if(OrderGetInteger(ORDER_TYPE)==ORDER_TYPE_BUY_STOP) hedgeOrderBuy++;
               else if(OrderGetInteger(ORDER_TYPE)==ORDER_TYPE_SELL_STOP) hedgeOrderSell++;
            }
         }
      }
   }
   
   // Scan Open Positions
   for(int i=PositionsTotal()-1; i>=0; i--) {
      if(PositionSelectByTicket(PositionGetTicket(i))) {
         if(PositionGetInteger(POSITION_MAGIC)==MagicNumber && PositionGetString(POSITION_SYMBOL)==_Symbol) {
            string CmAnaly[];
            int k=StringSplit(PositionGetString(POSITION_COMMENT),StringGetCharacter("_",0),CmAnaly);
            if(k>=2 && (int)CmAnaly[1]==1) {
               if(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY) originBuy++;
               else if(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_SELL) originSell++;
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Calculate the High/Low range for specified hours                 |
//+------------------------------------------------------------------+
void GetRange(double &aboverange,double &belowrange)
{
   aboverange=0; belowrange=0;
   for(int i=1; i<1000; i++) {
      long timei=iTime(_Symbol,PERIOD_H1,i);
      if(IsTimeRange(timei)) {
         for(int k=i; k<1000; k++) {
            long timek=iTime(_Symbol,PERIOD_H1,k);
            if(IsTimeRange(timek)) {
               double highk=iHigh(_Symbol,PERIOD_H1,k);
               double lowk=iLow(_Symbol,PERIOD_H1,k);
               if(highk > aboverange || aboverange<=0) aboverange=highk;
               if(lowk < belowrange || belowrange<=0)   belowrange=lowk;
            } else break;
         }
         break;
      }
   }
}

//+------------------------------------------------------------------+
//| Check if a timestamp falls within the Range hours               |
//+------------------------------------------------------------------+
bool IsTimeRange(long time)
{
   int startSecs=3600*TimeStart;
   int stopSecs=3600*TimeStop;
   MqlDateTime dt;
   TimeToStruct(time,dt);
   int curSecs=3600*dt.hour + 60*dt.min + dt.sec;
   
   if(TimeStop >= TimeStart) return(curSecs >= startSecs && curSecs < stopSecs);
   else return(curSecs >= startSecs || curSecs < stopSecs);
}

//+------------------------------------------------------------------+
//| Check if current time is after the range definition period       |
//+------------------------------------------------------------------+
bool IsGoodTime()
{
   int stopSecs=3600*TimeStop;
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(),dt);
   int curSecs=3600*dt.hour + 60*dt.min + dt.sec;
   return(curSecs >= stopSecs);
}

//+------------------------------------------------------------------+
//| Check if a trade has already occurred today                      |
//+------------------------------------------------------------------+
bool IsTradeToday()
{
   HistorySelect(iTime(_Symbol,PERIOD_D1,0),TimeCurrent());
   for(int i=HistoryDealsTotal()-1; i>=0; i--) {
      ulong Ticket=HistoryDealGetTicket(i);
      if(HistoryDealGetInteger(Ticket,DEAL_MAGIC)==MagicNumber && HistoryDealGetString(Ticket,DEAL_SYMBOL)==_Symbol) {
         return(true);
      }
   }
   return(false);
}

//+------------------------------------------------------------------+
//| Delete all pending orders for this EA                            |
//+------------------------------------------------------------------+
void DeleteOrder()
{
   for(int i=OrdersTotal()-1; i>=0; i--) {
      ulong Ticket=OrderGetTicket(i);
      if(OrderGetInteger(ORDER_MAGIC)==MagicNumber && OrderGetString(ORDER_SYMBOL)==_Symbol) {
         trade.OrderDelete(Ticket);
      }
   }
}

//+------------------------------------------------------------------+
//| Calculate lot size based on risk and distance                    |
//+------------------------------------------------------------------+
double LotSizeCal(double PointSL)
{
   double lostMoney=0.01*RiskPercent*AccountInfoDouble(ACCOUNT_BALANCE);
   double min_volume=SymbolInfoDouble(NULL,SYMBOL_VOLUME_MIN);
   double max_volume=SymbolInfoDouble(NULL,SYMBOL_VOLUME_MAX);
   double LossPerLot=(PointSL/_Point)*SymbolInfoDouble(NULL,SYMBOL_TRADE_TICK_VALUE);
   
   if(LossPerLot == 0) return(min_volume);
   
   double lotsize=NormalizeDouble(lostMoney/LossPerLot,lotdigit);
   if(lotsize<min_volume) lotsize=min_volume;
   if(lotsize>max_volume) lotsize=max_volume;
   return(lotsize);
}

//+------------------------------------------------------------------+
//| Delete specific hedge orders                                     |
//+------------------------------------------------------------------+
void DeleteHedgeOrder(const ENUM_ORDER_TYPE type)
{
   for(int i=OrdersTotal()-1; i>=0; i--) {
      ulong Ticket=OrderGetTicket(i);
      if(OrderGetInteger(ORDER_MAGIC)==MagicNumber && OrderGetString(ORDER_SYMBOL)==_Symbol) {
         if(OrderGetInteger(ORDER_TYPE)==type) {
            string CmAnaly[];
            int k=StringSplit(OrderGetString(ORDER_COMMENT),StringGetCharacter("_",0),CmAnaly);
            if(k>=2 && (int)CmAnaly[1]==2) trade.OrderDelete(Ticket);
         }
      }
   }
}
//+------------------------------------------------------------------+
//| Validate user inputs                                              |
//+------------------------------------------------------------------+
bool ValidateInputs()
{
   bool valid = true;
   
   // Validate time range
   if(TimeStart < 0 || TimeStart > 23) {
      Alert("ERROR: TimeStart must be between 0 and 23 hours!");
      valid = false;
   }
   
   if(TimeStop < 0 || TimeStop > 23) {
      Alert("ERROR: TimeStop must be between 0 and 23 hours!");
      valid = false;
   }
   
   if(TimeStart == TimeStop) {
      Alert("ERROR: TimeStart and TimeStop cannot be the same!");
      valid = false;
   }
   
   // Validate lot sizes
   double min_volume = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double max_volume = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   
   if(LotSize < min_volume) {
      Alert("ERROR: Lot size (", LotSize, ") is below minimum (", min_volume, ") for ", _Symbol);
      valid = false;
   }
   
   if(LotSize > max_volume) {
      Alert("ERROR: Lot size (", LotSize, ") exceeds maximum (", max_volume, ") for ", _Symbol);
      valid = false;
   }
   
   // Validate negative values
   if(StopLossFB <= 0 || StopLossFS <= 0) {
      Alert("ERROR: Stop Loss values must be positive!");
      valid = false;
   }
   
   if(TakeProfitFB <= 0 || TakeProfitFS <= 0 || TakeProfitST <= 0) {
      Alert("ERROR: Take Profit values must be positive!");
      valid = false;
   }
   
   if(Multiplier <= 0) {
      Alert("ERROR: Multiplier must be positive!");
      valid = false;
   }
   
   if(RiskPercent <= 0 || RiskPercent > 100) {
      Alert("ERROR: Risk Percent must be between 0 and 100!");
      valid = false;
   }
   
   // Warn about high spread
   double spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) * _Point;
   if(TPSLMode == MODE_PRICE_POINTS && spread > 2.0) {
      Alert("WARNING: Current spread is high (", DoubleToString(spread, 2), "). Consider trading during lower spread hours.");
   }
   
   return valid;
}

//+------------------------------------------------------------------+
//| Print startup configuration report                                |
//+------------------------------------------------------------------+
void PrintStartupReport()
{
   Print("\n========================================");
   Print("     VisionFX EA - Startup Report");
   Print("========================================");
   Print("Symbol: ", _Symbol);
   Print("Account: ", AccountInfoInteger(ACCOUNT_LOGIN));
   Print("Balance: $", DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2));
   Print("----------------------------------------");
   Print("Mode: ", (TPSLMode==MODE_PIPS ? "PIPS" : "PRICE POINTS"));
   if(TPSLMode==MODE_PIPS) {
      Print("Pip Multiplier: ", PipMultiplier);
   }
   Print("Risk Mode: ", (RiskMode==FIXED_LOT ? "FIXED LOT" : "RISK PERCENT"));
   if(RiskMode==FIXED_LOT) {
      Print("Lot Size: ", LotSize);
   } else {
      Print("Risk Percent: ", RiskPercent, "%");
   }
   Print("----------------------------------------");
   Print("Trading Hours: ", TimeStart, ":00 - ", TimeStop, ":00");
   
   // Get broker's GMT offset
   datetime serverTime = TimeCurrent();
   datetime gmtTime = TimeGMT();
   int offsetSeconds = (int)(serverTime - gmtTime);
   int offsetHours = offsetSeconds / 3600;
   Print("Broker GMT Offset: GMT", (offsetHours >= 0 ? "+" : ""), offsetHours);
   
   Print("----------------------------------------");
   Print("Buy Settings:");
   Print("  Stop Loss: ", StopLossFB, (TPSLMode==MODE_PIPS ? " pips" : " points"));
   Print("  Take Profit: ", TakeProfitFB, (TPSLMode==MODE_PIPS ? " pips" : " points"));
   Print("  Buffer: ", BufferBuy, (TPSLMode==MODE_PIPS ? " pips" : " points"));
   Print("Sell Settings:");
   Print("  Stop Loss: ", StopLossFS, (TPSLMode==MODE_PIPS ? " pips" : " points"));
   Print("  Take Profit: ", TakeProfitFS, (TPSLMode==MODE_PIPS ? " pips" : " points"));
   Print("  Buffer: ", BufferSell, (TPSLMode==MODE_PIPS ? " pips" : " points"));
   Print("Hedge Settings:");
   Print("  Multiplier: ", Multiplier, "x");
   Print("  Take Profit: ", TakeProfitST, (TPSLMode==MODE_PIPS ? " pips" : " points"));
   Print("========================================\n");
}

//+------------------------------------------------------------------+
//| Calculate pip multiplier for current symbol                      |
//+------------------------------------------------------------------+
void CalculatePipMultiplier()
{
   // Get the point value for the symbol
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   
   // For most FX pairs: 1 pip = 0.0001 (4 decimal) or 0.01 (2 decimal for JPY pairs)
   // For Gold (XAUUSD): 1 pip = 0.01 (2 decimal)
   // For indices: varies
   
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   
   if(digits == 5 || digits == 3) {
      // 5-digit broker (e.g., 1.12345) or 3-digit (e.g., 123.456)
      PipMultiplier = 10.0;
   } else if(digits == 4 || digits == 2) {
      // 4-digit broker (e.g., 1.1234) or 2-digit (e.g., 123.45)
      PipMultiplier = 1.0;
   } else {
      // Default to point = pip
      PipMultiplier = 1.0;
   }
   
   Print("Symbol: ", _Symbol, " | Digits: ", digits, " | Point: ", point, " | PipMultiplier: ", PipMultiplier);
}

//+------------------------------------------------------------------+
//| Convert input value to price distance based on selected mode     |
//+------------------------------------------------------------------+
double ConvertToPrice(double inputValue)
{
   if(TPSLMode == MODE_PIPS) {
      // Convert pips to price points
      // For Gold: if input is 118 pips, and point=0.01, return 1.18
      // For EURUSD: if input is 20 pips, and point=0.00001, return 0.00020
      return inputValue * _Point * PipMultiplier;
   } else {
      // Already in price points
      return inputValue;
   }
}
//+------------------------------------------------------------------+
