import { useState, useEffect } from "react";
import "./App.css";
import Order from "./models/Order";
import OrderTable from "./components/OrderTable";
import GappsButtons from "./components/GappsButtons";

function App() {
	const [orders, setOrders] = useState<Map<string, Order>>(
		new Map<string, Order>(),
	);

	// pull last results on each render
	useEffect(() => {
		chrome.storage.local.get(["lastResults"]).then((res) => {
			const os: Map<string, Order> = new Map();

			for (const o of (res.lastResults as any[]) ?? []) {
				const order = new Order(
					o._url,
					o._images,
					o._username,
					o._total,
					o._shippingLink,
					o._error,
				);
				os.set(order.url, order);
			}
			setOrders(os);
		});
	}, []);

	return (
		<>
			<div className="main">
				<h2 className="main-heading">Select usernames to ship</h2>
				<h3 id="quantity">
					Quantity: {Array.from(orders.values()).length}
				</h3>
				<OrderTable orders={orders} setOrders={setOrders}></OrderTable>
				<div className="buttons">
					<GappsButtons
						orders={orders}
						setOrders={setOrders}></GappsButtons>
				</div>
			</div>
		</>
	);
}

export default App;
