import express = require("express");
import pg = require("pg");
import Redis = require("ioredis");
import cors = require("cors");
import jwt = require("jsonwebtoken");
import bcrypt = require("bcrypt");

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

const latestPrices: Record<string, number> = {};
//@ts-ignore
const redisSubscriber = new Redis({ host: "127.0.0.1", port: 6380 });
function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, "secretkey") as { id: number; username: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
}

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userCheck = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password_hash, balance) VALUES ($1, $2, $3) RETURNING id, username, balance",
      [username, hashed, 10000] 
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }
    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: "Invalid password" });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, "secretkey", { expiresIn: "1h" });
    res.json({ token, username: user.username, balance: user.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/placeorder", authMiddleware, async (req: any, res: any) => {
  const { symbol, type, orderAmount, leverage ,tpPrice,slPrice} = req.body;
  const user = req.user;
  try {
    const margin = parseFloat(orderAmount);
    const lev = parseFloat(leverage);
    if (!symbol || !type || isNaN(margin) || isNaN(lev) || margin <= 0 || lev <= 0) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const userRes = await pool.query("SELECT balance FROM users WHERE id=$1", [user.id]);
    const balance = parseFloat(userRes.rows[0].balance);
    if (balance < margin) return res.status(400).json({ error: "Insufficient balance" });

    const entryPrice = latestPrices[symbol];
    if (!entryPrice || !isFinite(entryPrice)) return res.status(400).json({ error: "No market price available" });

    const positionSize = margin * lev;
    const quantity = positionSize / entryPrice;
    await pool.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [margin, user.id]);
    // const tpPrice = type === "buy" ? entryPrice+10: entryPrice -10; 
    // const slPrice = type === "buy" ? entryPrice-10 : entryPrice +10;
    const orderRes = await pool.query(
      `INSERT INTO orders 
       (user_id, symbol, type, entry_price, quantity, order_amount, take_profit_price, stop_loss_price, leverage, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [user.id, symbol, type, entryPrice, quantity, margin, tpPrice, slPrice, lev, "active"]
    );

    console.log(`Order placed: ${type} ${symbol} at ${entryPrice}, TP: ${tpPrice}, SL: ${slPrice}`);
    res.json(orderRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to place the order" });
  }
});

app.get("/orders", authMiddleware, async (req: any, res: any) => {
  const user = req.user;
  try {
    const ordersRes = await pool.query(
      "SELECT * FROM orders WHERE user_id=$1 AND status='active' ORDER BY created_at DESC",
      [user.id]
    );
    res.json(ordersRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/balance", authMiddleware, async (req: any, res: any) => {
  const user = req.user;
  try {
    const userRes = await pool.query("SELECT balance FROM users WHERE id=$1", [user.id]);
    const balance = parseFloat(userRes.rows[0].balance); 
    res.json({ balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

app.get("/order-history", authMiddleware, async (req: any, res: any) => {
  const user = req.user;
  try {
    const ordersRes = await pool.query(
      "SELECT * FROM orders WHERE user_id=$1 AND status IN ('take_profit', 'stop_loss', 'expired_executed', 'manually_closed', 'liquidated') ORDER BY created_at DESC LIMIT 50",
      [user.id]
    );
    res.json(ordersRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order history" });
  }
});

app.post("/close-order", authMiddleware, async (req: any, res: any) => {
  const { orderId } = req.body;
  const user = req.user;
  try {
    const orderRes = await pool.query(
      "SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND status='active'",
      [orderId, user.id]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found or already closed" });
    }
    
    const order = orderRes.rows[0];
    const margin = parseFloat(order.order_amount);
    const entryPrice = parseFloat(order.entry_price);
    const quantity = parseFloat(order.quantity);
    const currentPrice = latestPrices[order.symbol];
    
    if (!currentPrice) {
      return res.status(400).json({ error: "No current price available" });
    }

    let pnl = 0;
    if (order.type === "buy") {
      pnl = (currentPrice - entryPrice) * quantity;
    } else {
      pnl = (entryPrice - currentPrice) * quantity;
    }

    const returnToBalance = margin + pnl;
    const finalReturn = Math.max(0, returnToBalance);

    await pool.query("UPDATE users SET balance = balance + $1 WHERE id=$2", [finalReturn, user.id]);
    await pool.query("UPDATE orders SET status='manually_closed', exit_price=$1, pnl=$2 WHERE id=$3", [currentPrice, pnl, orderId]);
    
    res.json({ message: "Order closed successfully", pnl, finalValue: finalReturn });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to close order" });
  }
});

//@ts-ignore
redisSubscriber.subscribe("trades", (err, count) => {
  if (err) console.error("Redis subscribe failed:", err);
  else console.log(`Subscribed to ${count} channel(s).`);
});

//@ts-ignore
redisSubscriber.on("message", async (_channel, message) => {
  const trade = JSON.parse(message);
  const price = parseFloat(trade.p);
  const symbol = trade.s;
  if (!isFinite(price)) return;
  latestPrices[symbol] = price;

  try {
    const ordersRes = await pool.query("SELECT * FROM orders WHERE symbol=$1 AND status='active'", [symbol]);
    for (const order of ordersRes.rows) {
      const entryPrice = parseFloat(order.entry_price);
      const tpPrice = parseFloat(order.take_profit_price);
      const slPrice = parseFloat(order.stop_loss_price);
      const margin = parseFloat(order.order_amount);
      const quantity = parseFloat(order.quantity);
      const leverage = parseFloat(order.leverage);

      if (![entryPrice, tpPrice, slPrice, margin, quantity, leverage].every(isFinite)) {
        console.warn("Skipping order due to invalid numeric fields:", order.id);
        continue;
      }

      let shouldClose = false;
      let closeReason = "";
      let exitPrice = price;
      let pnl = 0;
      if (order.type === "buy") {
        pnl = (price - entryPrice) * quantity;
      } else {
        pnl = (entryPrice - price) * quantity;
      }
      const liquidationThreshold = 0.9 * margin;
      if (pnl <= -liquidationThreshold) {
        shouldClose = true;
        closeReason = "liquidated";
        exitPrice = price;
      }
      else if (order.type === "buy") {
        if (price >= tpPrice) {
          shouldClose = true;
          closeReason = "take_profit";
          exitPrice = price;
        } else if (price <= slPrice) {
          shouldClose = true;
          closeReason = "stop_loss";
          exitPrice = price;
        }
      } else { 
        if (price <= tpPrice) {
          shouldClose = true;
          closeReason = "take_profit";
          exitPrice = price;
        } else if (price >= slPrice) {
          shouldClose = true;
          closeReason = "stop_loss";
          exitPrice = price;
        }
      }
      if (!shouldClose) continue;
      if (order.type === "buy") {
        pnl = (exitPrice - entryPrice) * quantity;
      } else {
        pnl = (entryPrice - exitPrice) * quantity;
      }

      const returnToBalance = margin + pnl;
      const finalReturn = returnToBalance
      const upd = await pool.query(
        "UPDATE orders SET status=$1, exit_price=$2, pnl=$3 WHERE id=$4 AND status='active' RETURNING id",
        [closeReason, exitPrice, pnl, order.id]
      );
      if (upd.rowCount === 0) {
        continue;
      }

      await pool.query("UPDATE users SET balance = balance + $1 WHERE id=$2", [finalReturn, order.user_id]);

      console.log(
        `Order ${order.id} closed via ${closeReason}. Entry: ${entryPrice}, Exit: ${exitPrice}, PnL: ${pnl.toFixed(6)}, Returned: ${finalReturn.toFixed(6)}`
      );
    }
  } catch (err) {
    console.error("Error in trade execution:", err);
  }
});

app.listen(3005, () => console.log("Backend running on port 3005"));