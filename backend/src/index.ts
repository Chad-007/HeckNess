  import express = require("express");
  import WebSocket = require("ws");
  import pg = require("pg");
  import Redis = require("ioredis");
  import cors = require("cors")

  const { Pool } = pg;
  const app = express();
  app.use(express.json());
  app.use(cors())


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
  const clients: WebSocket[] = [];  
  wss.on("connection", (ws) => {
    console.log("Client connected");
    clients.push(ws);
    ws.on("close", () => {
      console.log("Client disconnected");
      const idx = clients.indexOf(ws);
      if (idx !== -1) clients.splice(idx, 1); // push the clients to the ws
    });
  });

  // subbb buddy
  // @ts-ignore
  redisSubscriber.subscribe("trades", (err, count) => {
    if (err) console.error("Redis subscribe failed:", err);
    else console.log(`Subscribed to ${count} channel(s).`);
  });


  // @ts-ignore
  redisSubscriber.on("message", async (_chafromnnel, message) => {
    const trade = JSON.parse(message);
    console.log("trades received with redis", trade);
    try {
    await pool.query(
    `INSERT INTO trades1 (trade_id, symbol, price, quantity, side, trade_time)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (symbol, trade_id, trade_time) DO NOTHING`,
    [trade.t, trade.s, parseFloat(trade.p), parseFloat(trade.q), trade.m ? "sell" : "buy", new Date(trade.T)]
  );
    } catch (err) {
      console.error(err);
    }
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(trade));
    });
  });
  // app.get("/trades", async (req, res) => {
  //   const { start, end } = req.query;
  //   try {
  //     const result = await pool.query(
  //       `SELECT * FROM trades1 WHERE trade_time BETWEEN $1 AND $2 ORDER BY trade_time DESC`,
  //       [start, end]
  //     );
  //     res.json(result.rows);
  //   } catch (err) {
  //     console.error(err);
  //     res.status(500).send("error");
  //   }
  // });

  app.get("/candles", async (req, res) => {
    const { interval = "30 seconds", duration = "1 hour" } = req.query;
    const viewMap: { [key: string]: string } = {
    "1 minute": "trades1_1m",
    "5 minutes": "trades1_5m",
    "10 minutes": "trades1_10m",
    "30 minutes": "trades1_30m",
    };

    const view = viewMap[interval as string];
    if (!view) return res.status(400).send("not working");
    try {
      const result = await pool.query(
        `SELECT bucket, symbol, open_price, high_price, low_price, close_price, volume
        FROM ${view}
        WHERE bucket >= NOW() - $1::interval
        ORDER BY bucket`,
        [duration]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).send("error");
    }
  });
app.listen(3000);
