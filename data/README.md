# Historical Data — Yahoo Finance CSVs

Place your downloaded Yahoo Finance CSV files in this `stocks/` folder.

## How to Download

1. Go to [finance.yahoo.com](https://finance.yahoo.com)
2. Search for a stock, e.g. `TCS.NS` (NSE) or `TCS.BO` (BSE)
3. Click **Historical Data** → set date range → click **Download**
4. Rename the file to match the ticker: `TCS.NS.csv`, `RELIANCE.NS.csv`, etc.
5. Place the file in this `data/stocks/` folder

## Expected CSV Format (Yahoo Finance default)

```
Date,Open,High,Low,Close,Adj Close,Volume
2024-01-02,3900.00,3950.00,3880.00,3920.00,3920.00,1234567
2024-01-03,3921.00,3980.00,3910.00,3965.00,3965.00,1456789
...
```

## Supported Stocks (demo data built-in)

Even without any CSVs, the app works with built-in demo data for:
- `TCS` — Tata Consultancy Services
- `RELIANCE` — Reliance Industries
- `INFY` — Infosys
- `HDFCBANK` — HDFC Bank
- `WIPRO` — Wipro
- `ICICIBANK` — ICICI Bank

## Naming Convention

| Stock       | Yahoo Symbol | File Name            |
|-------------|-------------|----------------------|
| TCS         | TCS.NS      | `TCS.NS.csv`         |
| Reliance    | RELIANCE.NS | `RELIANCE.NS.csv`    |
| Infosys     | INFY.NS     | `INFY.NS.csv`        |
| HDFC Bank   | HDFCBANK.NS | `HDFCBANK.NS.csv`    |
| Wipro       | WIPRO.NS    | `WIPRO.NS.csv`       |

The backend will automatically detect any CSV files placed here.
