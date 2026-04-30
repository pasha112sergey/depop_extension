import { useState, useEffect } from "react";
import "./App.css";
import Order from "./models/Order";
import OrderTable from "./components/OrderTable";
import GetOrdersButton from "./components/GetOrdersButton";
import SendOrdersButton from "./components/SendOrdersButton";
import SpreadsheetButton from "./components/Spreadsheet";
import SelectAllButton from "./components/SelectAllButton";
import ClearCacheButton from "./components/ClearCacheButton";

function App() {
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        chrome.storage.local.get(["lastResults"]).then((res) => {
            const os: Order[] = (res.lastResults as any[]).map(
                (o: any) =>
                    new Order(
                        o._url,
                        o._images,
                        o._username,
                        o._total,
                        o._shippingLink,
                        o._error,
                    ),
            );
            console.log(os);
            setOrders(os);
        });
    }, []);

    return (
        <>
            <div className="main">
                <h2 className="main-heading">Select usernames to ship</h2>
                <h3 id="quantity">Quantity: {orders.length}</h3>
                <ClearCacheButton></ClearCacheButton>
                <OrderTable orders={orders}></OrderTable>
                <div className="buttons">
                    <GetOrdersButton setOrders={setOrders}></GetOrdersButton>
                    <SelectAllButton></SelectAllButton>
                    <SendOrdersButton orders={orders}></SendOrdersButton>
                    <SpreadsheetButton orders={orders}></SpreadsheetButton>
                </div>
            </div>
        </>
    );
}

export default App;
