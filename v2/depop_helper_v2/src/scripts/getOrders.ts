import {
	getLinks,
	navigateToUrl,
	waitForSelector,
	errorOrder,
	scrapeDataFromDom,
	Color,
} from "./utils";
import Order from "../models/Order";

/**
 * Defines the procedure to get orders from DOM
 * @param sender who the message request was (always popup.js)
 * @param sendResponse
 */
export default function getOrders(
	sender: chrome.runtime.MessageSender,
	sendResponse: Function,
) {
	void sender;
	(async () => {
		console.log("GET_ORDERS received in service worker");
		const [tab] = await chrome.tabs.query({
			active: true,
			lastFocusedWindow: true,
		});

		if (!tab?.id) {
			sendResponse({ error: "No Active Tab" });
			return;
		}

		if (!tab.url?.startsWith("https://")) {
			sendResponse({
				error: `Cannot inject into tab: ${tab.url}`,
			});
			return;
		}

		const tabId: number = tab.id;
		let injectionResult: chrome.scripting.InjectionResult<string[]>;
		try {
			[injectionResult] = await chrome.scripting.executeScript({
				target: { tabId },
				func: getLinks,
			});
		} catch (e: any) {
			sendResponse({
				error: `executeScript failed: ${e.message}`,
			});
			return;
		}

		const receiptLinks = injectionResult.result;

		if (!Array.isArray(receiptLinks) || receiptLinks.length === 0) {
			sendResponse({ error: "no receipt links found. " });
			return;
		}

		const orderArray: Order[] = [];
		const processed: Map<string, boolean> = new Map();

		// load existing stored orders and collect their URLs to skip
		const stored = await chrome.storage.local.get(["lastResults"]);
		const existingOrders: any[] = Array.isArray(stored.lastResults)
			? stored.lastResults
			: [];
		const existingUrls = new Set<string>(
			existingOrders.map((e: any) => e._url),
		);

		// debug to reduce the number of shipping label loads allowed
		const loopCondition: number = receiptLinks.length;
		// const loopCondition: number = 2;
		for (let i = 0; i < loopCondition; i++) {
			const rLink = receiptLinks[i];
			if (existingUrls.has(rLink)) {
				console.log("skipping already stored link:", rLink);
				continue;
			}

			try {
				await navigateToUrl(tabId, rLink);

				const foundImage: boolean = await waitForSelector(
					tabId,
					"img.styles_image__nuVfa",
					10000,
				);

				if (!foundImage) {
					orderArray.push(errorOrder("no image found"));
					continue;
				}
				console.log("image found? ", foundImage);

				const scrapedOrder: Order = await scrapeDataFromDom(tabId);
				scrapedOrder.url = rLink;

				if (
					!scrapedOrder.error &&
					scrapedOrder.shippingLink !== "error"
				) {
					orderArray.push(scrapedOrder);
					processed.set(rLink, true);
				} else {
					throw new Error(
						scrapedOrder.error ?? "unknown order error on line 84",
					);
				}
			} catch (error: any) {
				orderArray.push(errorOrder(error));
				processed.set(rLink, false);
			}
		}

		await navigateToUrl(tabId, "https://depop.com/sellinghub/sold-items");

		// here should add color to the links that were picked!
		console.log("orderArray: ", orderArray);

		chrome.storage.local.set({
			lastResults: [...existingOrders, ...orderArray],
		});

		// Result is read by the popup via chrome.storage.onChanged

		// color dom
		try {
			const processedLinks = receiptLinks.filter((l) => processed.get(l));

			await chrome.scripting.executeScript({
				target: { tabId },
				func: (links: string[], successLinks: string[]) => {
					// sets the color of the link
					function setColor(link: string, color: string) {
						const parents = Array.from(
							document.querySelectorAll("a"),
						)
							.filter((a) => a.href == link)
							.map((ele) => ele.parentNode as HTMLDivElement);

						console.log("parents selected: ", parents);
						const parent = parents.find((p) => {
							console.log("p testing: ", p);
							return p.className == "styles_wrapper__JTFc9";
						});

						console.log("parent", parent);
						if (parent) {
							parent.style.backgroundColor = color;
						}
						return parent;
					}

					for (const rLink of links) {
						if (successLinks.includes(rLink)) {
							const el = setColor(rLink, Color.SUCCESS);
							console.log(`link is processed`);
							console.log(el);
						} else {
							setColor(rLink, Color.FAILURE);
						}
					}
					return true;
				},
				args: [receiptLinks, processedLinks],
			});
		} catch (e: any) {
			console.log(`Error! ${e.message}`);
			sendResponse({ ok: false });
		}

		sendResponse({ ok: true });
	})();
}

/**
 * error for order for @mlopezhori10: error: Gmail API error: Too many concurrent requests for user. arose when trying to send email for @mlopezhori10
 */
