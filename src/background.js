import * as parse5 from "parse5";

console.log("parse5.parse is", typeof parse5.parse);
let visitedUrls = [];

// In your background service worker (background.js or background.bundle.js):

// chrome.webRequest.onBeforeRequest.addListener(
//     (details) => {
//         // details.url is the exact shipping‐label JSON endpoint
//         if (details.url.includes("/api/v1/shipping/label/")) {
//             console.log("📦 [bg] caught label‐JSON request:", details.url);
//         }
//         return {};
//     },
//     { urls: ["*://webapi.depop.com/api/v1/shipping/label/*"] }
// );

async function waitForSelector(tabId, selector, timeoutMs = 10000) {
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
        await new Promise((r) => setTimeout(r, 25));
    }
    return false;
}

// background.js (Manifest V3 service worker)
function navigateToUrl(tabId, url, timeoutMs = 15000) {
    if (visitedUrls.includes(url)) {
        return Promise.resolve();
    }
    visitedUrls.push(url);
    return new Promise((resolve, reject) => {
        let timeoutHandle = null;

        function onUpdatedListener(updatedTabId, changeInfo) {
            if (updatedTabId !== tabId) return;
            if (changeInfo.status === "complete") {
                chrome.tabs.onUpdated.removeListener(onUpdatedListener);
                clearTimeout(timeoutHandle);
                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(onUpdatedListener);

        chrome.tabs.update(tabId, { url }).catch((error) => {
            chrome.tabs.onUpdated.removeListener(onUpdatedListener);
            clearTimeout(timeoutHandle);
            reject(new Error("tabs.update failed, ", error.message));
        });

        timeoutHandle = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(onUpdatedListener);
            chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const body = document.getElementsByTagName("body")[0];
                    body.classList.remove("blur-xl");
                },
            });
            reject(new Error("navigateToUrl timed out"));
        }, timeoutMs);
    });
}

async function scrapeDataFromDom(tabId) {
    const foundImage = await waitForSelector(
        tabId,
        "img.styles_image__nuVfa",
        10000
    );
    if (!foundImage) {
        return {
            error: "Could not load image elements",
        };
    }

    const foundGetShippingLabelBtn = await waitForSelector(
        tabId,
        "button.styles_buttonMinimal__iE3by.styles_downloadLabelButton__i3Wza.styles_downloadLabelButton--label__3i_n0.styles_button__q2hA8",
        10000
    );
    console.log("found label? ", foundGetShippingLabelBtn);
    if (!foundGetShippingLabelBtn) {
        return {
            error: "could not load get shipping label button",
        };
    }

    const [injectionResult] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const imageElements = document.querySelectorAll(
                "img.styles_image__nuVfa"
            );
            if (!imageElements) {
                return { error: "No aside img found in live DOM" };
            }
            const p_tags = document.querySelectorAll(
                "p._text_bevez_41._shared_bevez_6._normal_bevez_51._caption1_bevez_55"
            );
            const usernames = Array.from(p_tags)
                .filter((ele) => {
                    if (ele.textContent.includes("@")) return true;
                    else return false;
                })
                .map((user) => {
                    return user.innerHTML;
                });
            const images = Array.from(imageElements).map((element) => {
                return element.getAttribute("src");
            });
            const user = usernames[0];

            // get the shipping label
            const getLabelBtn = document.querySelector(
                "button.styles_buttonMinimal__iE3by.styles_downloadLabelButton__i3Wza.styles_downloadLabelButton--label__3i_n0.styles_button__q2hA8"
            );

            return {
                username: user,
                images: images,
            };
            // make a dictionary: {username: [images]} and return it
        },
    });
    return injectionResult.result;
}

// 1) When the user clicks the extension icon, show popup.html
chrome.action.onClicked.addListener((tab) => {
    chrome.action.setPopup({ popup: "./src/popup.html" });
});

