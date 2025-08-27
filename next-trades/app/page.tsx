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
interface ActiveOrder {
  id: string;
  type: "buy" | "sell";
  symbol: string;
  entryPrice: number;
  quantity: number;
  orderAmount: number;
  expiry: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  balanceBeforeOrder: number; 
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

  const options: ApexOptions = {
    chart: { type: "candlestick", height: 400, background: "#ffffff", toolbar: { show: false }, zoom: { enabled: false } },
    theme: { mode: "light" },
    grid: { borderColor: "#e5e7eb", xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    xaxis: { type: "datetime", labels: { style: { colors: "#374151", fontSize: "11px" }, format: "HH:mm" }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { tooltip: { enabled: true }, labels: { style: { colors: "#374151", fontSize: "11px" }, formatter: (v: number) => `$${v.toFixed(2)}` } },
    plotOptions: { candlestick: { colors: { upward: "#00b894", downward: "#d63031" }, wick: { useFillColor: true } } },
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{candles[0]?.symbol || "Symbol"}</h3>
      </div>
      <div className="p-4">
        <Chart options={options} series={[{ data: chartData }]} type="candlestick" height={400} />
      </div>
    </div>
  );
};

export default function HomePage() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [interval, setIntervalState] = useState("1 minute");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [prices, setPrices] = useState<Record<string, number>>({ BTCUSDT: 0, ETHUSDT: 0, SOLUSDT: 0 });
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState<number>(0);
  const [balance, setBalance] = useState<Record<string, number>>({ USD: 10000 });
  const [marginPercent, setMarginPercent] = useState<number>(2); 
  const [holdTime, setHoldTime] = useState<number>(20); 
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const getSpread = (price: number) => ({ ask: price * 1.05, bid: price * 0.95 });

  const placeOrder = (type: "buy" | "sell", sym: string) => {
    if (!orderAmount || orderAmount <= 0) {
      alert("Please enter a valid order amount");
      return;
    }
    if (balance.USD < orderAmount) {
      alert("Insufficient balance");
      return;
    }

    const { ask, bid } = getSpread(prices[sym]);
    const entryPrice = type === "buy" ? ask : bid;
    const quantity = orderAmount / entryPrice;
    const currentBalance = balance.USD;
    //updated the balance
    setBalance((prev) => ({ ...prev, USD: prev.USD - orderAmount }));

    const marginDecimal = marginPercent / 100;
    let takeProfitPrice: number;
    let stopLossPrice: number;
    if (type === "buy") {
      // the way the truth
      takeProfitPrice = entryPrice * (1 + marginDecimal);
      stopLossPrice = entryPrice * (1 - marginDecimal);
    } else {
      takeProfitPrice = entryPrice * (1 - marginDecimal);
      stopLossPrice = entryPrice * (1 + marginDecimal);
    }
    const newOrder: ActiveOrder = {
      id: Date.now().toString(),
      type,
      symbol: sym,
      entryPrice,
      quantity,
      orderAmount,
      expiry: Date.now() + (holdTime * 1000),
      takeProfitPrice,
      stopLossPrice,
      balanceBeforeOrder: currentBalance
    };
    setActiveOrders((prev) => [...prev, newOrder]);
    setOrderAmount(0);
    setActiveSymbol(null);

    console.log(`placed: ${type} $${orderAmount} of ${sym} at $${entryPrice}`);
    console.log(`balanc before: $${currentBalance}, Balance after: $${currentBalance - orderAmount}`);
  };

  const calculateOrderValue = (order: ActiveOrder, currentPrice: number): { pnl: number; pnlPercent: number; finalValue: number } => {
    let finalValue: number;

    if (order.type === "buy") {
      
      finalValue = order.quantity * currentPrice;
    } else {
      
      finalValue = order.orderAmount + (order.entryPrice - currentPrice) * order.quantity;
    }

    const pnl = finalValue - order.orderAmount;
    const pnlPercent = (pnl / order.orderAmount) * 100;

    return { pnl, pnlPercent, finalValue };
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveOrders((prev) => {
        const now = Date.now();
        const remainingOrders: ActiveOrder[] = [];

        prev.forEach((order) => {
          const currentPrice = prices[order.symbol];
          if (!currentPrice) {
            remainingOrders.push(order);
            return;
          }

          let shouldClose = false;
          let closeReason = "";

          
          if (now >= order.expiry) {
            shouldClose = true;
            closeReason = "expired";
          }
          
          else if (order.type === "buy") {
            if (currentPrice >= order.takeProfitPrice) {
              shouldClose = true;
              closeReason = `take profit happened at $${currentPrice.toFixed(2)}`;
            } else if (currentPrice <= order.stopLossPrice) {
              shouldClose = true;
              closeReason = `stop loss happened at $${currentPrice.toFixed(2)}`;
            }
          } else {
            if (currentPrice <= order.takeProfitPrice) {
              shouldClose = true;
              closeReason = `take profit happened at $${currentPrice.toFixed(2)}`;
            } else if (currentPrice >= order.stopLossPrice) {
              shouldClose = true;
              closeReason = `stop loss happened  at $${currentPrice.toFixed(2)}`;
            }
          }
          if (shouldClose) {
            const { finalValue, pnl } = calculateOrderValue(order, currentPrice);
            console.log(`Order Type: ${order.type}`);
            console.log(`Original Investment: $${order.orderAmount}`);
            console.log(`Entry Price: $${order.entryPrice}`);
            console.log(`Current Price: $${currentPrice}`);
            console.log(`Quantity: ${order.quantity}`);
            console.log(`Final Value: $${finalValue}`);
            console.log(`P&L: $${pnl}`);
            console.log(`Balance Before Order: $${order.balanceBeforeOrder}`);
            const newBalance = order.balanceBeforeOrder + pnl;
            
            console.log(`New Balance Should Be: $${order.balanceBeforeOrder} + $${pnl} = $${newBalance}`);
            
            setBalance((prevBalance) => {
              console.log(`Current Balance in State: $${prevBalance.USD}`);
              return {
                ...prevBalance,
                USD: newBalance
              };
            });

            const profitLoss = pnl >= 0 ? "PROFIT" : "LOSS";
            alert(`${order.type.toUpperCase()} order closed: ${closeReason}. ${profitLoss}: $${pnl.toFixed(2)}`);
          } else {
            remainingOrders.push(order);
          }
        });

        return remainingOrders;
      });
    }, 100); 

