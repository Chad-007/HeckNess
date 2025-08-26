import { useEffect, useState } from "react";

export interface Trade {
  p: string;  // price
  q: string;  // quantity
  m: boolean; // market maker? true = sell
  T: number;  // trade time
}

export function useWebSocket(url: string) {
  const [messages, setMessages] = useState<Trade[]>([]);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => console.log("Connected to WebSocket");
    ws.onclose = () => console.log("Disconnected from WebSocket");
    ws.onmessage = (event) => {
      const data: Trade = JSON.parse(event.data);
      setMessages((prev) => [data, ...prev].slice(0, 50)); // keep last 50 trades
    };

    return () => ws.close();
  }, [url]);

  return messages;
}
