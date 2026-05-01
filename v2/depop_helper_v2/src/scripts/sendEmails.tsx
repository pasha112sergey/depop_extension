import { alertError, pollSelectedObjects } from "./utils";
import Order from "../models/Order";
import { renderToStaticMarkup } from "react-dom/server";
import { buildRawEmail, callGmailSend } from "./googleApi";
import EmailTemplate from "../components/EmailTemplate";

const EMAIL_DESTINATION: string = "pasha112sergey@gmail.com";

/**
 * This function is responsible for email dispatch:
 * Steps:
 * 1. poll selected objects
 * 2. Populate list of html documents
 * 3. fire and send emails
 * 4. error check emails, marking erroneous/failed sends
 *
 */
export default async function sendEmails(
	orders: Map<string, Order>,
	token: string | undefined,
): Promise<void> {
	const selected: Order[] = pollSelectedObjects(orders);
	if (selected.length == 0) {
		alertError("No selections to send!");
		return;
	}

	if (!token) {
		alertError("No token found!");
		return;
	}

	// map of url: html body
	const htmlEmailBodies: Map<string, string> = createEmailHtml(selected);
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

/**
 * Handles sending of email
 * by calling functions from googleApi.ts
 * @param html
 * @param order
 * @param token
 * @returns
 */
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
