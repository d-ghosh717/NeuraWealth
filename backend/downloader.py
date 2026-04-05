#!/usr/bin/env python
"""
backend/downloader.py
Called by Node.js server: python downloader.py <SYMBOL> <output_dir>
- Downloads 10 years of history from Yahoo Finance (max available up to 10yrs)
- Skips download if a fresh CSV already exists (< 24h old)
- Saves to output_dir/<BARE_SYMBOL>.csv
- Prints JSON result to stdout
"""

import sys
import os
import json
import datetime
import time

try:
    import yfinance as yf
except ImportError:
    print(json.dumps({"success": False, "error": "yfinance not installed. Run: pip install yfinance"}))
    sys.exit(1)


def find_existing_csv(symbol, output_dir):
    """Check if a CSV for this symbol already exists and is fresh (< 24h old)."""
    sym_upper = symbol.upper()
    bare = sym_upper.lstrip("^").split(".")[0]

    # All possible filenames to check
    candidates = [
        f"{bare}.csv",
        f"{sym_upper}.csv",
        f"{bare}.NS.csv",
        f"{bare}.BO.csv",
    ]

    for fname in candidates:
        fpath = os.path.join(output_dir, fname)
        if os.path.exists(fpath):
            age_seconds = time.time() - os.path.getmtime(fpath)
            fsize = os.path.getsize(fpath)
            if fsize > 1000 and age_seconds < 86400:  # Fresh if < 24 hours old
                return fpath, fname
    return None, None


def download(symbol, output_dir):
    sym_upper = symbol.upper()

    # ── Check if fresh CSV already exists ─────────────────────────────────
    existing_path, existing_name = find_existing_csv(symbol, output_dir)
    if existing_path:
        # Already have fresh data — return info without re-downloading
        print(json.dumps({
            "success": True,
            "symbol": sym_upper,
            "usedTicker": "cached",
            "filename": existing_name,
            "filepath": existing_path,
            "rows": -1,  # Not counted (fast path)
            "cached": True,
            "latestDate": "cached",
            "latestClose": -1,
            "prevClose": -1
        }))
        return

    # ── Determine ticker variants to try ──────────────────────────────────
    if sym_upper.startswith("^"):
        variants = [sym_upper]
    elif "." not in sym_upper:
        variants = [f"{sym_upper}.NS", f"{sym_upper}.BO", sym_upper]
    else:
        variants = [sym_upper]

    ticker_obj = None
    used_symbol = None

    # 10-year date range
    end_date   = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=365 * 10)

    for v in variants:
        try:
            t = yf.Ticker(v)
            hist = t.history(
                start=start_date.strftime("%Y-%m-%d"),
                end=end_date.strftime("%Y-%m-%d"),
                auto_adjust=True
            )
            if hist is not None and len(hist) > 20:
                ticker_obj = hist
                used_symbol = v
                break
        except Exception:
            continue

    if ticker_obj is None or len(ticker_obj) == 0:
        print(json.dumps({"success": False, "error": f"No data found for {symbol}"}))
        sys.exit(1)

    # ── Save CSV ───────────────────────────────────────────────────────────
    df = ticker_obj[["Close", "High", "Low", "Open", "Volume"]].copy()
    df.index.name = "Date"
    # Handle timezone-aware index
    if hasattr(df.index, 'tz') and df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    df.index = df.index.strftime("%Y-%m-%d")

    os.makedirs(output_dir, exist_ok=True)
    bare = sym_upper.lstrip("^").split(".")[0]
    filename = f"{bare}.csv"
    filepath = os.path.join(output_dir, filename)
    df.to_csv(filepath)

    latest = df.iloc[-1]
    prev   = df.iloc[-2] if len(df) > 1 else latest

    print(json.dumps({
        "success": True,
        "symbol": sym_upper,
        "usedTicker": used_symbol,
        "filename": filename,
        "filepath": filepath,
        "rows": len(df),
        "cached": False,
        "latestDate": str(df.index[-1]),
        "latestClose": float(latest["Close"]),
        "prevClose": float(prev["Close"])
    }))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: python downloader.py SYMBOL output_dir"}))
        sys.exit(1)

    symbol     = sys.argv[1]
    output_dir = sys.argv[2]
    download(symbol, output_dir)
