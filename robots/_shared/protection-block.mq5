// ============================================================================
// COMPILE CONTRACT — paste into every robot that ships through the platform.
// The Windows daemon regex-injects per-buyer values into EXACTLY these lines
// before compiling (see autocompiler-daemon/daemon-v2.js):
//   bool AccountProtectON = ...;        -> forced to true
//   const long allowed_accounts[] = {...}; -> buyer's MT5 account
//   datetime ExpiredTime = D'...';      -> subscription expiry
// Do NOT rename these identifiers, change their spacing style, or split them
// across lines — the injection regexes must keep matching.
// ============================================================================

// --- top of file, before any #include -------------------------------------
bool ExpiredON = true;
datetime ExpiredTime = D'2050.2.5 23:59:59';
bool AccountProtectON = false;                 // daemon flips to true per job
const long allowed_accounts[] = {0};           // daemon replaces per job

// --- inside OnInit() -------------------------------------------------------
/*
  long account = AccountInfoInteger(ACCOUNT_LOGIN);
  bool IsAccount = false;
  if (AccountProtectON) {
    for (int i = 0; i < ArraySize(allowed_accounts); i++) {
      if (account == allowed_accounts[i]) {
        IsAccount = true;
        Print("<TAG>: Account verified.");
        break;
      }
    }
  }
  bool IsExpired = (ExpiredON && TimeCurrent() > ExpiredTime);

  if (ExpiredON && IsExpired) {
    Print("<TAG>: EA has expired.");
    return (INIT_FAILED);
  }
  if (AccountProtectON && !IsAccount) {
    Print("<TAG>: Unauthorized account.");
    return (INIT_FAILED);
  }
*/

// --- runtime licence check (any robot released from 2026-09-22) ------------
// OnInit only runs when the EA is attached or the terminal restarts, so on
// its own a terminal left running keeps trading after the licence ends — a
// free trial on a VPS, forever. Call IsLicenceExpired() right before the code
// that opens NEW trades and return if it is true; keep hedge management and
// order cleanup running above that line so open positions are still looked
// after. Also add Comment(""); to OnDeinit to clear the chart message.
/*
bool IsLicenceExpired() {
  if (!ExpiredON || TimeCurrent() <= ExpiredTime) return false;
  static bool announced = false;
  if (!announced) {
    announced = true;
    Print("<TAG>: Licence expired - no new trades. Open positions are still managed.");
    Comment("AL-ai-FX <Robot Name>: licence expired - renew at al-ai-fx.xyz");
  }
  return true;
}
*/

// RULES:
// - <TAG> = short robot tag WITHOUT underscores (the trade-comment parser
//   forbids underscores in comment bases; keep prints consistent with that).
// - Trade comment bases must never contain underscores (parser reserves
//   `_1_R` / `_2_R` style suffixes).
