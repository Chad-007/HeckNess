import { ApexOptions } from "apexcharts";
import { useEffect,useState,useMemo,useRef, useCallback } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { parse } from "path";
import { Time } from "lightweight-charts";
import { time } from "console";
import { hasSubscribers } from "diagnostics_channel";
import { headers } from "next/headers";
import { useErrorOverlayReducer } from "next/dist/next-devtools/dev-overlay/shared";
import { fileURLToPath } from "url";
const Chart = dynamic(()=> import ("react-apexcharts"),{ssr:false})
interface Trade{
    p:string,
    q:string,
    m:boolean,
    T:number,
    s:string
}

interface Candle{
    bucket:string,
    symbol:string,
    open_price:string,
    close_price:string,
    high_price:string,
    low_price:string,
    volume:string
}

interface ActiveOrder{
    id:string,
    type:"buy"|"sell",
    entry_price:string,
    quantity:string,
    order_amount:string,
    take_profit_price:string,
    stop_loss_price:string,
    leverage:string,
    symbol:string,
    // status:string,
    pnl?:string|number,
    exit_price?:string|number,
    status?:string|number
}

const intervals = ["1 minute","5 minutes","10 minutes","30 minutes"]
const symbols  = ["BTCUSDT","ETHUSDT","SOLUSDT"]


const getIntervals = (interval:string):number =>{
    switch(interval){
        case "1 minutes":return 60*1000;
        case "5 minutes":return 60*5000;
        case "10 minutes":return 60*10000;
        case "30 minutes":return 60*30000;
        default:return 60*1000;
    }
}

const Candlestickchart =({candles}:{candles:Candle[]})=>{
			const ChartData = useMemo(()=>
                {
				candles.map((c)=>({
				x: new Date(c.bucket).getTime(),
				y: [
					parseFloat(c.open_price),
					parseFloat(c.close_price),
					parseFloat(c.high_price),
					parseFloat(c.low_price)
				]
				}))},[candles])
            
            const options: ApexOptions = {
    chart: { 
      type: "candlestick", 
      height: 400, 
      background: "#0a0a0a", 
      toolbar: { show: false },
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      animations: {
        enabled: true,
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      }
    },
    theme: { mode: "dark" },
    grid: { 
      borderColor: "#1a1a1a", 
      strokeDashArray: 1,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } }
    },
    xaxis: {
      type: "datetime",
      labels: { 
        style: { colors: "#888", fontSize: "11px" }, 
        format: "HH:mm" 
      },
      axisBorder: { color: "#333" },
      axisTicks: { color: "#333" }
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: {
        style: { colors: "#888", fontSize: "11px" },
        formatter: (v: number) => `$${v.toFixed(2)}`,
      },
    },
    plotOptions: {
      candlestick: {
        colors: { upward: "#00ff88", downward: "#ff4444" },
        wick: { useFillColor: true },
      },
    },
  };
  return(
    <div className="bg-black border-gray-50 rounded-2xl">
        <div className="">
            <h3 className="text-white">{candles[0]?.symbol||"BTCUSDT"}</h3>  
        </div>
        <div className="p-2">
            
        </div>
    </div>
  )            
}

