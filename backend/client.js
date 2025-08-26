const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:3005");
ws.on("open", () => console.log("Connected"));
ws.on("message", (msg) => console.log("Trade:", msg.toString()));
ws.on("close", () => console.log("Disconnected "));
