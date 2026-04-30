import ChromeMessageType from "./messageTypes";
import Order from "../models/Order";

enum Color {
    SUCCESS = "#4aedae",
    FAILURE = "#d13b3b",
}

const visitedUrls: string[] = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void sender;

    switch (message.type) {
        case ChromeMessageType.GET_ORDERS:
            (async () => {
                console.log("GET_ORDERS received in service worker");
                const [tab] = await chrome.tabs.query({
                    active: true,
                    lastFocusedWindow: true,
                });

                console.log("active tab:", tab);

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

                console.log("injectionResult:", injectionResult);
                const receiptLinks = injectionResult.result;

                if (!Array.isArray(receiptLinks) || receiptLinks.length === 0) {
                    sendResponse({ error: "no receipt links found. " });
                    return;
                }

                const orderArray: Order[] = [];
                const processed: Map<string, boolean> = new Map();

                for (let i = 0; i < 1; i++) {
                    const rLink = receiptLinks[i];
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

                        const scrapedOrder: Order =
                            await scrapeDataFromDom(tabId);
                        scrapedOrder.url = rLink;

                        if (
                            !scrapedOrder.error &&
                            scrapedOrder.shippingLink !== "error"
                        ) {
                            orderArray.push(scrapedOrder);
                            processed.set(rLink, true);
                        } else {
                            throw new Error(
                                scrapedOrder.error ??
                                    "unknown order error on line 84",
                            );
                        }
                    } catch (error: any) {
                        orderArray.push(errorOrder(error));
                        processed.set(rLink, false);
                    }
                }

                await navigateToUrl(
                    tabId,
                    "https://depop.com/sellinghub/sold-items",
                );

                // here should add color to the links that were picked!
                console.log("orderArray: ", orderArray);

                chrome.storage.local.set({
                    lastResults: orderArray,
                });

                // Result is read by the popup via chrome.storage.onChanged

                // color dom
                try {
                    const processedLinks = receiptLinks.filter((l) =>
                        processed.get(l),
                    );

                    await chrome.scripting.executeScript({
                        target: { tabId },
                        func: (links: string[], successLinks: string[]) => {
                            // sets the color of the link
                            function setColor(link: string, color: string) {
                                const parents = Array.from(
                                    document.querySelectorAll("a"),
                                )
                                    .filter((a) => a.href == link)
                                    .map(
                                        (ele) =>
                                            ele.parentNode as HTMLDivElement,
                                    );

                                console.log("parents selected: ", parents);
                                const parent = parents.find((p) => {
                                    console.log("p testing: ", p);
                                    return (
                                        p.className == "styles_wrapper__JTFc9"
                                    );
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

            return true;
    }
});

/**
 * Sets the link element's background color
 * @param {string} link : string of the link
 * @param {Color} color : color to set the background color to
 * @returns {void}
 * @throws {Error}
 */
function setLinkContainerColor(link: string, color: Color): void {
    const linkEle: HTMLAnchorElement | null = document.querySelector(
        `a[href="${link}"]`,
    ) as HTMLAnchorElement;

    console.log(linkEle);

    if (!linkEle) {
        console.log("linkEle not found");
        throw new Error("HTML element corresponding to link not found!");
    } else {
        linkEle.style!.backgroundColor = `${color}`;
        console.log("linkEle style set!");
    }
}

/**
 * @returns string[] Returns the links of each receipt element
 */
function getLinks(): string[] {
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
async function waitForSelector(
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
async function navigateToUrl(
    tabId: number,
    url: string,
    timeoutMs: number = 15000,
): Promise<void> {
    console.log("in navigate");

    if (visitedUrls.includes(url)) {
        return Promise.resolve();
    }

    visitedUrls.push(url);

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
async function scrapeDataFromDom(tabId: number): Promise<Order> {
    console.log("in scrapeDataFromDom");
    const foundImage = await waitForSelector(tabId, "img", 10000);
    console.log("found image!", foundImage);

    if (!foundImage) {
        return errorOrder("no image found");
    }

    const foundGetShippingLabelBtn = await waitForSelector(
        tabId,
        'button[title*="shipping label" i]',
        10000,
    );

    if (!foundGetShippingLabelBtn) {
        return errorOrder("no shipping link!");
    }
    console.log("found shipping button!");

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
        return new Order(
            "null",
            orderData?.images ?? [],
            orderData?.username ?? "error",
            orderData?.total ?? -1,
            shippingLink,
            orderData?.error ?? "",
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
function errorOrder(errorMsg: string) {
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
    timeoutMs: number = 500,
): Promise<string> {
    const existingTabs = new Set(
        (await chrome.tabs.query({})).map((t) => t.id),
    );

    const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            try {
                const btn = document.querySelector(
                    'button[title*="shipping label" i]',
                ) as HTMLButtonElement;

                if (!btn) throw new Error("Label button not found!");
                btn.click();
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        },
    });

    if (!result[0].result?.success) {
        throw new Error("No Shipping Label button found!");
    }

    const interval: number = 200;
    const deadline: number = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const tabs: chrome.tabs.Tab[] = await chrome.tabs.query({});

        const found: chrome.tabs.Tab | undefined = tabs.find(
            (t) => !existingTabs.has(t.id) && t.url?.includes("goshippo"),
        );

        if (found && found.url) {
            chrome.tabs.remove(found.id!).catch((error) => {
                throw new Error(`Failed to close tab! ${error}`);
            });
            return found.url;
        }
        await new Promise((r) => setTimeout(r, interval));
    }

    const tabs = await chrome.tabs.query({});
    const found = tabs.find((t) => t.url?.includes("depop"));
    if (found) {
        return "error";
    }
    throw new Error("timeout out waiting for goshippo tab");
}
