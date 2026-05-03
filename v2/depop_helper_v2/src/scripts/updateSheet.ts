import Order from "../models/Order";
import { alertError } from "./utils";
import { pollSelectedObjects } from "./utils";

const SPREADSHEET_ID: string = "1wPlW6T3W8e8yXjhIai0Dc3orIW1f9hOWm7Zb4bPn4JA";
const API_LINK: string = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`;

type SheetRecord = {
	date: string;
	image: string;
	username: string;
	total: number;
};

/**
 * This function entries in the spreadsheet.
 * Spreadsheet needs the following record
 * 1. Date
 * 2. images
 * 3. username
 * 4. total
 * 5. owed
 * @param orders
 */
export default async function updateSheet(
	orders: Map<string, Order>,
	token: string | undefined,
	setOrders: Function,
) {
	if (!token) {
		alertError("Failed to retrieve token in updateSheet!");
		return;
	}

	const polledOrders = pollSelectedObjects(orders);
	if (polledOrders.length == 0) {
		alertError("No orders selected!");
		return;
	}

	for (const order of polledOrders) {
		for (let i = 0; i < order.images.length; i++) {
			let record: SheetRecord;
			// check last item, then put total
			record = {
				date: new Date().toLocaleString("en-US", {
					dateStyle: "medium",
					timeStyle: "short",
				}),
				image: `=IMAGE("${order.images[i]}", 4, 100, 100)`,
				username: order.username,
				total: 0,
			};

			if (i == order.images.length - 1) {
				record.total = order.total;
			}

			try {
				const response = await fetch(API_LINK, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						values: [
							[
								record.date,
								record.username,
								record.image,
								record.total,
							],
						],
					}),
				});
				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					throw new Error(
						`Sheets API error ${response.status}: ${err?.error?.message ?? response.statusText}`,
					);
				}
				order.accounted = true;
				setOrders(new Map(orders));
			} catch (err: any) {
				alertError(`Failed to update sheet: ${err.message}`);
			}
		}
	}
}