export default function HomePage(){
    const [candles, setCandles] = useState<Candle[]>([]);
    const [interval, setIntervalState] = useState("1 minute");
    const [symbol, setSymbol] = useState("BTCUSDT");
    const [leverage, setLeverage] = useState<number>(2);
    const [prices, setPrices] = useState<Record<string, number>>({ BTCUSDT: 0, ETHUSDT: 0, SOLUSDT: 0 });
    const [orderAmount, setOrderAmount] = useState<number>(100);
    const [cashBalance, setCashBalance] = useState<number>(0);
    const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
    const [orderHistory, setOrderHistory] = useState<ActiveOrder[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [tpPrice,settpPrice] = useState<number>(0);
    const [slPrice,setslPrice] = useState<number>(0);
    const router = useRouter();
    const currentCandleRef  = useRef<Candle|null>(null);
    const intervalMsRef = useRef<number>(getIntervals(interval));
    const lastCandleTimeRef = useRef<number>(0);
    const tonumber = (value:string|number):number=>{
        if (typeof( value)==="string"){
            return parseFloat(value)
        }
        else{
            return value
        }
    } 
    const calculatePortfolioValue = () =>{
        let positionValue = 0
        activeOrders.forEach((order)=>{
            const currentPrice = prices[order.symbol];
            if(currentPrice){
                const entryPrice = parseFloat(order.entry_price);
                const quantity = parseFloat(order.quantity);
                const margin  = parseFloat(order.order_amount);

                let pnl = 0
                if(order.type==="buy"){
                    pnl = (currentPrice-entryPrice)*quantity
                }
                else{
                    pnl = (entryPrice-currentPrice)*quantity
                }
                positionValue +=margin+pnl
            }
        })
        return cashBalance+positionValue
    }

    const totalPortfolioValue = calculatePortfolioValue();
    const createCandleFromTrade = (trade:Trade, timestamp:number):Candle=>{
        const price  = parseFloat(trade.p);
        const candleTime =  new Date(Math.floor(timestamp/intervalMsRef.current)*intervalMsRef.current);
        return{
            bucket:candleTime.toISOString(),
            symbol: trade.s,
            open_price: price.toString(),
            high_price: price.toString(),
            low_price: price.toString(),
            close_price: price.toString(),
            volume: trade.q
        }
    }

    const updateCandleWithTrade = (candles:Candle,trade:Trade):Candle=>{

        const price  = parseFloat(trade.p);
        const volume = candles.volume+trade.q
        return {
      ...candles,
      high_price: Math.max(parseFloat(candles.high_price), price).toString(),
      low_price: Math.min(parseFloat(candles.low_price), price).toString(),
      close_price: price.toString(),
      volume: volume.toString()
    };
  };
    const updateCandlesWithTrade = useCallback((trade:Trade)=>{
        if(trade.s!==symbol){
            return
        }
        const timestamp = trade.T;
        const candleStartTime = Math.floor(timestamp/intervalMsRef.current)*intervalMsRef.current;
        setCandles(prevCandles=>{
           if( prevCandles.length===0 ){
            return prevCandles;
           }
           const newCandles =  [...prevCandles];
           const lastCandle = newCandles[newCandles.length-1];
           const lastCandleTime = new Date(lastCandle.bucket).getTime()
           if(candleStartTime===lastCandleTime){
            newCandles[newCandles.length-1] = updateCandleWithTrade(lastCandle,trade)
            currentCandleRef.current = newCandles[newCandles.length-1];   
           }
           else if(candleStartTime>lastCandleTime){
                const newCandle = createCandleFromTrade(trade,timestamp);
                newCandles.push(newCandle);
                currentCandleRef.current = newCandle;
                if(newCandles.length>100){
                newCandles.shift()
           }   
           }
           return newCandles
        }
    )
    },[candles]) 


    useEffect(()=>{
        const token = localStorage.getItem("token");
        if(!token){
            router.push("/login")
        }
        else{
            // the functions that we need to write
        }
    },[router])

    const fetchOrders = async()=>{
        try{
            const token = localStorage.getItem("token")
            const res = await fetch("http://localhost:3000/orders",{
                headers:{Authorization:`Bearer ${token}`}
            })
            if(res.ok){
                const orders = await res.json();
                setActiveOrders(orders)
            }
        }catch{
            alert("there was some issue with fetching the order ")
        }
    }

    const fetchBalance =async ()=>{
        const token = localStorage.getItem("token");
        try{
            const  res  = await fetch("http://localhost:3000/balance",{
                headers:{Authorization:`Bearer ${token}`}
            })
            if(res.ok){
                const data = await res.json();
                setCashBalance(data.balance);
            }
        }catch{
            console.log("there was some issue with fetching the order")
        }
    }

    const fetchOrderHistory =async ()=>{
        const token  = localStorage.getItem("toke")
        try{
            const res = await fetch("http://localhost:3000/order-history",{
                headers:{Authorization:`Bearer ${token}`}
            })
            if(res.ok){
                const history = await res.json()
                setOrderHistory(history)
            }
        }catch{
            console.log("there was some issuw while fetching the orders")
        }
    }
    const closeorder = async(orderid:string)=>{
        const token = localStorage.getItem("token")
        try{
                const res = await fetch("http:localhost:3000/close-order",{
                    headers:{Authorization:`Bearer ${token}`},
                    body:JSON.stringify({orderid})
                })
                if(res.ok){
                    const data = await res.json()
                    alert(`Order closed! PnL: $${data.pnl.toFixed(2)}`);
                    fetchOrders();
                    fetchBalance();
                    fetchOrderHistory();
                }
        }
        catch{
            console.log("there was some issue with closing the order")
        }
    }

    const placeOrder = async(type:"buy"|"sell")=>{
        const token = localStorage.getItem("token")
        try{
            const res = await fetch("http://localhost:3000",{
            headers:{Authorization:`Bearer ${token}`},
            body:JSON.stringify({symbol,type,orderAmount,leverage,tpPrice,slPrice})
        })
        if(res.ok){
            fetchBalance();
            fetchOrders();
            fetchOrderHistory();
            console.log("the order has been place succesfully")
        }

        }catch{
            console.log("the was some issue whhile placing the order")
        }
    }

    const calculateOrderPnL= (order:ActiveOrder,currentPrice:number)=>{
        const entryPrice = tonumber(order.entry_price);
        const quantity = tonumber(order.quantity);
            const margin = tonumber(order.order_amount);
        let pnl = 0;
    if (order.type === "buy") {
      pnl = (currentPrice - entryPrice) * quantity;
    } else {
      pnl = (entryPrice - currentPrice) * quantity;
    }
    const currentValue = margin + pnl;
    const pnlPercent = margin > 0 ? (pnl / margin) * 100 : 0;
    return { pnl, pnlPercent, currentValue };
    }
    useEffect(()=>{
        const ws = new WebSocket("ws://localhost:3006")
        ws.onmessage = (event)=>{
            const data:Trade = JSON.parse(event.data)
            setPrices((prev)=>({
                ...prev,
                [data.s]:parseFloat(data.p)
            }))
            updateCandlesWithTrade(data)
        }
        ws.onopen = ()=>{
            console.log("websocket connected")
        }
        ws.onclose = ()=>{
            console.log("websocket closed")
        }
        return()=>ws.close()
    },[updateCandlesWithTrade])

    const fetchCandles  = useCallback(async()=>{
        const res = await fetch(`http://localhost:3000/candles?interval=${encodeURIComponent(interval)}&duration=1 hours`)
        const data = await res.json()
        const filteredCandles = data.filter((c:Candle)=>{
            c.symbol===symbol
        })
        setCandles(filteredCandles)
        intervalMsRef.current = getIntervals(interval)

        if(filteredCandles.length>0){
            const lastCandle = filteredCandles[filteredCandles.length-1]
            currentCandleRef.current = lastCandle
            lastCandleTimeRef.current = new Date(lastCandle.bucket).getTime()
        }
    },[interval,symbol])

    useEffect(()=>{
        fetchCandles()
    },[fetchCandles])

    useEffect(()=>{
        const refreshInterval = setInterval(() => {
            fetchBalance()
            fetchOrders()
        }, 2000);
        return ()=>clearInterval(refreshInterval)
    },[])













}




