"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Trade {
  p: string;
  q: string;
  m: boolean;
  T: number;
  s: string;
}

interface Candle {
  bucket: string;
  symbol: string;
  open_price: string;
  high_price: string;
  low_price: string;
  close_price: string;
  volume: string;
}

const intervals = ["1 minute", "5 minutes", "10 minutes", "30 minutes"];
const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const CandlestickChart = ({ candles }: { candles: Candle[] }) => {
  const chartData = useMemo(
    () =>
      candles.map((c) => ({
        x: new Date(c.bucket).getTime(),
        y: [
          parseFloat(c.open_price),
          parseFloat(c.high_price),
          parseFloat(c.low_price),
          parseFloat(c.close_price),
        ],
      })),
    [candles]
  );

  const volumeData = useMemo(
    () =>
      candles.map((c) => ({
        x: new Date(c.bucket).getTime(),
        y: parseFloat(c.volume),
      })),
    [candles]
  );

  const options: ApexOptions = {
    chart: {
      type: "candlestick",
      height: 400,
      background: "#ffffff",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    theme: { mode: "light" },
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      type: "datetime",
      labels: { style: { colors: "#374151", fontSize: "11px" }, format: "HH:mm" },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: {
        style: { colors: "#374151", fontSize: "11px" },
        formatter: (v: number) => `$${v.toFixed(2)}`,
      },
    },
    plotOptions: {
      candlestick: {
        colors: { upward: "#00b894", downward: "#d63031" },
        wick: { useFillColor: true },
      },
    },
    tooltip: {
      theme: "light",
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
        const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
        const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
        const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
        const date = new Date(w.globals.seriesX[seriesIndex][dataPointIndex]).toLocaleString();
        return `<div class="p-2 text-sm text-gray-800">
          <div class="mb-1 font-medium">${date}</div>
          <div class="space-y-1">
            <div class="flex justify-between"><span>Open:</span> <span>$${o?.toFixed(2)}</span></div>
            <div class="flex justify-between"><span>High:</span> <span>$${h?.toFixed(2)}</span></div>
            <div class="flex justify-between"><span>Low:</span> <span>$${l?.toFixed(2)}</span></div>
            <div class="flex justify-between"><span>Close:</span> <span>$${c?.toFixed(2)}</span></div>
          </div>
        </div>`;
      },
    },
  };

  const volumeOptions: ApexOptions = {
    chart: { type: "bar", height: 120, background: "#ffffff", toolbar: { show: false } },
    theme: { mode: "light" },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 0, show: false },
    xaxis: { type: "datetime", labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (v: number) => v.toFixed(2), style: { colors: "#374151", fontSize: "10px" } } },
    plotOptions: { bar: { colors: { ranges: [{ from: 0, to: 999999, color: "#9ca3af" }] } } },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v: number) => `${v.toFixed(4)} BTC` } },
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-800">{candles[0]?.symbol || "Symbol"}</h3>
      </div>
      <div className="p-4">
        <Chart options={options} series={[{ data: chartData }]} type="candlestick" height={400} />
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500 mb-2">Volume</div>
          <Chart options={volumeOptions} series={[{ name: "Volume", data: volumeData }]} type="bar" height={120} />
        </div>
      </div>
    </div>
  );
};

export default function HomePage() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [interval, setIntervalState] = useState("1 minute");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [prices, setPrices] = useState<Record<string, number>>({ BTCUSDT: 0, ETHUSDT: 0, SOLUSDT: 0 });

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3006");
    ws.onmessage = (event) => {
      const data: Trade = JSON.parse(event.data);
      setPrices((prev) => ({ ...prev, [data.s]: parseFloat(data.p) }));
    };
    return () => ws.close();
  }, []);

  const fetchCandles = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:3000/candles?interval=${encodeURIComponent(interval)}&duration=1 hour`);
      const data = await res.json();
      setCandles(data.filter((c: Candle) => c.symbol === symbol));
    } catch (err) {
      console.error(err);
    }
  }, [interval, symbol]);

  useEffect(() => {
    fetchCandles();
    const intervalId = setInterval(fetchCandles, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchCandles]);

  const priceChange = useMemo(() => {
    if (candles.length < 2) return { change: 0, percentage: 0 };
    const latest = parseFloat(candles[candles.length - 1]?.close_price || "0");
    const previous = parseFloat(candles[candles.length - 2]?.close_price || "0");
    const change = latest - previous;
    const percentage = (change / previous) * 100;
    return { change, percentage };
  }, [candles]);

  const getSpread = (price: number) => ({ ask: price * 1.05, bid: price * 0.95 });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-100 border-b border-gray-300 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">₿</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">{symbol}</h1>
              <div className="flex items-center space-x-3">
                <span className="text-lg font-mono text-gray-800">${prices[symbol].toFixed(2)}</span>
                <span className={`text-xs px-2 py-1 rounded ${priceChange.change >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {priceChange.change >= 0 ? '+' : ''}{priceChange.change.toFixed(2)} ({priceChange.percentage.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="bg-white border border-gray-300 rounded px-3 py-1 text-gray-800 text-sm focus:outline-none focus:border-gray-400">
              {symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={interval} onChange={(e) => setIntervalState(e.target.value)} className="bg-white border border-gray-300 rounded px-3 py-1 text-gray-800 text-sm focus:outline-none focus:border-gray-400">
              {intervals.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <CandlestickChart candles={candles} />
        </div>

        {/* Spread Section */}
        <div className="space-y-6">
          {symbols.map(s => {
            const { ask, bid } = getSpread(prices[s]);
            return (
              <div key={s} className="bg-gray-50 rounded-lg border border-gray-200 p-4 shadow">
                <h3 className="text-sm font-medium text-gray-600 mb-2">{s} Spread</h3>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Bid:</span>
                  <span className="text-green-600 font-mono">${bid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ask:</span>
                  <span className="text-red-600 font-mono">${ask.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
