"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const WebSocket = require("ws");
const Redis = require("ioredis");
const app = express();
app.use(express.json());
const redis = new Redis.default({
    host: "127.0.0.1",
    port: 6380,
});
const mainWs = new WebSocket("ws://localhost:3006");
mainWs.on("open", () => {
    console.log("Connected to main WebSocket server");
});
const binanceSocket = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");
binanceSocket.on("message", async (data) => {
    const trade = JSON.parse(data.toString());
    try {
        await redis.publish("trades", JSON.stringify(trade));
        if (mainWs.readyState === WebSocket.OPEN) {
            mainWs.send(JSON.stringify(trade));
        }
    }
    catch (err) {
        console.error("Error inserting/publishing trade:", err);
    }
});
//# sourceMappingURL=index.js.map