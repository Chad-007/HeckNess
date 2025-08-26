"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const WebSocket = require("ws");
const pg = require("pg");
const Redis = require("ioredis");
const { Pool } = pg;
const app = express();
app.use(express.json());
// @ts-ignore
const redisSubscriber = new Redis({ host: "127.0.0.1", port: 6380 });
const pool = new Pool({
    user: "alan",
    host: "127.0.0.1",
    database: "alantsdb",
    password: "alanpass",
    port: 5433,
});
const wss = new WebSocket.Server({ port: 3006 });
const clients = [];
wss.on("connection", (ws) => {
    console.log("Client connected");
    clients.push(ws);
    ws.on("close", () => {
        console.log("Client disconnected");
        const idx = clients.indexOf(ws);
        if (idx !== -1)
            clients.splice(idx, 1);
    });
});
// @ts-ignore
redisSubscriber.subscribe("trades", (err, count) => {
    if (err)
        console.error("Redis subscribe failed:", err);
    else
        console.log(`Subscribed to ${count} channel(s).`);
});
// @ts-ignore
redisSubscriber.on("message", async (_chafromnnel, message) => {
    const trade = JSON.parse(message);
    console.log("Trade received via Redis:", trade);
    try {
        await pool.query(`INSERT INTO trades (trade_id, symbol, price, quantity, side, trade_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (trade_id) DO NOTHING`, [trade.t, trade.s, parseFloat(trade.p), parseFloat(trade.q), trade.m ? "sell" : "buy", new Date(trade.T)]);
    }
    catch (err) {
        console.error("DB insert error:", err);
    }
    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify(trade));
    });
});
app.get("/trades", async (req, res) => {
    const { start, end } = req.query;
    try {
        const result = await pool.query(`SELECT * FROM trades WHERE trade_time BETWEEN $1 AND $2 ORDER BY trade_time DESC`, [start, end]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).send("DB error");
    }
});
app.get("/candles", async (req, res) => {
    const { interval = "1 minute", duration = "1 hour" } = req.query;
    try {
        const result = await pool.query(`SELECT time_bucket($1, trade_time) AS bucket,
              FIRST(price, trade_time) AS open,
              MAX(price) AS high,
              MIN(price) AS low,
              LAST(price, trade_time) AS close,
              SUM(quantity) AS volume
       FROM trades
       WHERE trade_time >= NOW() - $2::interval
       GROUP BY bucket
       ORDER BY bucket`, [interval, duration]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).send("error");
    }
});
app.listen(3000);
//# sourceMappingURL=index.js.map