    return () => clearInterval(intervalId);
  }, [prices]);

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

  return (
    <div className="min-h-screen bg-white">
      
      <div className="bg-gray-100 border-b border-gray-300 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">{symbol}</h1>
            <span className="text-lg font-mono text-gray-900 font-semibold">${prices[symbol]?.toFixed(2)}</span>
          </div>
          <div className="flex items-center space-x-3">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} 
                    className="border border-gray-300 rounded px-3 py-1 text-sm font-medium text-gray-900 bg-white">
              {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="text-sm font-semibold text-gray-800">Balance: ${balance.USD?.toFixed(2) || "0.00"}</div>
            <select value={interval} onChange={(e) => setIntervalState(e.target.value)} 
                    className="border border-gray-300 rounded px-3 py-1 text-sm font-medium text-gray-900 bg-white">
              {intervals.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto p-4 bg-gray-50 border-b">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-semibold text-gray-700">Margin %:</label>
            <input 
              type="number" 
              value={marginPercent} 
              onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm font-medium text-gray-900"
              step="0.1"
              min="0.1"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-semibold text-gray-700">Hold Time (seconds):</label>
            <input 
              type="number" 
              value={holdTime} 
              onChange={(e) => setHoldTime(parseInt(e.target.value) || 0)}
              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm font-medium text-gray-900"
              min="1"
            />
          </div>
        </div>
      </div>
      {activeOrders.length > 0 && (
        <div className="max-w-7xl mx-auto p-4">
          <h2 className="font-bold text-gray-900 mb-3 text-lg">Active Orders</h2>
          <div className="space-y-3">
            {activeOrders.map((order) => {
              const currentPrice = prices[order.symbol];
              const { pnl, pnlPercent, finalValue } = calculateOrderValue(order, currentPrice || order.entryPrice);
              const timeLeft = Math.max(0, Math.floor((order.expiry - Date.now()) / 1000));
              
              return (
                <div key={order.id} className="p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-bold text-gray-900 text-lg">
                        {order.type.toUpperCase()} {order.symbol}
                      </div>
                      <div className="text-sm font-medium text-gray-700">
                        Entry: ${order.entryPrice.toFixed(2)} | Current: ${currentPrice?.toFixed(2) || 'Loading...'}
                      </div>
                      <div className="text-sm font-medium text-gray-700">
                        Amount: ${order.orderAmount.toFixed(2)} | Est. Return: ${finalValue.toFixed(2)}
                      </div>
                      <div className="text-sm font-medium text-gray-700">
                        Quantity: {order.quantity.toFixed(6)} {order.symbol.replace('USDT', '')}
                      </div>
                      <div className="text-sm font-medium text-gray-600">
                        TP: ${order.takeProfitPrice.toFixed(2)} | SL: ${order.stopLossPrice.toFixed(2)}
                      </div>
                      <div className="text-sm font-medium text-gray-600">
                        Time left: {timeLeft}s
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </div>
                      <div className={`text-sm font-semibold ${pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <CandlestickChart candles={candles} />
        </div>
        <div className="space-y-6">
          {symbols.map((s) => {
            const { ask, bid } = getSpread(prices[s]);
            return (
              <div key={s} className="bg-gray-50 rounded-lg border border-gray-200 p-4 shadow-sm cursor-pointer"
                   onClick={() => setActiveSymbol(activeSymbol === s ? null : s)}>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">{s} Spread</h3>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-700 font-medium">Bid:</span>
                  <span className="text-green-600 font-mono font-bold">${bid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 font-medium">Ask:</span>
                  <span className="text-red-600 font-mono font-bold">${ask.toFixed(2)}</span>
                </div>

                {activeSymbol === s && (
                  <div
                    className="mt-4 space-y-3 border-t pt-3 bg-white shadow-sm rounded-lg p-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-sm font-semibold text-gray-800 mb-2">
                      Available Balance: ${balance.USD.toFixed(2)}
                    </div>
                    <input
                      type="number"
                      value={orderAmount || ""}
                      onChange={(e) => setOrderAmount(parseFloat(e.target.value))}
                      placeholder="Enter amount in USD"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    />
                    <div className="flex space-x-2">
                      <button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded py-2 text-sm font-bold transition-colors duration-200"
                        onClick={() => placeOrder("buy", s)}
                      >
                        BUY
                      </button>
                      <button
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded py-2 text-sm font-bold transition-colors duration-200"
                        onClick={() => placeOrder("sell", s)}
                      >
                        SELL
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


