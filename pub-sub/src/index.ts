import express   = require("express");
import WebSocket = require("ws");
import Redis  =  require("ioredis");
const app = express();
app.use(express.json());
const redis: Redis.Redis = new Redis.default({
  host: "127.0.0.1",
  port: 6380,
})

const binanceSocket = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");
binanceSocket.on("message", async (data) => {
  const trade = JSON.parse(data.toString());
  try {
    await redis.publish("trades", JSON.stringify(trade));
  } catch (err) {
    console.error(err);
  }
});
