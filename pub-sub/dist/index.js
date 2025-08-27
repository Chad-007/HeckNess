"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const WebSocket = require("ws");
const Redis = require("ioredis");
const axios = require("axios");
const app = express();
app.use(express.json());
const redis = new Redis.default({
    host: "127.0.0.1",
    port: 6380,
});
// idk about this logic coudnt think of something better will change this if need to
const symbols = ["btcusdt", "ethusdt", "solusdt"];
symbols.forEach((symbol) => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);
    ws.on("message", async (data) => {
        const trade = JSON.parse(data.toString());
        try {
            await redis.publish("trades", JSON.stringify(trade));
        }
        catch (err) {
            console.error(err);
        }
    });
});
//# sourceMappingURL=index.js.map