import Order from "../models/Order";

/**
 * @name utils.t
 * @description
 * provides exports for utility functions like navigating the dom, setting dom elements and more
 */

/**
 * Logging function to report a bug
 */
export function alertError(msg: string): void {
	const tabId = getTabId();
	tabId
		.then((tabId) => {
			chrome.scripting.executeScript({
				target: { tabId },
				func: (msg: string) => {
					window.alert(msg);
				},
				args: [msg],
			});
		})
		.catch((error: Error) => {
			console.log("Error!\n");
			window.alert(error.message);
		});
	console.log("alertError: ", msg);
}

export async function getTabId(): Promise<number> {
	const [tab] = await chrome.tabs.query({
		active: true,
		lastFocusedWindow: true,
	});

	if (!tab?.id) {
		throw new Error("No tab id!");
	}

	if (!tab.url?.startsWith("https://")) {
		throw new Error("No valid tabId!");
	}

	return tab.id;
}

export enum Color {
	SUCCESS = "#4aedae",
	FAILURE = "#d13b3b",
	SENT = "#ee8f1a",
	LOGGED = "#c33f2d",
}

const ORDER_IMAGE_SELECTOR = "img.styles_image__nuVfa";
const SHIPPING_BUTTON_SELECTOR = ".styles_downloadLabelButton--label__3i_n0";

const visitedUrls: string[] = [];

export function clearVisitedUrls() {
	visitedUrls.length = 0;
}

/**
 * @returns string[] Returns the links of each receipt element
 */
export function getLinks(): string[] {
	console.log("getting links...");

	// collect receipt elements
	let receipts = Array.from(
		document.getElementsByClassName("styles_receiptsListWrapper__bdK1V"),
	);

	// filter by valid receipt elements
	const receiptElements = receipts.filter((r) => {
		const val = Array.from(r.getElementsByTagName("p")).some((p) => {
			return p.innerText.includes("Ship order");
		});
		return val;
	});

	console.log("receiptElemnts: ", receiptElements);

	// map receipts to their href attribute
	const refs: string[] = receiptElements
		.map((ele) => {
			const aElement = ele.querySelector(
				'[aria-label*="View receipt"]',
			) as HTMLAnchorElement;

			return aElement ? aElement.href : null;
		})
		.filter((href) => href != null);

	return refs;
}

/**
 * waits for a selector to load
 * @param tabId tabId of the tab to wait
 * @param selector in the tab
 * @param timeoutMs max timeout, default = 10 sec
 * @returns
 */
export async function waitForSelector(
	tabId: number,
	selector: string,
	timeoutMs: number = 10000,
) {
	console.log(selector);
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		// Ask the page if document.querySelector(selector) is non‐null
		const [response] = await chrome.scripting.executeScript({
			target: { tabId },
			func: (sel) => {
				return document.querySelector(sel) !== null;
			},
			args: [selector],
		});
		if (response.result) {
			return true;
		}
		// If not found yet, wait 100 ms and try again
		await new Promise((r) => setTimeout(r, 100));
	}
	console.log("could not find selector: ", selector);
	return false;
}

/**
 * Navigate to a url
 * @param tabId tab Id in which to navigate
 * @param url to travel to
 * @param timeoutMs timeout of non-responsiveness
 * @returns void
 */
export async function navigateToUrl(
	tabId: number,
	url: string,
	timeoutMs: number = 30000,
): Promise<void> {
	console.log("in navigate");

	return new Promise((resolve, reject) => {
		let timeoutHandle: number = 0;

		function onUpdatedListener(updatedTabId: number, changeInfo: any) {
			if (updatedTabId !== tabId) return;
			if (changeInfo.status == "complete") {
				chrome.tabs.onUpdated.removeListener(onUpdatedListener);
				clearTimeout(timeoutHandle);
				resolve();
			}
		}

		chrome.tabs.onUpdated.addListener(onUpdatedListener);

		chrome.tabs
			.update(tabId, { url, active: false })
			.catch((error: any) => {
				chrome.tabs.onUpdated.removeListener(onUpdatedListener);
				clearTimeout(timeoutHandle);
				reject(new Error(`tabs.update failed, ${error.message}`));
			});

		timeoutHandle = setTimeout(() => {
			console.log("timeout!");
			chrome.tabs.onUpdated.removeListener(onUpdatedListener);
			reject(new Error("navigateToURL timed out"));
		}, timeoutMs);
	});
}

/**
 *
 * @param tabId: number
 * @returns Order
 */
