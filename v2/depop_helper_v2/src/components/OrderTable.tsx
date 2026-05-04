import { useState, useEffect } from "react";
import Order from "../models/Order";
import GetOrdersButton from "./GetOrdersButton";
import { Color } from "../scripts/utils";

type Props = {
	orders: Map<string, Order>;
	selected: Set<Order>;
	setOrders: Function;
	setSelected: Function;
};

export default function OrderTable({
	orders,
	setOrders,
	selected,
	setSelected,
}: Props) {
	console.log(orders);
	const [collapsed, setCollapsed] = useState(false);
	const [allSelected, setAllSelected] = useState(false);

	for (const [, o] of orders) {
		if (o.sent) {
			console.log(o.username, " sent!");
		}
	}

	return (
		<div id="orderTable">
			<table>
				<tbody>
					{Array.from(orders.values()).map((order) => (
						<Row
							order={order}
							setSelected={setSelected}
							selected={selected}
							key={order.url}
						/>
					))}
				</tbody>
			</table>
			<div className="tableButtons">
				<GetOrdersButton setOrders={setOrders} />

				<button
					id="selectAll"
					onClick={() => {
						const next = !allSelected;
						setAllSelected(next);
						selectAll(orders, next, setSelected);
					}}>
					Select All
				</button>
				<button
					id="collapseAll"
					onClick={() => {
						const next = !collapsed;
						setCollapsed(next);
						collapseAll(next);
					}}>
					Collapse All
				</button>
				<button
					id="deleteSelected"
					onClick={() => {
						deleteSelected(orders, setOrders, setSelected);
					}}>
					Delete Selected
				</button>
				<button
					id="clearCache"
					onClick={() => clearCache(setOrders, setSelected)}>
					Clear Cache
				</button>
			</div>
		</div>
	);
}

/**
 * clears chrome.storage.local 
 @param {Function} setOrders: setter
 */
function clearCache(setOrders: Function, setSelected: Function): void {
	chrome.storage.local.clear();
	setOrders(new Map<string, Order>());
	setSelected(new Set<Order>());
}

/**
 * Selects or deselects all input elements in the table
 * @param selected
 */
function selectAll(
	orders: Map<string, Order>,
	selected: boolean,
	setSelected: Function,
): void {
	const inputs = document.querySelectorAll(`input[type="checkbox"]`);
	document.getElementById("selectAll")!.innerText = selected
		? "Deselect All"
		: "Select All";
	const newOrders: Set<Order> = new Set<Order>();

	// otherwise, everything needs to be changed and updated
	inputs.forEach((input) => {
		const checkbox = input as HTMLInputElement;
		checkbox.checked = selected;
		if (checkbox.checked) newOrders.add(orders.get(checkbox.id)!);
	});

	setSelected(newOrders);
}
/**
 * Collapses or exapnds all elements in the table
 * @param collapsed
 */
function collapseAll(collapsed: boolean) {
	const details = document.querySelectorAll("details");
	document.getElementById("collapseAll")!.innerText = collapsed
		? "Expand All"
		: "Collapse All";

	for (let d of details) {
		d.open = collapsed;
	}
}

/**
 * Deletes selcted orders
 * @param orders
 * @param setOrders
 */
function deleteSelected(
	orders: Map<string, Order>,
	setOrders: Function,
	setSelected: Function,
): void {
	const inputs = document.querySelectorAll(`input[type="checkbox"]`);
	console.log("orders before: ", orders);

	const newOrders = new Map(orders);
	for (let inp of inputs) {
		if ((inp as HTMLInputElement).checked) {
			newOrders.delete(inp.id);
		}
	}

	chrome.storage.local.set({
		lastResults: Array.from(newOrders.values()),
	});

	setOrders(newOrders);
	setSelected(newOrders.values());
}

type RowProp = { order: Order; setSelected: Function; selected: Set<Order> };
/**
 * create a row for the table
 * @param param0
 */
function Row({ order, setSelected, selected }: RowProp) {
	const [color, setColor] = useState<string>("white");
	useEffect(() => {
		if (order.sent && !order.accounted) {
			setColor(Color.SENT);
		}
		if (order.accounted && !order.sent) {
			setColor(Color.LOGGED);
		}
		if (order.accounted && order.sent) {
			setColor(Color.SUCCESS);
		}
	}, [order.sent, order.accounted]);

	return (
		<tr className="orderRow" style={{ backgroundColor: color }}>
			<td className="username">
				<label className="username-label" htmlFor={order.url}>
					<p>{order.username}</p>
					<input
						type="checkbox"
						className="selected"
						id={order.url}
						value={order.url}
						onChange={(e) => {
							const newSelected = new Set(selected);
							if (e.target.checked) {
								newSelected.add(order);
							} else {
								newSelected.delete(order);
							}
							setSelected(newSelected);
						}}></input>
				</label>
			</td>

			<td className="dropDown">
				<details open>
					<label className="username-label" htmlFor={order.url}>
						<summary>Expand</summary>
						<div className="imageContainer">
							{order.images.map((img) => (
								<div key={img}>
									<img src={img} />
									<input
										className={`note-${img}-${order.url}`}
										type="text"
										placeholder="28-48"></input>
								</div>
							))}
						</div>
					</label>
				</details>
			</td>
		</tr>
	);
}
