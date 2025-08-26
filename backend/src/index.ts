import express  = require("express");
import WebSocket = require("ws");
import pg   = require("pg");
import Redis  = require("ioredis")
const { Pool } = pg;

const app = express();
app.use(express.json());


// very complicated type logic 
const redis: Redis.Redis = new Redis.default({
  host: "127.0.0.1",
  port: 6380,
});


// connect to your timescaledb container
const pool = new Pool({
  user: "alan",
  host: "127.0.0.1",
  database: "alantsdb",
  password: "alanpass",
  port: 5433,
});

const wss = new WebSocket.Server({ port: 3005 });

wss.on("connection", (ws) => {
  console.log("client connected");

  const binanceSocket = new WebSocket(
    "wss://stream.binance.com:9443/ws/btcusdt@trade"
  );
  binanceSocket.on("message", async (data) => {
    const trade = JSON.parse(data.toString());
    console.log(trade)
    const tradeId = trade.t;
    const price = parseFloat(trade.p);
    const qty = parseFloat(trade.q);
    const time = new Date(trade.T);
    const side = trade.m ? "sell" : "buy";

    try {
      await pool.query(
        `INSERT INTO trades (trade_id, symbol, price, quantity, side, trade_time)
         VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT DO NOTHING`,
        [tradeId, trade.s, price, qty, side, time]
      );
      console.log("asd",trade);
      await redis.publish("trades", JSON.stringify(trade));
    } catch (err) {
      console.error(err);
    }
    ws.send(data.toString());
  });

  ws.on("close", () => {
    console.log("disconnected ");
    binanceSocket.close();
  });
});


app.get("/trades", async (req, res) => {
  const { start, end } = req.query;

  try {
    const result = await pool.query(
      `SELECT * FROM trades
       WHERE trade_time BETWEEN $1 AND $2
       ORDER BY trade_time DESC`,
      [start, end]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});


app.get("/candles", async (req, res) => {
  const { interval = "1 minute", duration = "1 hour" } = req.query;

  try {


 
    const result = await pool.query(
      `SELECT time_bucket($1, trade_time) AS bucket,
              FIRST(price, trade_time) AS open,
              MAX(price) AS high,
              MIN(price) AS low,
              LAST(price, trade_time) AS close,
              SUM(quantity) AS volume
       FROM trades
       WHERE trade_time >= NOW() - $2::interval
       GROUP BY bucket
       ORDER BY bucket`,
      [interval, duration]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("error");
  }
});


app.listen(3000);
