"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  entry_price: string | number;
  quantity: string | number;
  order_amount: string | number;
  expiry: number;
  take_profit_price: string | number;
  stop_loss_price: string | number;
  balance_before_order?: number;
  exit_price?: string | number;
  pnl?: string | number;
  status?: string;
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
    chart: { 
      type: "candlestick", 
      height: 400, 
      background: "#1f2937", 
      toolbar: { show: false } 
    },
    theme: { mode: "dark" },
    grid: { 
      borderColor: "#374151", 
      yaxis: { lines: { show: true } } 
    },
    xaxis: {
      type: "datetime",
      labels: { 
        style: { colors: "#d1d5db", fontSize: "11px" }, 
        format: "HH:mm" 
      },
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: {
        style: { colors: "#d1d5db", fontSize: "11px" },
        formatter: (v: number) => `$${v.toFixed(2)}`,
      },
    },
    plotOptions: {
      candlestick: {
        colors: { upward: "#10b981", downward: "#ef4444" },
        wick: { useFillColor: true },
      },
    },
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">
          {candles[0]?.symbol || "Symbol"}
        </h3>
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
  const [balance, setBalance] = useState<number>(0);
  const [marginPercent, setMarginPercent] = useState<number>(2);
  const [holdTime, setHoldTime] = useState<number>(20);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [orderHistory, setOrderHistory] = useState<ActiveOrder[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem("token");
    const bal = localStorage.getItem("balance");
    if (!token) {
      router.push("/signin");
    } else {
      setBalance(parseFloat(bal || "0"));
      // Fetch current orders and balance from server
      fetchOrders();
      fetchBalance();
    }
  }, [router]);

  // Fetch user's active orders
  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3005/orders", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const orders = await res.json();
        setActiveOrders(orders);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  };

  // Fetch user's current balance
  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3005/balance", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(parseFloat(data.balance));
        localStorage.setItem("balance", data.balance);
      }
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  };

  // Fetch user's order history
  const fetchOrderHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3005/order-history", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const history = await res.json();
        setOrderHistory(history);
      }
    } catch (err) {
      console.error("Error fetching order history:", err);
    }
  };

  const getSpread = (price: number) => ({ ask: price * 1.05, bid: price * 0.95 });

  // Close order manually
  const closeOrder = async (orderId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3005/close-order", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ orderId })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Order closed successfully! PnL: $${data.pnl.toFixed(2)}`);
        fetchOrders();
        fetchBalance();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      console.error("Error closing order:", err);
      alert("Error closing order");
    }
  };

  // Helper function to safely convert string/number to number
  const toNumber = (value: string | number): number => {
    return typeof value === 'string' ? parseFloat(value) : value;
  };

  const placeOrder = async (type: "buy" | "sell", sym: string) => {
    if (!orderAmount || orderAmount <= 0) return alert("Enter valid amount");
    if (balance < orderAmount) return alert("Insufficient balance");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3005/placeorder", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol: sym, type, orderAmount, marginPercent, holdTime }),
      });
      if (!res.ok) throw new Error("Order failed");
      const data = await res.json();

      setActiveOrders((prev) => [...prev, data]);
      setOrderAmount(0);
      setActiveSymbol(null);
      // Refresh orders and balance from server
      fetchOrders();
      fetchBalance();
    } catch (err) {
      console.error(err);
      alert("Error placing order");
    }
  };

  const calculateOrderValue = (order: ActiveOrder, currentPrice: number) => {
    const entryPrice = typeof order.entry_price === 'string' ? parseFloat(order.entry_price) : order.entry_price;
    const quantity = typeof order.quantity === 'string' ? parseFloat(order.quantity) : order.quantity;
    const orderAmount = typeof order.order_amount === 'string' ? parseFloat(order.order_amount) : order.order_amount;
    
    let finalValue: number;
    if (order.type === "buy") {
      finalValue = quantity * currentPrice;
    } else {
      finalValue = orderAmount + (entryPrice - currentPrice) * quantity;
    }
    const pnl = finalValue - orderAmount;
    const pnlPercent = (pnl / orderAmount) * 100;
    return { pnl, pnlPercent, finalValue };
  };

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

  // Periodically refresh orders and balance
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchOrders();
      fetchBalance();
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(refreshInterval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-white">{symbol}</h1>
            <span className="text-lg font-mono text-green-400 font-semibold">
              ${prices[symbol]?.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <select 
              value={symbol} 
              onChange={(e) => setSymbol(e.target.value)} 
              className="border border-gray-600 bg-gray-700 text-white px-3 py-1 rounded"
            >
              {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select 
              value={interval} 
              onChange={(e) => setIntervalState(e.target.value)} 
              className="border border-gray-600 bg-gray-700 text-white px-3 py-1 rounded"
            >
              {intervals.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <div className="text-sm font-semibold text-white">
              Balance: <span className="text-green-400">${balance.toFixed(2)}</span>
            </div>
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchOrderHistory();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              {showHistory ? "Hide History" : "Order History"}
            </button>
            <button
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
              onClick={() => { localStorage.clear(); router.push("/login"); }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Chart + Orders */}
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <CandlestickChart candles={candles} />
        </div>
        <div className="space-y-6">
          {symbols.map((s) => {
            const { ask, bid } = getSpread(prices[s]);
            return (
              <div key={s} className="bg-gray-800 rounded-lg border border-gray-700 p-4 shadow-sm cursor-pointer hover:bg-gray-750 transition-colors"
                   onClick={() => setActiveSymbol(activeSymbol === s ? null : s)}>
                <h3 className="text-sm font-semibold mb-2 text-white">{s} Spread</h3>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-300">Bid:</span>
                  <span className="text-green-400 font-mono">${bid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Ask:</span>
                  <span className="text-red-400 font-mono">${ask.toFixed(2)}</span>
                </div>
                {activeSymbol === s && (
                  <div className="mt-4 space-y-3 border-t border-gray-600 pt-3 bg-gray-700 rounded-lg p-3"
                       onClick={(e) => e.stopPropagation()}>
                    <div className="text-sm font-semibold text-white">Available Balance: <span className="text-green-400">${balance.toFixed(2)}</span></div>
                    <input
                      type="number"
                      value={orderAmount || ""}
                      onChange={(e) => setOrderAmount(parseFloat(e.target.value))}
                      placeholder="Enter amount in USD"
                      className="w-full border border-gray-600 bg-gray-800 text-white rounded px-3 py-2 placeholder-gray-400"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">Margin %</label>
                        <input
                          type="number"
                          value={marginPercent}
                          onChange={(e) => setMarginPercent(parseFloat(e.target.value))}
                          placeholder="2"
                          min="0.1"
                          max="10"
                          step="0.1"
                          className="w-full border border-gray-600 bg-gray-800 text-white rounded px-2 py-1 text-sm placeholder-gray-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Hold Time (sec)</label>
                        <input
                          type="number"
                          value={holdTime}
                          onChange={(e) => setHoldTime(parseInt(e.target.value))}
                          placeholder="20"
                          min="5"
                          max="300"
                          className="w-full border border-gray-600 bg-gray-800 text-white rounded px-2 py-1 text-sm placeholder-gray-400"
                        />
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded py-2 transition-colors font-semibold"
                              onClick={() => placeOrder("buy", s)}>BUY</button>
                      <button className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded py-2 transition-colors font-semibold"
                              onClick={() => placeOrder("sell", s)}>SELL</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {activeOrders.length > 0 && (
        <div className="max-w-7xl mx-auto p-6">
          <h2 className="font-bold mb-3 text-white text-xl">Active Orders</h2>
          {activeOrders.map((order) => {
            const currentPrice = prices[order.symbol];
            const entryPrice = typeof order.entry_price === 'string' ? parseFloat(order.entry_price) : order.entry_price;
            const { pnl, pnlPercent, finalValue } = calculateOrderValue(order, currentPrice || entryPrice);
            const timeLeft = Math.max(0, Math.floor((order.expiry - Date.now()) / 1000));
            return (
              <div key={order.id} className="p-4 border border-gray-700 rounded-lg bg-gray-800 shadow-sm mb-3">
                <div className="flex justify-between">                  
                  <div>
                    <div className="font-bold text-white">{order.type.toUpperCase()} {order.symbol}</div>
                    <div className="text-sm text-gray-300">
                      Entry: <span className="text-blue-400">${toNumber(order.entry_price).toFixed(2)}</span> | Current: <span className="text-yellow-400">${currentPrice?.toFixed(2) || "..."}</span>
                    </div>
                    <div className="text-sm text-gray-300">
                      Amount: <span className="text-white">${toNumber(order.order_amount).toFixed(2)}</span> | Est. Return: <span className="text-white">${finalValue.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-gray-300">Quantity: <span className="text-white">{toNumber(order.quantity).toFixed(6)}</span></div>
                    <div className="text-sm text-gray-300">
                      TP: <span className="text-green-400">${toNumber(order.take_profit_price).toFixed(2)}</span> | SL: <span className="text-red-400">${toNumber(order.stop_loss_price).toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-gray-300">
                      Time left: <span className="text-orange-400">{timeLeft}s</span> | Status: <span className="font-medium text-blue-400">ACTIVE</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-lg ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </div>
                    <div className={`text-sm ${pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                    </div>
                    <button 
                      onClick={() => closeOrder(order.id)}
                      className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition-colors font-semibold"
                    >
                      Close Order
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order History */}
      {showHistory && orderHistory.length > 0 && (
        <div className="max-w-7xl mx-auto p-6">
          <h2 className="font-bold mb-3 text-white text-xl">Order History</h2>
          {orderHistory.map((order) => {
            const entryPrice = toNumber(order.entry_price);
            const exitPrice = order.exit_price ? toNumber(order.exit_price) : entryPrice;
            const pnl = order.pnl ? toNumber(order.pnl) : 0;
            const orderAmount = toNumber(order.order_amount);
            const pnlPercent = orderAmount > 0 ? (pnl / orderAmount) * 100 : 0;
            
            const getStatusDisplay = (status: string) => {
              switch (status) {
                case 'take_profit': return { text: 'TAKE PROFIT', color: 'text-green-400' };
                case 'stop_loss': return { text: 'STOP LOSS', color: 'text-red-400' };
                case 'expired_executed': return { text: 'EXPIRED (AUTO)', color: 'text-orange-400' };
                case 'manually_closed': return { text: 'MANUALLY CLOSED', color: 'text-blue-400' };
                default: return { text: status.toUpperCase(), color: 'text-gray-400' };
              }
            };
            
            const statusDisplay = getStatusDisplay(order.status || 'unknown');
            
            return (
              <div key={order.id} className="p-4 border border-gray-700 rounded-lg bg-gray-800 shadow-sm mb-3">
                <div className="flex justify-between">
                  <div>
                    <div className="font-bold text-white">{order.type.toUpperCase()} {order.symbol}</div>
                    <div className="text-sm text-gray-300">
                      Entry: <span className="text-blue-400">${entryPrice.toFixed(2)}</span> | Exit: <span className="text-yellow-400">${exitPrice.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-gray-300">
                      Amount: <span className="text-white">${orderAmount.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-gray-300">Quantity: <span className="text-white">{toNumber(order.quantity).toFixed(6)}</span></div>
                    <div className="text-sm text-gray-300">
                      TP: <span className="text-green-400">${toNumber(order.take_profit_price).toFixed(2)}</span> | SL: <span className="text-red-400">${toNumber(order.stop_loss_price).toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-gray-300">
                      Status: <span className={`font-medium ${statusDisplay.color}`}>{statusDisplay.text}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-lg ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </div>
                    <div className={`text-sm ${pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
