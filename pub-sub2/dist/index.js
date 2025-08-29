"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const pg = require("pg");
const Redis = require("ioredis");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { Pool } = pg;
const app = express();
app.use(express.json());
app.use(cors());
const pool = new Pool({
    user: "alan",
    host: "127.0.0.1",
    database: "alantsdb",
    password: "alanpass",
    port: 5433,
});
const latestPrices = {};
const redis = new Redis.default({
    host: "127.0.0.1",
    port: 6380
});
function auth(req, res, next) {
    const header = req.headers["authorization"];
    try {
        if (!header) {
            return res.status(401).json({ message: "fuck you" });
        }
        const token = header.split(" ")[1];
        const user = jwt.verify(token, "secretkey");
        req.user = user;
        next();
    }
    catch (error) {
        res.status(401).json({ message: "hey there" });
    }
}
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    try {
        const rows = await pool.query("SELECT * from users where username = $1", [username]);
        if (rows.rows.length > 0) {
            return res.status(401).json({ message: "hey there the user already exist" });
        }
        const hash = bcrypt.hash(password, 10);
        const result = await pool.query("INSERT INTO username (username,password,balance) VALUES ($1,$2,$3)", [username, hash, 1000]);
        return res.json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ message: "some error happens" });
    }
});
app.post("/signin", async (req, res) => {
    const { username, password } = req.body;
    try {
        const rows = await pool.query("SELECT * from users where username = $1", [username]);
        if (rows.rows.length === 0) {
            return res.status(401).json({ message: "the user doesnt exist try signing up again" });
        }
        const user = rows.rows[0];
        const token = jwt.sign({ id: user.id, username: user.username }, "secretkey", { expiresIn: "1h" });
        return res.json({ token, username: user.username, balance: user.balance });
    }
    catch (err) {
        return res.status(401).json({ message: "some error happened" });
    }
});
app.post("/placeorder", auth, async (req, res) => {
    const { symbol, type, orderAmount, leverage } = req.body;
    const user = req.user;
    try {
        const margin = parseFloat(orderAmount);
        const lev = parseFloat(leverage);
        const rows = await pool.query("SELECT balance from user where id = $1", [user.id]);
        const balance = parseFloat(rows.rows[0].balance);
        if (balance < margin)
            return res.status(401).json({ message: "insufficient fund" });
        //replace this
        const entry_price = 1; // latestPrices[symbol];
        const positionSize = margin * lev;
        const quantity = positionSize / entry_price;
        await pool.query("UPDATE users set balance = balance - $1 where id = $2", [margin, user.id]);
        const tpPrice = type === "buy" ? entry_price + 10 : entry_price - 10;
        const slprice = type === "buy" ? entry_price - 10 : entry_price + 10;
        const orders = await pool.query("INSERT into order (user_id,symbol,type,entry_price,quantity,order_amount,take_profit_price,stop_loss_price,leverage,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *", [user.id, symbol, entry_price, quantity, margin, tpPrice, slprice, lev, "active"]);
        console.log(`order placed : ${type} ${symbol} at ${entry_price},TP:${tpPrice},SL:${slprice}`);
        res.json(orders.rows[0]);
    }
    catch (error) {
        res.status(401).json({ message: "the message baby" });
    }
});
app.post("/orders", auth, async (req, res) => {
    const user = req.user;
    try {
        const orders = await pool.query("SELECT * from order where id = $1", [user.id]);
        res.json(orders.rows);
    }
    catch (error) {
        res.status(401).json({ message: "there was some issues with fetching the orders" });
    }
});
app.get("/balance", auth, async (req, res) => {
    const user = req.user;
    try {
        const balances = await pool.query("SELECT balance from users where id = $1", [user.id]);
        const balance = parseFloat(balances.rows[0]);
        res.json({ balance });
    }
    catch (error) {
        res.status(401).json({ message: "there is some issue man" });
    }
});
app.get("/order-history", auth, async (req, res) => {
    const user = req.user;
    try {
        const order = await pool.query("SELECT * from order where user_id=  $1 and STATUS IN('take_profit','stop_loss','liquidation','manually_closed') ORDER BY  created_at DESC LIMIT 50", [user.id]);
        res.json(order.rows);
    }
    catch (error) {
        res.status(401).json({ message: "nothing to see here mate" });
    }
});
app.post("/close-order", auth, async (req, res) => {
    const orderid = req.body;
    const user = req.user;
    try {
        const orders = await pool.query("SELECT * from users where id = $1 and user_id  = $2 and status='active'", [orderid, user.id]);
        if (orders.rows.length === 0) {
            return res.status(500).json({ message: "no such order exists here" });
        }
        const order = orders.rows[0];
        const margin = order.margin;
        const entry_price = order.entry_price;
        const quantity = order.quantity;
        const currentPrice = latestPrices[order.symbol];
        if (!currentPrice) {
            return res.status(401).json({ message: "there is not current price that exist right now" });
        }
        let pnl = 0;
        if (order.type === "buy") {
            pnl = (currentPrice - entry_price) * quantity;
        }
        else {
            pnl = (entry_price - currentPrice) * quantity;
        }
        const returnToBalance = margin + pnl;
        await pool.query("UPDATE users SET balance = balance + $1", [returnToBalance]);
        await pool.query("UPDATE orders set status = 'manually_closed',exit_price = $1,pnl = $2 WHERE id = $3", [currentPrice, pnl, orderid]);
        res.json({ message: "the order was closed succesfully" });
    }
    catch (err) {
        res.json(401).json({ message: "the was some issue with closing the order" });
    }
});
redis.subscribe("trades", (err, count) => {
    if (err)
        console.error("there was issue with subcribing to redis");
    else
        console.log(`subscribed to ${count} channel`);
});
redis.on("message", async (channel, message) => {
    const trade = JSON.parse(message);
    const price = parseFloat(trade.p);
    const symbol = trade.s;
    latestPrices[symbol] = price;
    const orders = await pool.query("SELECT * order WHERE symbol = $1 and status = 'active'", [symbol]);
    for (const order of orders.rows) {
        const entry_price = parseFloat(order.entry_price);
        const tpprice = parseFloat(order.take_profit_price);
        const slprice = parseFloat(order.stop_loss_price);
        const quantity = parseFloat(order.quantity);
        const leverage = parseFloat(order.leverage);
        const margin = parseFloat(order.margin);
        let shouldClose = false;
        let closeReason = "";
        let exitPrice = price;
        let pnl = 0;
        if (order.price === "buy") {
            pnl = (price - entry_price) * quantity;
        }
        else {
            pnl = (entry_price - price) * quantity;
        }
        const liquidationThreshold = 0.9 * margin;
        if (pnl <= -liquidationThreshold) {
            shouldClose = true;
            closeReason = "liquidated";
            exitPrice = price;
        }
        else if (order.type === "buy") {
            if (price >= tpprice) {
                shouldClose = true;
                closeReason = "take_profit";
                exitPrice = price;
            }
            else if (price <= slprice) {
                shouldClose = true;
                closeReason = "stop_loss";
                exitPrice = price;
            }
        }
        else {
            if (price <= tpprice) {
                shouldClose = true;
                closeReason = "take_profit";
                exitPrice = price;
            }
            else if (price >= slprice) {
                shouldClose = true;
                closeReason = "stop_loss";
                exitPrice = price;
            }
        }
        if (!shouldClose)
            continue;
        if (order.type === "buy") {
            pnl = (exitPrice - entry_price) * quantity;
        }
        else {
            pnl = (entry_price - exitPrice) * quantity;
        }
        const returnToBalance = margin * pnl;
        const updated = await pool.query("UPDATE orders SET status=$1,exit_price=$2,pnl=$3 where id=$4 and status='active' RETURNING id", [closeReason, exitPrice, pnl, order.id]);
        if (updated.rows.length === 0) {
            continue;
        }
        await pool.query("UPDATE  users SET balance = balance+$1 where id = $2", [returnToBalance, order.user_id]);
    }
});
app.listen(3005);
//# sourceMappingURL=index.js.map