export async function scrapeDataFromDom(tabId: number): Promise<Order> {
	console.log("in scrapeDataFromDom: tabid: ", tabId);
	const foundImage = await waitForSelector(tabId, "img", 10000);
	console.log("found image!", foundImage);

	if (!foundImage) {
		return errorOrder("no image found");
	}

	const foundGetShippingLabelBtn = await waitForSelector(
		tabId,
		SHIPPING_BUTTON_SELECTOR,
		10000,
	);

	if (!foundGetShippingLabelBtn) {
		return errorOrder("no shipping link!");
	}

	const [injectionResult] = await chrome.scripting.executeScript({
		target: { tabId },
		func: () => {
			const imageElements: NodeListOf<Element> =
				document.querySelectorAll("img.styles_image__nuVfa");
			console.log(imageElements);

			if (!imageElements) {
				console.log("no images!");
				return { error: "No img found in live DOM" };
			}
			const p_tags: NodeListOf<Element> = document.querySelectorAll(
				"p._caption-lg-regular_r8lx6_16",
			);

			const user: string = Array.from(p_tags)
				.filter((ele) =>
					(ele as HTMLParagraphElement)?.innerText?.includes("@"),
				)
				.map((user) => {
					return (user as HTMLElement)?.innerText;
				})[0];

			console.log(user);
			const images: string[] = Array.from(imageElements)
				.map((element) =>
					(element as HTMLImageElement).getAttribute("src"),
				)
				.filter((ele) => ele != null);

			const totalContainer: Element | null = document.querySelector(
				".styles_container__NdYm1",
			);

			if (!totalContainer) {
				return { error: "total container not found" };
			}

			let total: string = Array.from(totalContainer.querySelectorAll("p"))
				.filter((text) =>
					text.innerText!.includes("sent to your bank account"),
				)
				.map((text) => text.innerHTML)[0];

			const totalNum = Number(total.split(" ")[0].replace("US$", ""));
			console.log(totalNum);
			return {
				total: totalNum,
				username: user,
				images: images,
				shippingLink: null,
			};
		},
	});

	let orderData = injectionResult.result;
	try {
		const shippingLink: string = await getShippingURL(tabId, 8000);
		console.log(
			`order for : ${orderData!.username} has link: ${shippingLink}`,
		);
		return new Order(
			"null",
			orderData?.images ?? [],
			orderData?.username ?? "error",
			orderData?.total ?? -1,
			shippingLink,
			orderData?.error ?? "",
			false,
			false,
		);
	} catch (err: any) {
		return errorOrder("no shipping link");
	}
}

/**
 * Order error factory
 * @param errorMsg
 * @returns Order instance
 */
export function errorOrder(errorMsg: string) {
	return new Order("error", ["error"], "error", -1, "error", errorMsg);
}

/**
 * Clicks DOM and gets a shipping url
 * @param tabId tab to click
 * @param timeoutMs timeout to wait for the shipping label to load: default 5 sec
 * @returns shipping url
 */
async function getShippingURL(
	tabId: number,
	timeoutMs: number = 12000,
): Promise<string> {
	const existingTabs = new Map<number, string | undefined>();
	for (const tab of await chrome.tabs.query({})) {
		if (tab.id !== undefined) {
			existingTabs.set(tab.id, tab.url);
		}
	}
	console.log("selector: ", SHIPPING_BUTTON_SELECTOR);

	const result = await chrome.scripting.executeScript({
		target: { tabId },
		func: (selector: string) => {
			try {
				const buttons = Array.from(document.querySelectorAll("button"));

				const btn = buttons.find((button) =>
					(button as HTMLButtonElement).innerText
						.trim()
						.toLowerCase()
						.includes("get shipping label"),
				) as HTMLButtonElement | undefined;

				if (!btn) {
					throw new Error("did not find button!");
				}
				btn.click();

				return { success: true };
			} catch (err: any) {
				window.alert(err.message);
				return { success: false, error: err.message };
			}
		},
		args: [SHIPPING_BUTTON_SELECTOR],
	});

	if (!result[0].result?.success) {
		throw new Error("No Shipping Label button found!");
	}

	console.log("[getShippingURL] clicked shipping button:", result[0].result);

	const interval: number = 250;
	const deadline: number = Date.now() + timeoutMs;
	let pollCount = 0;

	await new Promise((r) => setTimeout(r, interval));

	while (Date.now() < deadline) {
		const tabs: chrome.tabs.Tab[] = await chrome.tabs.query({});
		pollCount++;

		const newTabs = tabs.filter((tab) => {
			if (tab.id === undefined) {
				return false;
			}

			return !existingTabs.has(tab.id);
		});
		if (newTabs.length > 0) {
			console.log(
				`[getShippingURL] poll #${pollCount} — new tabs:`,
				newTabs.map((t) => ({
					id: t.id,
					url: t.url,
					status: t.status,
				})),
			);
		}

		const found: chrome.tabs.Tab | undefined = tabs.find((tab) => {
			if (tab.id === undefined) {
				return false;
			}

			const currentUrl = tab.url ?? tab.pendingUrl;
			if (!currentUrl?.includes("goshippo")) {
				return false;
			}

			const previousUrl = existingTabs.get(tab.id);
			const isNewTab = !existingTabs.has(tab.id);
			const urlChangedAfterClick = previousUrl !== currentUrl;

			return (
				(isNewTab || urlChangedAfterClick) && tab.status === "complete"
			);
		});

		if (found && found.url) {
			console.log(
				`[getShippingURL] found goshippo tab — id: ${found.id}, status: ${found.status}, url: ${found.url}`,
			);

			await chrome.tabs.remove(found.id!).catch((error) => {
				console.warn(`Failed to close goshippo tab: ${error}`);
			});

			return found.url;
		}
		await sleep(interval);
	}

	throw new Error("timeout out waiting for goshippo tab");
}

/**
 * polls selected objects
 * @param {Map<string, Object>} singleton state
 * @returns {Order[]} - array of Order objects that were selected
 */
export function pollSelectedObjects(orders: Map<string, Order>): Order[] {
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

/** sleeping function to stagger api calls */
export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
