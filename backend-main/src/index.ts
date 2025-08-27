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
  const { symbol, type, orderAmount, marginPercent, holdTime } = req.body;
  const user = req.user;

  try {
    const userRes = await pool.query("SELECT balance FROM users WHERE id=$1", [user.id]);
    const balance = parseFloat(userRes.rows[0].balance);

    if (balance < orderAmount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // check we have a price
    const marketPrice = latestPrices[symbol];
    if (!marketPrice) {
      return res.status(400).json({ error: "No market price available for " + symbol });
    }

    // derive bid/ask
    const entryPrice = type === "buy" ? marketPrice * 1.0005 : marketPrice * 0.9995;
    const quantity = orderAmount / entryPrice;

    // deduct balance
    await pool.query("UPDATE users SET balance=balance-$1 WHERE id=$2", [orderAmount, user.id]);

    // calculate TP/SL
    const marginDecimal = marginPercent / 100;
    let tp, sl;
    if (type === "buy") {
      tp = entryPrice * (1 + marginDecimal);
      sl = entryPrice * (1 - marginDecimal);
    } else {
      tp = entryPrice * (1 - marginDecimal);
      sl = entryPrice * (1 + marginDecimal);
    }

    const expiry = new Date(Date.now() + holdTime * 1000);

    const orderRes = await pool.query(
      `INSERT INTO orders 
       (user_id, symbol, type, entry_price, quantity, order_amount, expiry, take_profit_price, stop_loss_price, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
       RETURNING *`,
      [user.id, symbol, type, entryPrice, quantity, orderAmount, expiry, tp, sl]
    );

    res.json(orderRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// Get user's active orders
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

// Get user's current balance
app.get("/balance", authMiddleware, async (req: any, res: any) => {
  const user = req.user;
  try {
    const userRes = await pool.query("SELECT balance FROM users WHERE id=$1", [user.id]);
    res.json({ balance: userRes.rows[0].balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

// Get user's order history
app.get("/order-history", authMiddleware, async (req: any, res: any) => {
  const user = req.user;
  try {
    const ordersRes = await pool.query(
      "SELECT * FROM orders WHERE user_id=$1 AND status IN ('take_profit', 'stop_loss', 'expired_executed', 'manually_closed') ORDER BY created_at DESC LIMIT 50",
      [user.id]
    );
    res.json(ordersRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order history" });
  }
});

// Manually close an order
app.post("/close-order", authMiddleware, async (req: any, res: any) => {
  const { orderId } = req.body;
  const user = req.user;
  
  try {
    // Get the order
    const orderRes = await pool.query(
      "SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND status='active'",
      [orderId, user.id]
    );
    
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found or already closed" });
    }
    
    const order = orderRes.rows[0];
    const currentPrice = latestPrices[order.symbol];
    
    if (!currentPrice) {
      return res.status(400).json({ error: "No current price available" });
    }
    
    // Calculate final value
    let finalValue = 0;
    let pnl = 0;
    
    if (order.type === "buy") {
      finalValue = order.quantity * currentPrice;
    } else {
      finalValue = order.order_amount + (order.entry_price - currentPrice) * order.quantity;
    }
    
    pnl = finalValue - order.order_amount;
    
    // Close the order
    await pool.query("UPDATE orders SET status='manually_closed', exit_price=$1, pnl=$2 WHERE id=$3", [currentPrice, pnl, orderId]);
    await pool.query("UPDATE users SET balance = balance + $1 WHERE id=$2", [finalValue, user.id]);
    
    res.json({ message: "Order closed successfully", pnl, finalValue });
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
  latestPrices[symbol] = price;
  
  try {
    // Check for expired orders first
    const expiredOrdersRes = await pool.query(
      "SELECT * FROM orders WHERE expiry <= NOW() AND status='active'"
    );
    
    for (const expiredOrder of expiredOrdersRes.rows) {
      // Auto-execute at current market price
      const currentPrice = latestPrices[expiredOrder.symbol] || price;
      let finalValue = 0;
      let pnl = 0;
      
      if (expiredOrder.type === "buy") {
        finalValue = expiredOrder.quantity * currentPrice;
      } else {
        finalValue = expiredOrder.order_amount + (expiredOrder.entry_price - currentPrice) * expiredOrder.quantity;
      }
      
      pnl = finalValue - expiredOrder.order_amount;
      
      await pool.query("UPDATE orders SET status='expired_executed', exit_price=$1, pnl=$2 WHERE id=$3", [currentPrice, pnl, expiredOrder.id]);
      await pool.query("UPDATE users SET balance = balance + $1 WHERE id=$2", [finalValue, expiredOrder.user_id]);
      
      console.log(`Order ${expiredOrder.id} auto-executed at expiry. Price: ${currentPrice}, PnL: ${pnl}`);
    }
    
    // Check for active orders to match
    const ordersRes = await pool.query(
      "SELECT * FROM orders WHERE symbol=$1 AND status='active'",
      [symbol]
    );

    for (const order of ordersRes.rows) {
      let shouldClose = false;
      let pnl = 0;
      let exitPrice = price;
      let closeReason = '';
      
      const entryPrice = parseFloat(order.entry_price);
      const takeProfitPrice = parseFloat(order.take_profit_price);
      const stopLossPrice = parseFloat(order.stop_loss_price);
      const orderAmount = parseFloat(order.order_amount);
      const quantity = parseFloat(order.quantity);
      
      if (order.type === "buy") {
        if (price >= takeProfitPrice) {
          shouldClose = true;
          closeReason = 'take_profit';
          exitPrice = takeProfitPrice;
          pnl = (takeProfitPrice - entryPrice) * quantity;
        } else if (price <= stopLossPrice) {
          shouldClose = true;
          closeReason = 'stop_loss';
          exitPrice = stopLossPrice;
          pnl = (stopLossPrice - entryPrice) * quantity;
        }
      } else {
        if (price <= takeProfitPrice) {
          shouldClose = true;
          closeReason = 'take_profit';
          exitPrice = takeProfitPrice;
          pnl = (entryPrice - takeProfitPrice) * quantity;
        } else if (price >= stopLossPrice) {
          shouldClose = true;
          closeReason = 'stop_loss';
          exitPrice = stopLossPrice;
          pnl = (entryPrice - stopLossPrice) * quantity;
        }
      }

      if (shouldClose) {
        const finalBalance = orderAmount + pnl;
        await pool.query("UPDATE orders SET status=$1, exit_price=$2, pnl=$3 WHERE id=$4", [closeReason, exitPrice, pnl, order.id]);
        await pool.query("UPDATE users SET balance = balance + $1 WHERE id=$2", [finalBalance, order.user_id]);
        console.log(`Order ${order.id} closed via ${closeReason}. Entry: ${entryPrice}, Exit: ${exitPrice}, PnL: ${pnl}`);
      }
    }
  } catch (err) {
    console.error("Error in trade execution:", err);
  }
});
app.listen(3005, () => console.log("Backend running on port 3005"));
