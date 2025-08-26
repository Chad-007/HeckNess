"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Trade {
  p: string;
  q: string;
  m: boolean;
  T: number;
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

const intervals = ["30 seconds", "5 minutes", "10 minutes", "30 minutes"];

const CandlestickChart = ({ candles }: { candles: Candle[] }) => {
  const chartData = useMemo(() => {
    return candles.map(candle => ({
      x: new Date(candle.bucket).getTime(),
      y: [
        parseFloat(candle.open_price),
        parseFloat(candle.high_price),
        parseFloat(candle.low_price),
        parseFloat(candle.close_price)
      ]
    }));
  }, [candles]);

  const volumeData = useMemo(() => {
    return candles.map(candle => ({
      x: new Date(candle.bucket).getTime(),
      y: parseFloat(candle.volume)
    }));
  }, [candles]);

  const options = {
    chart: {
      type: 'candlestick' as const,
      height: 400,
      background: 'transparent',
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      }
    },
    theme: {
      mode: 'dark' as const
    },
    grid: {
      borderColor: '#1f2937',
      strokeDashArray: 0,
      position: 'back' as const,
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      }
    },
    xaxis: {
      type: 'datetime' as const,
      labels: {
        style: {
          colors: '#9ca3af',
          fontSize: '11px'
        },
        format: 'HH:mm'
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      tooltip: {
        enabled: true
      },
      labels: {
        style: {
          colors: '#9ca3af',
          fontSize: '11px'
        },
        formatter: (value: number) => `$${value.toFixed(2)}`
      }
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#00d4aa',
          downward: '#ff4560'
        },
        wick: {
          useFillColor: true
        }
      }
    },
    tooltip: {
      theme: 'dark',
      style: {
        fontSize: '12px'
      },
      custom: ({ seriesIndex, dataPointIndex, w }: { 
        seriesIndex: number; 
        dataPointIndex: number; 
        w: { globals: { seriesCandleO: number[][]; seriesCandleH: number[][]; seriesCandleL: number[][]; seriesCandleC: number[][]; seriesX: number[][]; } }; 
      }) => {
        const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
        const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
        const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
        const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
        
        return `
          <div class="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm">
            <div class="text-gray-300 mb-2 font-medium">
              ${new Date(w.globals.seriesX[seriesIndex][dataPointIndex]).toLocaleString()}
            </div>
            <div class="space-y-1">
              <div class="flex justify-between"><span class="text-gray-400">Open:</span> <span class="text-white">$${o?.toFixed(2)}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">High:</span> <span class="text-green-400">$${h?.toFixed(2)}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Low:</span> <span class="text-red-400">$${l?.toFixed(2)}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Close:</span> <span class="text-white">$${c?.toFixed(2)}</span></div>
            </div>
          </div>
        `;
      }
    }
  };

  const volumeOptions = {
    chart: {
      type: 'bar' as const,
      height: 120,
      background: 'transparent',
      toolbar: {
        show: false
      }
    },
    theme: {
      mode: 'dark' as const
    },
    grid: {
      borderColor: '#1f2937',
      strokeDashArray: 0,
      show: false
    },
    xaxis: {
      type: 'datetime' as const,
      labels: {
        show: false
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#9ca3af',
          fontSize: '10px'
        },
        formatter: (value: number) => value.toFixed(2)
      }
    },
    plotOptions: {
      bar: {
        colors: {
          ranges: [{
            from: 0,
            to: 999999,
            color: '#374151'
          }]
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (value: number) => `${value.toFixed(4)} BTC`
      }
    }
  };

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-lg font-medium text-white">BTC/USDT</h3>
      </div>
      <div className="p-4">
        <Chart
          options={options}
          series={[{ data: chartData }]}
          type="candlestick"
          height={400}
        />
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="text-sm text-gray-400 mb-2">Volume</div>
          <Chart
            options={volumeOptions}
            series={[{ name: 'Volume', data: volumeData }]}
            type="bar"
            height={120}
          />
        </div>
      </div>
    </div>
  );
};

export default function HomePage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [interval, setIntervalState] = useState("30 seconds");
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3006");
    ws.onmessage = (event) => {
      const data: Trade = JSON.parse(event.data);
      setTrades((prev) => [data, ...prev].slice(0, 50));
      setCurrentPrice(parseFloat(data.p));
    };
    return () => ws.close();
  }, []);

  const fetchCandles = useCallback(async () => {
    try {
      const duration = encodeURIComponent("1 hour");
      const res = await fetch(
        `http://localhost:3000/candles?interval=${encodeURIComponent(
          interval
        )}&duration=${duration}`
      );
      const data = await res.json();
      setCandles(data);
    } catch (err) {
      console.error("Error fetching candles:", err);
    }
  }, [interval]);

  useEffect(() => {
    fetchCandles();
    const intervalId = setInterval(fetchCandles, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchCandles]);

  const formatPrice = (price: string) => {
    return parseFloat(price).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const priceChange = useMemo(() => {
    if (candles.length < 2) return { change: 0, percentage: 0 };
    const latest = parseFloat(candles[candles.length - 1]?.close_price || "0");
    const previous = parseFloat(candles[candles.length - 2]?.close_price || "0");
    const change = latest - previous;
    const percentage = (change / previous) * 100;
    return { change, percentage };
  }, [candles]);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">₿</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">BTC/USDT</h1>
              <div className="flex items-center space-x-3">
                <span className="text-lg font-mono text-white">
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  priceChange.change >= 0 
                    ? 'bg-green-500/10 text-green-400' 
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {priceChange.change >= 0 ? '+' : ''}{priceChange.change.toFixed(2)} ({priceChange.percentage.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={interval}
              onChange={(e) => setIntervalState(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-gray-600"
            >
              {intervals.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Chart Section */}
          <div className="lg:col-span-3">
            <CandlestickChart candles={candles} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Market Stats */}
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Market Stats</h3>
              {candles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">24h High</span>
                    <span className="text-xs text-green-400 font-mono">
                      ${Math.max(...candles.map(c => parseFloat(c.high_price))).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">24h Low</span>
                    <span className="text-xs text-red-400 font-mono">
                      ${Math.min(...candles.map(c => parseFloat(c.low_price))).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Volume</span>
                    <span className="text-xs text-gray-300 font-mono">
                      {candles.reduce((sum, c) => sum + parseFloat(c.volume), 0).toFixed(2)} BTC
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Live Trades */}
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-400">Live Trades</h3>
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-500">LIVE</span>
                  </div>
                </div>
              </div>
              
              <div className="h-80 overflow-y-auto">
                <div className="p-2">
                  {trades.map((trade, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded text-xs ${
                        idx === 0 ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-1 h-1 rounded-full ${
                          trade.m ? 'bg-red-500' : 'bg-green-500'
                        }`}></div>
                        <span className={`font-mono ${
                          trade.m ? 'text-red-400' : 'text-green-400'
                        }`}>
                          ${formatPrice(trade.p)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-400">
                          {parseFloat(trade.q).toFixed(4)}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {new Date(trade.T).toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}