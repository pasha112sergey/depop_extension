import ChromeMessageType from "../scripts/messageTypes";
import Order from "../models/Order";

type Props = { setOrders: Function };

export default function GetOrdersButton({ setOrders }: Props) {
	return (
		<div className="button">
			<button id="getOrders" onClick={() => getOrders(setOrders)}>
				Get Orders
			</button>
		</div>
	);
}

/**
 * 1. Fires a message to start the background operation
 * 2. Listens for chrome.storage.local changes to receive the result
 *    (avoids MV3 service worker lifetime killing the message port)
 */
function getOrders(setOrders: Function) {
	console.log("clicked getOrders");

	// Listen for the storage write that backend does when it finishes
	function onStorageChanged(
		changes: { [key: string]: chrome.storage.StorageChange },
		area: string,
	) {
		if (area !== "local" || !("lastResults" in changes)) return;

		chrome.storage.onChanged.removeListener(onStorageChanged);

		const rawOrders = changes.lastResults.newValue;

		if (!Array.isArray(rawOrders)) {
			printError("empty response in getOrders");
			return;
		}

		const orders: Order[] = rawOrders.map(
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

		for (const order of orders) {
			if (order.error != null) {
				printError(order.error);
			}
		}

		setOrders(orders);
		console.log("orders set: ", orders);
	}

	chrome.storage.onChanged.addListener(onStorageChanged);

	chrome.runtime.sendMessage(
		{ type: ChromeMessageType.GET_ORDERS },
		(resp) => {
			console.log("response: ", resp);
		},
	);
}

/**
 * Prints error in the get-order button text and in console.error
 */
function printError(message: string): void {
	document.getElementById("get-orders")!.innerHTML += `Error: ${message}`;
	console.error(message);
	console.error(chrome.runtime.lastError);
}
