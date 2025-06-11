import * as parse5 from "parse5";

console.log("parse5.parse is", typeof parse5.parse);
let visitedUrls = [];

console.log(
    "Manifest client ID:",
    chrome.runtime.getManifest().oauth2.client_id
);
console.log("Redirect URI:", chrome.identity.getRedirectURL());

// background.js

// Helper to base64-url-encode a string
function base64UrlEncode(str) {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Fetch an OAuth2 token for Gmail
function getGmailToken(interactive = true) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError || !token) {
                return reject(
                    chrome.runtime.lastError || new Error("No token")
                );
            }
            resolve(token);
        });
    });
}

async function sendGmailMultipart({ to, subject, htmlBody }) {
    const token = await getGmailToken(true);

    // const pdfBase64 = await fetchPdfBase64InPage(tabId, textBody);

    const messageLines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset="UTF-8"`,
        ``,
        htmlBody,
    ];

    const raw = base64UrlEncode(messageLines.join("\r\n"));

    // 2) Send it
    const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw }),
        }
    );

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Gmail API error: ${err.error.message}`);
    }
    return res.json();
}

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

        chrome.tabs.update(tabId, { url, active: false }).catch((error) => {
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

/**
 * Click the label-button in page, then wait up to `timeoutMs` ms
 * for a brand‐new tab (i.e. not in `beforeTabs`) whose URL contains "goshippo".
 */
async function clickAndGetGoshippoUrl(tabId, timeoutMs = 500) {
    // 1) Capture tabs that already exist
    const before = new Set((await chrome.tabs.query({})).map((t) => t.id));

    // 2) Click the button in-page
    await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const btn = document.querySelector(
                "button.styles_buttonMinimal__iE3by.styles_downloadLabelButton--label__3i_n0"
            );
            if (!btn) throw new Error("Label button not found");
            btn.click();
        },
    });

    // 3) Poll for the new tab
    const interval = 200;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const tabs = await chrome.tabs.query({});
        // Find a tab that wasn’t in `before` and whose URL has "goshippo"
        const found = tabs.find(
            (t) => !before.has(t.id) && t.url?.includes("goshippo")
        );
        if (found) {
            // 4) Close it and return its URL
            chrome.tabs.remove(found.id).catch(() => {});
            return found;
        }
        await new Promise((r) => setTimeout(r, interval));
    }
    const tabs = await chrome.tabs.query({});
    const found = tabs.find((t) => t.url?.includes("depop"));
    if (found) {
        return "NOT_URL";
    }
    console.log("timed out in click and get");
    throw new Error("Timed out waiting for goshippo tab");
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
    console.log("found label button? ", foundGetShippingLabelBtn);
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

            // // get the shipping label button
            // const getLabelBtn = document.querySelector(
            //     "button.styles_buttonMinimal__iE3by.styles_downloadLabelButton__i3Wza.styles_downloadLabelButton--label__3i_n0.styles_button__q2hA8"
            // );

            let ret = {
                username: user,
                images: images,
                shippingLink: null,
            };

            // // click it
            // getLabelBtn.click();

            return ret;

            // make a dictionary: {username: [images]} and return it
        },
    });

    let ret = injectionResult.result;

    let shippingLink;
    try {
        shippingLink = await clickAndGetGoshippoUrl(tabId, /*timeoutMs=*/ 8000);
    } catch (err) {
        return { error: err.message };
    }

    console.log("✅ Got goshippo URL:", shippingLink);

    chrome.tabs.remove(shippingLink.id).catch(() => {});

    ret.shippingLink = shippingLink.url;
    console.log("ret: ", ret);
    return ret;
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
                        console.log("raw scrape result: ", scrapeResult);
                        console.log(
                            `IMAGE(S) FOUND FOR USER ${scrapeResult.username}:---------> ${scrapeResult.images}, ${scrapeResult.shippingLink}`
                        );

                        if (
                            scrapeResult.shippingLink &&
                            scrapeResult.shippingLink !== "NOT_URL"
                        ) {
                            // chrome.downloads.download(
                            //     {
                            //         url: scrapeResult.shippingLink, // ← use scrapeResult.shippingLink
                            //         filename: `label-${Date.now()}.pdf`,
                            //         saveAs: false,
                            //     },
                            //     (downloadId) => {
                            //         if (chrome.runtime.lastError) {
                            //             console.error(
                            //                 "Download failed:",
                            //                 chrome.runtime.lastError
                            //             );
                            //         } else {
                            //             console.log(
                            //                 "Download started, id=",
                            //                 downloadId
                            //             );
                            //         }
                            //     }
                            // );

                            resultsArray.push({
                                username: scrapeResult.username,
                                images: scrapeResult.images,
                                link,
                                label: scrapeResult.shippingLink, // or rename to “shippingLink”
                            });
                        }
                    }
                } catch (innerErr) {
                    resultsArray.push({ link, error: innerErr.message });
                }
            }
            navigateToUrl(tabId, "https://depop.com/sellinghub/sold-items");
            chrome.storage.local.set({ lastResults: resultsArray }, () => {
                console.log("results array stored: ", resultsArray);
            });
            sendResponse({ resultsArray: resultsArray });
            console.log("sent response on line 408: ", resultsArray);
        })();

        // Tell Chrome we’ll call sendResponse asynchronously
    }
    if (message.type === "clear") {
        const idx = visitedUrls.indexOf(message.link);
        console.log("index to remove: ", idx);
        if (idx !== -1) {
            visitedUrls.splice(idx, 1);
            console.log(visitedUrls);
        }

        chrome.storage.local.get(["lastResults"], (data) => {
            const lastResults = Array.isArray(data.lastResults)
                ? [...data.lastResults]
                : [];

            console.log("lastResults before deletion: ", lastResults);

            for (let i = 0; i < lastResults.length; i++) {
                console.log(
                    "Comparing",
                    JSON.stringify(lastResults[i].link),
                    "=== message.link ===",
                    JSON.stringify(message.link)
                );

                if (lastResults[i].link === message.link) {
                    console.log(
                        "removing from lastResults at index: ",
                        i,
                        lastResults[i]
                    );
                    const updated = lastResults.filter(
                        (item) => item.link !== message.link
                    );

                    console.log(
                        "Removed link, new lastResults (filtered):",
                        updated.map((i) => i.username)
                    );

                    chrome.storage.local.set({ lastResults: updated }, () => {
                        console.log(
                            "Saved data/usernames to storage: ",
                            lastResults
                        );
                    });
                    break;
                }
            }

            console.log("lastResults after removal: ", lastResults);
        });

        sendResponse({ success: true });
    }
    if (message.type === "send-email") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) {
                return sendResponse({ success: false, error: "No active tab" });
            }
            const tabId = tab.id;

            console.log("received send-email type");
            console.log(message.body);
            sendGmailMultipart({
                tabId,
                to: message.to,
                subject: message.subject,
                htmlBody: `
                <h2 style="font-family: Arial, sans-serif;">Depop Order</h2>
                <p style="font-family: Arial, sans-serif;">Here are the order details:</p>
                ${message.body}
                <h2 style="font-family: Arial, sans-serif;">${message.shippingLink}</h2>
            `,
            })
                .then((r) => sendResponse({ success: true, id: r.id }))
                .catch((err) => {
                    console.log(err.message);
                    sendResponse({ success: false, error: err.message });
                });
            return true;
        });
    }
    return true;
});

function getCookieHeader(url) {
    return new Promise((resolve) => {
        chrome.cookies.getAll({ url }, (cookies) => {
            const header = cookies
                .map((c) => `${c.name}=${c.value}`)
                .join("; ");
            resolve(header);
        });
    });
}

// async function fetchPdfAsBase64(url) {
//     const response = await fetch(url, {
//         method: "GET",
//         // this tells Chrome to attach any cookies it has for deliver.goshippo.com
//         credentials: "include",
//     });
//     if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
//     const buffer = await response.arrayBuffer();
//     let binary = "";
//     for (let byte of new Uint8Array(buffer)) {
//         binary += String.fromCharCode(byte);
//     }
//     return btoa(binary);
// }

async function fetchPdfBase64InPage(tabId, url) {
    const [{ result: base64 }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (pdfUrl) => {
            // runs inside the page—has its cookies
            const resp = await fetch(pdfUrl, { credentials: "include" });
            if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
            const buf = await resp.arrayBuffer();
            // convert to binary string then btoa
            let bin = "";
            new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
            return btoa(bin);
        },
        args: [url],
    });
    return base64;
}
