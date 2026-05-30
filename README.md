# 📈 NeuraWealth — AI-Powered Stock Market Analysis Platform

### Where Predictive Analytics Meets Financial Intelligence

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18.2-000000?style=flat&logo=express)](https://expressjs.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python)](https://www.python.org/)
[![yfinance](https://img.shields.io/badge/Yahoo_Finance-yfinance-blue?style=flat&logo=yahoo)](https://github.com/ranaroussi/yfinance)
[![Platform](https://img.shields.io/badge/OS-Windows_|_Linux-blue?style=flat&logo=linux)](https://ubuntu.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📖 Overview

**NeuraWealth** is an AI-driven stock market prediction and analysis platform designed for Indian equity markets. It converts complex historical price files and current news sentiment into clean, actionable, and interactive financial decisions. 

By utilizing robust technical indicator algorithms (EMA, SMA, RSI, MACD) on historical CSV data and scanning real-time news streams with natural language sentiment evaluation, NeuraWealth provides a comprehensive beginner-friendly playground. It offers custom backtesting simulators, short-term trends prediction, and an interactive finance advisor chatbot—all served through a high-performance web interface.

### Purpose

* **Demystify Market Analytics**: Map out standard quantitative parameters (RSI overbought/oversold boundaries, MACD crossovers) into direct buy, hold, or sell strategies.
* **Algorithmic Strategy Testing**: Run historical backtests on simple breakout or momentum rules, rendering instant performance comparison without real financial risk.
* **Sentiment Synthesis**: Track market mood and press impacts on stock behavior using GNews keyword analysis.
* **Interactive Chat Dialogues**: Ask financial questions through a custom-built financial advisory chatbot that queries local stock layers on-demand.

---

## ✨ Features

### 🚀 Core Experience

* **Hybrid Analytical Engine**: Merges standard statistical price models with external news sentiment for multi-factor market prediction.
* **On-Demand Data Ingestion**: Automatically downloads 10-year Yahoo Finance historical CSV sheets on-demand using a Python `yfinance` daemon.
* **Algorithmic Backtester**: Runs breakout and crossover trading models over custom time boundaries, checking ROI and Win/Loss metrics.
* **Financial Chatbot Companion**: Processes conversational queries, dynamically binding with localized stock data arrays to answer specific equity questions.
* **Air-Gapped Offline Mode**: Operates fully on pre-downloaded or synthetically generated CSV records if internet access or API key feeds are restricted.

---

### 🎨 Interactive UI Sections

| Section / Panel | Description | Core Technology |
| :--- | :--- | :--- |
| **Market Overview Hub** | Aggregates major indices (NIFTY, SENSEX), trending gainers/losers, and overall market momentum curves. | Chart.js, HTML5 Grid, CSS3 |
| **AI Trend Predictor** | Renders short-term stock movements, price direction curves, and formal analytical recommendations. | HTML5 Canvas, predictor.js |
| **Backtesting Sandbox** | Tests breakouts, SMA crossovers, and momentum rules across historical datasets to compare returns. | backtest.js, CSS Flexbox |
| **Sentiment Tracker** | Scans live market headlines, scoring articles positive 🟢, neutral 🟡, or negative 🔴 to yield a net bias. | GNews API, news.js, CSS variables |
| **Intelligent Chatbot** | Receives natural queries (e.g., *"What is the trend of TCS?"*) and returns predictions, risks, and explanations. | chatbot.js, chat.js |

---

### 💻 Supported Stocks & Data Layout

NeuraWealth handles both local offline files and fresh online stock streams:

| Stock Name | Yahoo Ticker | Default Offline CSV Path | Fallback State |
| :--- | :--- | :--- | :--- |
| **Tata Consultancy Services** | `TCS.NS` | `data/stocks/TCS.NS.csv` | Pre-downloaded / Cached |
| **Reliance Industries** | `RELIANCE.NS` | `data/stocks/RELIANCE.NS.csv` | Pre-downloaded / Cached |
| **Infosys Technologies** | `INFY.NS` | `data/stocks/INFY.NS.csv` | Pre-downloaded / Cached |
| **HDFC Bank** | `HDFCBANK.NS` | `data/stocks/HDFCBANK.NS.csv` | Pre-downloaded / Cached |
| **Wipro Limited** | `WIPRO.NS` | `data/stocks/WIPRO.NS.csv` | Pre-downloaded / Cached |
| **ICICI Bank** | `ICICIBANK.NS` | `data/stocks/ICICIBANK.NS.csv` | Synthetic Auto-Generation |

---

## 📁 Project Directory Structure

```text
NeuraWealth:\
├── data\                               # Local database layer
│   ├── README.md                       # CSV download instruction guide
│   └── stocks\                         # Storage directory for historical stock CSVs
│       ├── TCS.NS.csv
│       ├── RELIANCE.NS.csv
│       └── INFY.NS.csv
│
├── backend\                            # Node.js + Express server engine
│   ├── server.js                       # Main server, routing, and controller maps
│   ├── downloader.py                   # Python yfinance automatic downloader daemon
│   ├── package.json                    # Dependency mapping
│   ├── package-lock.json
│   └── utils\                          # Quantitative utilities
│       ├── backtest.js                 # Algorithmic strategy backtester
│       ├── chatbot.js                  # Chat processing & prompt logic
│       ├── csvReader.js                # CSV file parsing layer
│       ├── indicators.js               # Mathematical indicator calculator (RSI, MACD)
│       └── predictor.js                # AI Trend generator & Buy/Sell predictor
│
└── frontend\                           # Vanilla Web client workspace
    ├── index.html                      # Core dashboard interface
    ├── css\
    │   └── style.css                   # Custom responsive design system styles
    └── js\                             # Interface tab controller modules
        ├── app.js                      # Core state & routing script
        ├── backtest-tab.js             # Backtest charts & tab handling
        ├── chat.js                     # Chat interface module
        ├── market.js                   # Market indices loader
        ├── news.js                     # News aggregator & sentiment scorer
        └── prediction.js               # Predictor UI charts & indicator rendering
```

---

## 🛠️ Technical Specifications

### Core Frameworks

* **Frontend Dashboard**: Vanilla HTML5, CSS3, modern responsive animations, Chart.js for data visualization, and asynchronous JS.
* **Backend Runtime**: **Node.js** (Express server, custom file routers, and multithreaded subprocess execution controllers).
* **Quant Library**: Vanilla JavaScript calculations for SMA, EMA, RSI boundaries, and MACD signals.
* **External Integrations**: **GNews API** (Real-time financial sentiment feeds) & **yfinance** (Automatic background CSV collection).

### Interface Port Allocation
* **Express Server Port**: `5600` (Serves the API and maps static paths to the UI dashboard).
* **Local Web Address**: `http://localhost:5600`

---

## 📦 Installation & Setup

### 🟢 First-Time Setup
1. **Add API Key**: Create a `.env` file in the `backend/` directory and configure your news feed key:
   ```env
   GNEWS_API_KEY=your_free_gnews_api_key_here
   ```
   *(Get a free key at [gnews.io](https://gnews.io/))*
2. **Install Backend**: Open your terminal in the backend directory and install Node.js dependencies:
   ```bash
   cd backend
   npm install
   ```
3. **Install Dependencies**: Ensure you have Python installed, then set up the data-download package:
   ```bash
   pip install yfinance
   ```

---

### ▶ Run
* **Launch the Server**: Start the Express server in development mode:
  ```bash
  cd backend
  npm run dev
  ```
* **Launch the UI**: Open your default web browser and navigate to:
  `http://localhost:5600`

Browser opens → Select stock → View predictions & chat!

---

## 💡 Example Prompts

You can query the financial advisor chatbot using natural prompts:
* *Should I buy Reliance?*
* *What is the trend of TCS?*
* *How did Infosys perform in backtesting?*
* *Risk analysis for HDFC Bank*

---

## 🛠 Troubleshooting

* **GNews error**: Add `GNEWS_API_KEY` to `backend/.env` and restart the server.
* **Python not found**: The backend automatically falls back to offline, pre-downloaded, or cached CSV files inside `data/stocks/` or generates synthetic data.
* **Server not starting**: Verify port `5600` is free, or close conflicting processes (`netstat -ano | findstr 5600`).
* **Missing stock data**: Place custom Yahoo Finance CSVs named `<SYMBOL>.csv` directly inside `data/stocks/`.

---

## 🔧 Manual Commands

* **Start Server**:
  ```bash
  node backend/server.js
  ```
* **Download Data**:
  ```bash
  python backend/downloader.py TCS.NS data/stocks
  ```
* **Run Backtest**: HTTP endpoint check:
  `GET http://localhost:5600/api/backtest/TCS`
* **Chat Query**: HTTP backend chatbot check:
  `POST http://localhost:5600/api/chat` with `{ "message": "Should I buy TCS?" }`

---

## 🎯 Development Roadmap

### ✅ Completed
* Express server environment setup with custom multithreaded Python integration.
* Quantitative indicator library calculation SMA, EMA, RSI, and MACD.
* Keyword-based financial news sentiment parser powered by the GNews endpoint.
* Dual backend fallbacks for offline demo data and automated online `yfinance` fetches.

### 🚧 In Progress
* Integrating full FinBERT neural net sentiment models for superior news accuracy.
* Adding multi-stock correlation grids inside the primary market dashboard.

### 📅 Planned
* Implementing automated alert configurations on custom price target triggers.
* Integrating live websocket pipelines for real-time portfolio updates.

---

## 🤝 Contributing & Support

Contributions are welcome! Please follow these steps to add new indicators or strategies:

1. Create a feature branch: `git checkout -b feature/new-indicator`
2. Test code using standard local stocks data.
3. Commit changes: `git commit -m "Add new indicator"`
4. Push and open a pull request.

---

## 📜 Licenses & Credits

### Open Source Runtimes
* **Express & Node.js**: Distributed under the [MIT License](https://opensource.org/licenses/MIT).
* **yfinance Library**: Distributed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

### Credits
* Stock data parsing routines built with Yahoo Finance historical formats.
* API structure built using GNews news stream engines.
