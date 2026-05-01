import { renderToStaticMarkup } from "react-dom/server";
import Order from "../models/Order";
import { useEffect } from "react";
import EmailTemplate from "./EmailTemplate";
import {
	buildRawEmail,
	callGmailSend,
	getAuthToken,
} from "../scripts/googleApi";
type Props = { orders: Map<string, Order>; setOrders: Function };

const EMAIL_DESTINATION: string = "pasha112sergey@gmail.com";

/**
 * this component contains the code for buttons responsible for calling Gmail API
 * This applies to both record-keeping and email sending.
 *
 * Specs:
 * On click of the send emails button:
 * 1. poll selected objects
 * 2. Populate list of html documents
 * 3. fire and send emails
 * 4. error check emails, marking erroneous/failed sends
 *
 * On click of the update spreadsheet button:
 *
 * @param param0
 * @returns React component
 */
export default function GappsButtons({ orders, setOrders }: Props) {
	void orders;
	void setOrders;

	return (
		<div className="gappsButtons">
			<button
				id="sendEmails"
				onClick={() => {
					return (async () => {
						return sendEmails(orders);
					})();
				}}>
				Send Emails
			</button>
			<button id="updateSheet" onClick={() => updateSheet()}>
				Update Spreadsheet
			</button>
		</div>
	);
}

/**
 * This function is responsible for email dispatch:
 * Steps:
 * 1. poll selected objects
 * 2. Populate list of html documents
 * 3. fire and send emails
 * 4. error check emails, marking erroneous/failed sends
 *
 */
async function sendEmails(orders: Map<string, Order>): Promise<void> {
	const selected: Order[] = pollSelectedObjects(orders);
	if (selected.length == 0) {
		alertError("No selections to send!");
	}
	// map of url: html body
	const htmlEmailBodies: Map<string, string> = createEmailHtml(selected);
	const token = await getAuthToken();
	for (const [url, html] of htmlEmailBodies) {
		sendEmail(html, orders.get(url), token)
			.then(() => {
				console.log(`order for ${orders.get(url)} sent successfully!`);
			})
			.catch((err: any) => {
				alertError(
					`error for order for ${orders.get(url)?.username}: ` +
						err.message,
				);
			});
	}
}

async function sendEmail(
	html: string,
	order: Order | undefined,
	token: string,
): Promise<boolean> {
	if (!order) {
		alertError("Request to send email to null order!");
		return false;
	}

	const subject = `depop-${order.username}`;
	const shippingLink = order.shippingLink;

	const raw = buildRawEmail(EMAIL_DESTINATION, subject, html);
	try {
		await callGmailSend(raw, token);
		return true;
	} catch (err: any) {
		throw new Error(
			`error: ${err.message} arose when trying to send email for ${order.username}`,
		);
		return false;
	}
}

/**
 * This function creates the list of HTML strings for each order
 * @param orders
 */
function createEmailHtml(orders: Order[]): Map<string, string> {
	const htmlMap = new Map<string, string>();
	for (const order of orders) {
		console.log(renderToStaticMarkup(<EmailTemplate order={order} />));
		htmlMap.set(
			order.url,
			renderToStaticMarkup(<EmailTemplate order={order} />),
		);
	}
	return htmlMap;
}

/**
 * polls selected objects
 * @param {Map<string, Object>} singleton state
 * @returns {Order[]} - array of Order objects that were selected
 */
function pollSelectedObjects(orders: Map<string, Order>): Order[] {
	const labels: Element[] = Array.from(
		document.querySelectorAll('input[type="checkbox"]'),
	);
	console.log(labels);

	const selectedLabelUrls = labels
		.map((e: Element) => e as HTMLInputElement)
		.filter((l) => {
			console.log(l, l.checked);
			return l.checked;
		})
		.map((l) => l.id);

	const selectedOrders: Order[] = Array.from(orders.keys())
		.filter((url) => selectedLabelUrls!.includes(url))
		.map((url) => orders.get(url)!);

	return selectedOrders;
}

function updateSheet(): void {}

/**
 * Logging function to report a bug
 */
function alertError(msg: string): void {
	window.alert(msg);
}
