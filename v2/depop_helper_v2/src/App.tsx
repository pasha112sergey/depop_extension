import { useState, useEffect } from "react";
import "./App.css";
import Order from "./models/Order";
import OrderTable from "./components/OrderTable";
import GappsButtons from "./components/GappsButtons";

const DEFAULT_EMAIL: string = "safronov1112@gmail.com";

function App() {
	const [orders, setOrders] = useState<Map<string, Order>>(
		new Map<string, Order>(),
	);
	const [selected, setSelected] = useState<Set<Order>>(new Set<Order>());
	const [email, setEmail] = useState<string>(DEFAULT_EMAIL);

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
					o._sent,
					o._accounted,
				);
				os.set(order.url, order);
			}
			setOrders(os);
		});
	}, []);

	return (
		<>
			<div className="main">
				<h3>Input email: currently is: [{email}]</h3>
				<input
					type="text"
					placeholder="email"
					onChange={(e) => {
						setEmail(e.target.value);
					}}></input>
				<h2 className="main-heading">Select usernames to ship</h2>
				<h3 id="quantity">
					Quantity: {Array.from(orders.values()).length}
				</h3>
				<OrderTable
					orders={orders}
					setOrders={setOrders}
					selected={selected}
					setSelected={setSelected}></OrderTable>
				<div className="buttons">
					<GappsButtons
						orders={orders}
						selected={selected}
						setOrders={setOrders}
						emailDestination={email}></GappsButtons>
				</div>
			</div>
		</>
	);
}

export default App;