// 2) Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(visitedUrls);
    if (message.type === "get-data") {
        (async () => {
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            if (!tab?.id) {
                sendResponse({ error: "No active tab" });
                return;
            }
            const tabId = tab.id;

            const [linksResult] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    // Now we are in the page context—define helpers here, too:
                    function testValidDate(p) {
                        return (
                            p.classList.contains("_text_bevez_41") &&
                            p.classList.contains("_shared_bevez_6") &&
                            p.classList.contains("_normal_bevez_51") &&
                            p.textContent === "Ship order"
                        );
                    }
                    function getInfo() {
                        let receipts = Array.from(
                            document.getElementsByClassName(
                                "styles_receiptsListWrapper__bdK1V"
                            )
                        );
                        return receipts.filter((ele) =>
                            Array.from(ele.getElementsByTagName("p")).some(
                                testValidDate
                            )
                        );
                    }

                    // Call the helper in the page’s scope:
                    const receipts = getInfo();
                    // If you return actual DOM nodes, they get serialized to `null`.
                    // Instead, return just the data you care about—e.g. href strings:
                    const links = receipts
                        .map((ele) => {
                            const a = ele.querySelector(
                                "a.styles_unstyledLink__DsttP"
                            );
                            return a ? a.href : null;
                        })
                        .filter((href) => href != null);
                    return links;
                },
            });

            // Because we returned an array of href‐strings, injectionResult.result is that array:
            const receiptLinks = linksResult.result; // e.g. ["https://depop.com/…", …]
            if (!Array.isArray(receiptLinks) || receiptLinks.length === 0) {
                sendResponse({ error: "No receipt links found." });
                return;
            }
            const resultsArray = [];
            for (const link of receiptLinks) {
                try {
                    await navigateToUrl(tabId, link);
                    // await new Promise((resolve) => setTimeout(resolve, 650));
                    const foundImage = await waitForSelector(
                        tabId,
                        "img.styles_image__nuVfa",
                        10000
                    );
                    if (!foundImage) {
                        resultsArray.push({ link, error: "never loaded" });
                        continue;
                    }
                    const scrapeResult = await scrapeDataFromDom(tabId);
                    if (scrapeResult.error) {
                        resultsArray.push({ link, error: scrapeResult.error });
                    } else {
                        // console.log("raw scrape result: ", scrapeResult);
                        console.log(
                            `IMAGE(S) FOUND FOR USER ${scrapeResult.username}:---------> ${scrapeResult.images}`
                        );
                        resultsArray.push({
                            username: scrapeResult.username,
                            images: scrapeResult.images,
                            link: link,
                        });
                    }
                } catch (innerErr) {
                    resultsArray.push({ link, error: innerErr.message });
                }
            }
            console.log("results array to send: ", resultsArray);
            navigateToUrl(tabId, "https://depop.com/sellinghub/sold-items");
            sendResponse({ resultsArray: resultsArray });
        })();

        // Tell Chrome we’ll call sendResponse asynchronously
    }
    if (message.type === "clear") {
        const idx = visitedUrls.indexOf(message.link);
        if (idx !== -1) {
            visitedUrls.splice(idx, 1);
            console.log(
                "Removed from visitedUrls",
                message.link,
                "->",
                visitedUrls
            );
        }
        console.log(visitedUrls);
        sendResponse({ success: true });
    }
    return true;
});

// <--------------------------------------------->
// <--------------------------------------------->
// <--------------------------------------------->
// CATCHING THE LABEL REQUEST
// <--------------------------------------------->
// <--------------------------------------------->
// <--------------------------------------------->
// background.bundle.js

// background.bundle.js
// background.bundle.js

// 1) Whenever *any* tab finishes loading, try to attach if it’s a selling-hub URL
chrome.tabs.onUpdated.addListener(function onUpdate(tabId, changeInfo) {
    const newUrl = changeInfo.url; // only fires when URL *actually* changes
    if (newUrl?.includes("goshippo")) {
        console.log("🕵️‍♂️ Goshippo tab navigated to:", newUrl);
        chrome.tabs.remove(tabId).catch(() => {
            /* ignore missing-tab errors */
        });
    }
});
