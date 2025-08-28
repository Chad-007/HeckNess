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
  take_profit_price: string | number;
  stop_loss_price: string | number;
  leverage: string | number;
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
      background: "#0a0a0a", 
      toolbar: { show: false },
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    },
    theme: { mode: "dark" },
    grid: { 
      borderColor: "#1a1a1a", 
      strokeDashArray: 1,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } }
    },
    xaxis: {
      type: "datetime",
      labels: { 
        style: { colors: "#888", fontSize: "11px" }, 
        format: "HH:mm" 
      },
      axisBorder: { color: "#333" },
      axisTicks: { color: "#333" }
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: {
        style: { colors: "#888", fontSize: "11px" },
        formatter: (v: number) => `$${v.toFixed(2)}`,
      },
    },
    plotOptions: {
      candlestick: {
        colors: { upward: "#00ff88", downward: "#ff4444" },
        wick: { useFillColor: true },
      },
    },
  };

  return (
    <div className="bg-black border border-gray-800 rounded">
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-white font-light text-lg tracking-wide">
          {candles[0]?.symbol || "CHART"}
        </h3>
      </div>
      <div className="p-2">
        <Chart options={options} series={[{ data: chartData }]} type="candlestick" height={400} />
      </div>
    </div>
  );
};

export default function HomePage() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [interval, setIntervalState] = useState("1 minute");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [leverage, setLeverage] = useState<number>(2);
  const [prices, setPrices] = useState<Record<string, number>>({ BTCUSDT: 0, ETHUSDT: 0, SOLUSDT: 0 });
  const [orderAmount, setOrderAmount] = useState<number>(100);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [orderHistory, setOrderHistory] = useState<ActiveOrder[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const router = useRouter();  
  
  const toNumber = (value: string | number): number => {
    return typeof value === 'string' ? parseFloat(value) : value;
  };

  const calculatePortfolioValue = () => {
    let positionValue = 0;
    activeOrders.forEach(order => {
      const currentPrice = prices[order.symbol];
      if (currentPrice) {
        const entryPrice = toNumber(order.entry_price);
        const quantity = toNumber(order.quantity);
        const margin = toNumber(order.order_amount);
        
        let pnl = 0;
        if (order.type === "buy") {
          pnl = (currentPrice - entryPrice) * quantity;
        } else {
          pnl = (entryPrice - currentPrice) * quantity;
        }
        
        positionValue += margin + pnl;
      }
    });
    return cashBalance + positionValue;
  };

  const totalPortfolioValue = calculatePortfolioValue();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
    } else {
      fetchOrders();
      fetchBalance();
      fetchOrderHistory();
    }
  }, [router]);
  
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

  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3005/balance", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCashBalance(parseFloat(data.balance));
      }
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  };

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
        alert(`Order closed! PnL: $${data.pnl.toFixed(2)}`);
        fetchOrders();
        fetchBalance();
        fetchOrderHistory();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      console.error("Error closing order:", err);
      alert("Error closing order");
    }
  };

  const placeOrder = async (type: "buy" | "sell") => {
    if (!orderAmount || orderAmount <= 0) return alert("Enter valid amount");
    if (cashBalance < orderAmount) return alert("Insufficient balance");
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3005/placeorder", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol, type, orderAmount, leverage }), 
      });
      if (!res.ok) throw new Error("Order failed");
      
      fetchOrders();
      fetchBalance();
      setOrderAmount(100);
    } catch (err) {
      console.error(err);
      alert("Error placing order");
    }
  };

  const calculateOrderPnL = (order: ActiveOrder, currentPrice: number) => {
    const entryPrice = toNumber(order.entry_price);
    const quantity = toNumber(order.quantity);
    const margin = toNumber(order.order_amount);
    
    let pnl = 0;
    if (order.type === "buy") {
      pnl = (currentPrice - entryPrice) * quantity;
    } else {
      pnl = (entryPrice - currentPrice) * quantity;
    }
    
    const currentValue = margin + pnl;
    const pnlPercent = margin > 0 ? (pnl / margin) * 100 : 0;
    return { pnl, pnlPercent, currentValue };
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

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchOrders();
      fetchBalance();
    }, 2000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  return (
    <div className="min-h-screen text-white" style={{ 
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    }}>
      <div className="border-b border-gray-700 p-8" style={{
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-8">
            <h1 className="text-4xl font-extralight tracking-[0.3rem] text-white uppercase" style={{
              textShadow: '0 2px 10px rgba(255,255,255,0.1)',
            }}>{symbol}</h1>
            <span className="text-3xl font-mono text-green-400 font-light" style={{
              textShadow: '0 2px 10px rgba(0,255,136,0.3)',
            }}>
              ${prices[symbol]?.toFixed(2) || "0.00"}
            </span>
          </div>
          <div className="flex items-center space-x-8">
            <select 
              value={symbol} 
              onChange={(e) => setSymbol(e.target.value)} 
              className="bg-black text-white border-2 border-gray-700 px-6 py-3 rounded-sm outline-none hover:border-white transition-all duration-300 text-lg font-light"
              style={{ fontFamily: '"Inter", "Helvetica", "Arial", sans-serif' }}
            >
              {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select 
              value={interval} 
              onChange={(e) => setIntervalState(e.target.value)} 
              className="bg-black text-white border-2 border-gray-700 px-6 py-3 rounded-sm outline-none hover:border-white transition-all duration-300 text-lg font-light"
              style={{ fontFamily: '"Inter", "Helvetica", "Arial", sans-serif' }}
            >
              {intervals.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <div className="text-right">
              <div className="text-sm text-gray-400 uppercase tracking-wider font-light">Cash Balance</div>
              <div className="text-xl font-light text-white">${cashBalance.toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400 uppercase tracking-wider font-light">Total Portfolio</div>
              <div className="text-xl font-light text-green-400">${totalPortfolioValue.toFixed(2)}</div>
            </div>
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchOrderHistory();
              }}
              className="bg-black text-white border-2 border-gray-700 px-6 py-3 hover:bg-white hover:text-black transition-all duration-300 uppercase tracking-wide text-lg font-light rounded-sm"
            >
              History
            </button>
            <button
              className="bg-black text-white border-2 border-gray-700 px-6 py-3 hover:bg-white hover:text-black transition-all duration-300 uppercase tracking-wide text-lg font-light rounded-sm"
              onClick={() => { localStorage.clear(); router.push("/login"); }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <CandlestickChart candles={candles} />
        </div>
        <div className="bg-black border border-gray-800 rounded p-6">
          <h3 className="text-lg font-light mb-6 text-center uppercase tracking-widest text-white">Trade {symbol}</h3>
          
          <div className="space-y-6">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Margin ($)</label>
              <input
                type="number"
                value={orderAmount}
                onChange={(e) => setOrderAmount(parseFloat(e.target.value))}
                className="w-full bg-transparent text-white border-b border-gray-700 py-3 outline-none focus:border-white transition-colors text-lg"
                style={{ fontFamily: '"Inter", "Helvetica", "Arial", sans-serif' }}
              />
            </div>
            
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Leverage (TP: +2% | SL: -2%)</label>
              <input
                type="number"
                value={leverage}
                onChange={(e) => setLeverage(parseFloat(e.target.value))}
                min="1"
                max="20"
                step="0.5"
                className="w-full bg-transparent text-white border-b border-gray-700 py-3 outline-none focus:border-white transition-colors text-lg"
                style={{ fontFamily: '"Inter", "Helvetica", "Arial", sans-serif' }}
              />
            </div>
            
            <div className="space-y-2 pt-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Price: <span className="text-white">${prices[symbol]?.toFixed(2) || "0.00"}</span>
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Position Size: <span className="text-white">${prices[symbol] ? (orderAmount * leverage).toFixed(2) : "0.00"}</span>
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Quantity: <span className="text-white">{prices[symbol] ? ((orderAmount * leverage) / prices[symbol]).toFixed(6) : "0.000000"}</span>
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Take Profit: <span className="text-green-400">${prices[symbol] ? (prices[symbol] * 1.02).toFixed(2) : "0.00"}</span>
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Stop Loss: <span className="text-red-400">${prices[symbol] ? (prices[symbol] * 0.98).toFixed(2) : "0.00"}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-6">
              <button 
                onClick={() => placeOrder("buy")}
                className="bg-black text-white border border-gray-700 py-4 hover:bg-white hover:text-black transition-all duration-300 font-light uppercase tracking-widest"
              >
                Buy
              </button>
              <button 
                onClick={() => placeOrder("sell")}
                className="bg-black text-white border border-gray-700 py-4 hover:bg-white hover:text-black transition-all duration-300 font-light uppercase tracking-widest"
              >
                Sell
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {activeOrders.length > 0 && (
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-black border border-gray-800 rounded p-6">
            <h2 className="text-2xl font-light mb-6 uppercase tracking-wider text-white">Active Positions</h2>
            <div className="space-y-4">
              {activeOrders.map((order) => {
                const currentPrice = prices[order.symbol];
                const { pnl, pnlPercent } = calculateOrderPnL(order, currentPrice || toNumber(order.entry_price));
                const leverage = toNumber(order.leverage);
                const margin = toNumber(order.order_amount);
                const positionSize = margin * leverage;
                
                return (
                  <div 
                    key={order.id} 
                    className="bg-gray-900/50 border border-gray-700/50 rounded p-6 backdrop-blur-sm"
                    style={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded font-bold text-sm uppercase tracking-wide ${
                            order.type === "buy" ? "bg-green-600/80 text-white" : "bg-red-600/80 text-white"
                          }`}>
                            {order.type}
                          </span>
                          <span className="text-white font-light text-lg tracking-wide">{order.symbol}</span>
                          <span className="text-blue-400 text-sm font-light">{leverage}x</span>
                        </div>
                        <div className="text-sm text-gray-400 space-y-1">
                          <div>Entry: <span className="text-white">${toNumber(order.entry_price).toFixed(2)}</span></div>
                          <div>Current: <span className="text-white">${currentPrice?.toFixed(2) || "..."}</span></div>
                          <div>Margin: <span className="text-white">${margin.toFixed(2)}</span></div>
                          <div>Position Size: <span className="text-white">${positionSize.toFixed(2)}</span></div>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>TP: <span className="text-green-400">${toNumber(order.take_profit_price).toFixed(2)}</span></div>
                          <div>SL: <span className="text-red-400">${toNumber(order.stop_loss_price).toFixed(2)}</span></div>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className={`text-2xl font-light ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </div>
                        <div className={`text-lg ${pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                        </div>
                        <button 
                          onClick={() => closeOrder(order.id)}
                          className="bg-black text-white border border-gray-700 px-4 py-2 hover:bg-white hover:text-black transition-all duration-300 text-sm uppercase tracking-wide"
                        >
                          Close Position
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showHistory && orderHistory.length > 0 && (
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-black border border-gray-800 rounded p-6">
            <h2 className="text-2xl font-light mb-6 uppercase tracking-wider text-white">Order History</h2>
            <div className="space-y-4">
              {orderHistory.map((order) => {
                const pnl = order.pnl ? toNumber(order.pnl) : 0;
                const margin = toNumber(order.order_amount);
                const leverage = toNumber(order.leverage);
                const pnlPercent = margin > 0 ? (pnl / margin) * 100 : 0;
                const positionSize = margin * leverage;
                
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'take_profit': return 'bg-green-700/80';
                    case 'stop_loss': return 'bg-red-700/80';
                    case 'liquidated': return 'bg-red-900/80';
                    case 'manually_closed': return 'bg-blue-700/80';
                    default: return 'bg-gray-700/80';
                  }
                };
                
                return (
                  <div 
                    key={order.id} 
                    className="bg-gray-900/30 border border-gray-700/30 rounded p-6 backdrop-blur-sm"
                    style={{
                      background: 'rgba(0, 0, 0, 0.5)',
                      backdropFilter: 'blur(5px)',
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded font-bold text-sm uppercase tracking-wide ${
                            order.type === "buy" ? "bg-green-600/60 text-white" : "bg-red-600/60 text-white"
                          }`}>
                            {order.type}
                          </span>
                          <span className="text-white font-light text-lg tracking-wide">{order.symbol}</span>
                          <span className="text-blue-400 text-sm font-light">{leverage}x</span>
                          <span className={`text-xs px-2 py-1 rounded text-white uppercase tracking-wide ${getStatusColor(order.status || 'unknown')}`}>
                            {order.status?.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 space-y-1">
                          <div>Entry: <span className="text-white">${toNumber(order.entry_price).toFixed(2)}</span></div>
                          <div>Exit: <span className="text-white">${order.exit_price ? toNumber(order.exit_price).toFixed(2) : "N/A"}</span></div>
                          <div>Margin: <span className="text-white">${margin.toFixed(2)}</span></div>
                          <div>Position Size: <span className="text-white">${positionSize.toFixed(2)}</span></div>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className={`text-2xl font-light ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </div>
                        <div className={`text-lg ${pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}