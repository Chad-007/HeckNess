import Redis  = require("ioredis")
import WebSocketServer = require("ws");
import WebSocket = require("ws");
// the redis part :)
// @ts-ignore
const redisSubscriber = new Redis({ host: "127.0.0.1", port: 6380 });
const wss = new WebSocket.Server({ port: 3006 });
wss.on("connection", (ws) => {
  console.log("client connected");
    //@ts-ignore
    redisSubscriber.subscribe("trades", (err, count) => {
    if (err) console.error("subscribe failed:", err);
    else console.log(`subscribed to ${count} channel(s).`);
    });
    //@ts-ignore
    redisSubscriber.on("message", (channel, message) => {
    const trade = JSON.parse(message);
    console.log("trade received via redis:", trade);
    ws.send(JSON.stringify(trade))
  }); 
});









