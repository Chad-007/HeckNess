"use client";
import { useEffect, useState } from "react";
import axios from "axios";

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

export default function HomePage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3006");
    ws.onopen = () => console.log("Connected to WebSocket");
    ws.onclose = () => console.log("Disconnected from WebSocket");
    ws.onmessage = (event) => {
      const data: Trade = JSON.parse(event.data);
      if (data) setTrades((prev) => [data, ...prev].slice(0, 50));
    };
    return () => ws.close();
  }, []);
  const fetchCandles = async () => {
  try {
    const interval = encodeURIComponent("5 minutes");
    const duration = encodeURIComponent("1 hour");
    const res = await axios.get<Candle[]>(
      `http://localhost:3000/candles?interval=${interval}&duration=${duration}`
    );
    setCandles(res.data);
  } catch (err) {
    console.error("Error fetching candles:", err);
  }
};

  useEffect(() => {
    fetchCandles();
    const interval = setInterval(fetchCandles, 60 * 1000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Live BTC/USDT Trades</h1>
      <table
        style={{ borderCollapse: "collapse", width: "100%", marginTop: "1rem" }}
      >
        <thead>
          <tr style={{ backgroundColor: "#eee" }}>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Price</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Quantity</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Side</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, idx) => (
            <tr
              key={idx}
              style={{
                backgroundColor: trade.m ? "#ffe5e5" : "#e5ffe5",
                color: "#000",
              }}
            >
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{trade.p}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{trade.q}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                {trade.m ? "Sell" : "Buy"}
              </td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                {new Date(trade.T).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h1 style={{ marginTop: "2rem" }}>BTC/USDT 5-Minute Candles</h1>
      <table
        style={{ borderCollapse: "collapse", width: "100%", marginTop: "1rem" }}
      >
        <thead>
          <tr style={{ backgroundColor: "#eee" }}>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Time</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Open</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>High</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Low</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Close</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Volume</th>
          </tr>
        </thead>
        <tbody>
          {candles.map((c, idx) => (
            <tr key={idx}>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                {new Date(c.bucket).toLocaleTimeString()}
              </td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{c.open_price}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{c.high_price}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{c.low_price}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{c.close_price}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{c.volume}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
