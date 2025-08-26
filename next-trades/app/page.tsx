"use client";
import { useEffect, useState } from "react";
interface Trade {
  p: string;  
  q: string; 
  m: boolean;
  T: number;
}
export default function HomePage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3006");
    ws.onopen = () => console.log("Connected to WebSocket");
    ws.onclose = () => console.log("Disconnected from WebSocket");
    ws.onmessage = (event) => {
      const data: Trade = JSON.parse(event.data);
      setTrades((prev) => [data, ...prev].slice(0, 50));
    };
    return () => ws.close();
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
      <td style={{ border: "1px solid #ccc", padding: "8px" }}>{trade.m ? "Sell" : "Buy"}</td>
      <td style={{ border: "1px solid #ccc", padding: "8px" }}>
        {new Date(trade.T).toLocaleTimeString()}
      </td>
    </tr>
  ))}
</tbody>

      </table>
    </div>
  );
}
