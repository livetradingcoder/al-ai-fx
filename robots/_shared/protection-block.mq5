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

// RULES:
// - <TAG> = short robot tag WITHOUT underscores (the trade-comment parser
//   forbids underscores in comment bases; keep prints consistent with that).
// - Trade comment bases must never contain underscores (parser reserves
//   `_1_R` / `_2_R` style suffixes).
