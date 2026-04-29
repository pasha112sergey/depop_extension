import { useState } from "react";
import "./App.css";
import OrderTable from "./components/OrderTable";
import GetOrdersButton from "./components/GetOrdersButton";
import SendOrdersButton from "./components/SendOrdersButton";
import SpreadsheetButton from "./components/Spreadsheet";
import SelectAllButton from "./components/SelectAllButton";

function App() {
    const [orders, setOrders] = useState([]);

    return (
        <>
            <div className="main">
                <h1 className="main-heading">Select usernames to ship</h1>
                <h2 className="quantity">Quantity: {orders.length}</h2>
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
