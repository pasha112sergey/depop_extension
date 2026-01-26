//popup.js
let dataReceived = new Set();
let links = [];
let totalOrderInfo = {};
let working = false;
let shippedLinks = [];

function saveData() {
    chrome.storage.local.set(
        {
            savedUsernames: links,
            lastResults: Array.from(dataReceived),
            shippedLinks: Array.from(shippedLinks),
        },
        () => {
            console.log("Saved data/usernames to storage: ", dataReceived);
        }
    );
}

function clearTableBodies() {
    const table = document.querySelector("table");
    table.querySelectorAll("tbody.data-body").forEach((tb) => tb.remove());
}

function loadRows() {
    chrome.storage.local.get(
        ["lastResults", "shippedLinks"],
        ({ lastResults = [], shippedLinks: stored = [] }) => {
            dataReceived = new Set(lastResults);
            shippedLinks = stored; // now always an array
            clearTableBodies();
            addTableRows(Array.from(dataReceived));
        }
    );
}

document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["lastResults", "savedUsernames"], (result) => {
        console.log("saved users: ", result.savedUsernames);
        console.log("saved received: ", result.lastResults);

        if (Array.isArray(result.savedUsernames)) {
            links = result.savedUsernames;
        }
        // if (Array.isArray(result.savedReceived)) {
        //     dataReceived = new Set(result.savedReceived);
        // }
        if (Array.isArray(result.lastResults)) {
            console.log("results: ", result.lastResults);
            dataReceived = new Set(result.lastResults);
        }

        // if (Array.isArray(result.shippedLinks)) {
        //     console.log("//shippedLinks: ", result.//shippedLinks);
        //     //shippedLinks = new Set(result.//shippedLinks);
        // }
        loadRows();
    });

    const getUsernamesButton = document.getElementById("getUsernamesButton");
    const spinner = document.getElementById("loading");
    const getOrdersText = document.getElementById("getOrdersText");

    getUsernamesButton.addEventListener("click", () => {
        console.log("clicked!");
        spinner.classList.remove("hidden");
        getOrdersText.textContent = "Working";
        getUsernamesButton.disabled = true;

        chrome.runtime.sendMessage({ type: "get-data" }, (response) => {
            spinner.classList.add("hidden");
            getOrdersText.textContent = "Get orders";
            getUsernamesButton.disabled = false;

            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }
            console.log("response received: ", response);
            if (Array.isArray(response.results.resultsArray)) {
                chrome.storage.local.get(["lastResults"], (data) => {
                    console.log(
                        "data received from the call: ",
                        data.lastResults
                    );
                    dataReceived = data.lastResults;
                });

                // Now re-render everything from the updated Set
                addTableRows(Array.from(dataReceived));
            } else {
                const output = document.getElementById("insertHere");
                output.textContent = "No data received.";
            }
            console.log("Saving data....");
            saveData();
        });
    });

    const delSelected = document.getElementById("deleteAll");
    console.log(delSelected);
    delSelected.addEventListener("click", () => {
        const selectAllBtn = document.getElementById("selectAll");
        selectAllBtn.innerHTML = "Select All";
        allSelected = false;
        console.log("clicked");
        const boxes = document.querySelectorAll('input[type="checkbox"]');
        console.log("boxes: ", boxes);
        for (box of boxes) {
            if (box.checked) {
                const row = box.closest("tbody");
                console.log(row);
                const linkToClear = row.dataset.link;
                console.log(linkToClear, "<--- link to clear");
                if (linkToClear) {
                    chrome.runtime.sendMessage(
                        { type: "clear", link: linkToClear },
                        (response) => {
                            if (chrome.runtime.lastError) {
                                console.error(
                                    "Error clearing link:",
                                    chrome.runtime.lastError
                                );
                                return;
                            }
                            // 1) Pull the *updated* array from storage
                            chrome.storage.local.get(
                                ["lastResults"],
                                ({ lastResults }) => {
                                    // 2) Reset your in‐memory state completely
                                    dataReceived.clear();
                                    links = [];

                                    if (Array.isArray(lastResults)) {
                                        lastResults.forEach((item) => {
                                            dataReceived.add(item);
                                            links.push(item.username);
                                        });
                                    }

                                    // 3) Re‐render from scratch
                                    // clearTableBodies();
                                    // addTableRows(Array.from(dataReceived));
                                    // In your popup.js, anywhere (for example in your clear‐handler after you finish re‐render):
                                    window.location.reload();
                                    // 4) Persist your savedReceived / savedUsernames so storage stays in sync
                                    saveData();
                                }
                            );
                        }
                    );

                    let objectToRemove = null;
                    for (obj of dataReceived) {
                        if (obj.link == linkToClear) {
                            objectToRemove = obj;
                            break;
                        }
                    }
                    if (objectToRemove) {
                        dataReceived.delete(objectToRemove);
                    }
                    const username = objectToRemove?.username;
                    if (username) {
                        const idx = links.indexOf(username);
                        if (idx > -1) links.splice(idx, 1);
                    }

                    // 5) Remove the row’s <tbody> from the DOM
                    row.remove();
                    console.log("hello!");
                    console.log(dataReceived);
                    console.log(links);
                    saveData();
                }
            }
        }
    });
});

const tables = document.getElementsByTagName("table");
const table = tables[0];
let allSelected = false;

async function addTableRows(responseIterable) {
    const response = Array.isArray(responseIterable)
        ? responseIterable
        : Array.from(responseIterable);
    if (response.length === 0) return;
    clearTableBodies();
    for (resp of response) {
        if (!resp.username) continue;
        console.log("resp looks like: ", resp);
        createRows(resp);

        // 1) After you render your table rows (or on DOMContentLoaded), wire this up:
        document.querySelectorAll("details").forEach((detail) => {
            detail.addEventListener("toggle", (e) => {
                // If this <details> was just opened…
                if (detail.open) {
                    // Close every other <details>
                    document.querySelectorAll("details").forEach((other) => {
                        if (other !== detail) other.open = false;
                    });
                }
            });
        });

        // await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

async function createRows(resp) {
    const table = document.querySelector("table");
    // Create a <tbody> wrapper for this one row
    const wrapper = document.createElement("tbody");
    wrapper.classList.add("data-body");
    // Attach the receipt URL so we can reference it later
    wrapper.dataset.link = resp.link;

    // Build the row’s HTML
    wrapper.innerHTML = `
          <tr class="text-black group">
            <td class="p-2 pt-2.5 bg-emerald-400 text-center group-hover:bg-emerald-300">
              <label><input class="block cursor-pointer w-full" type="checkbox"/></label>
            </td>
            <td class="p-2 bg-emerald-300 group-hover:bg-emerald-200">
              <div class="flex items-center w-full">
                <span id="usernameCell" class="usernameCell flex-1 text-center font-bold">${
                    resp.username
                }</span>
              </div>
            </td>
            <td class="p-2 relative text-center bg-emerald-300 group-hover:bg-emerald-200 content-stretch">
              <details class="relative">
                <summary class="relative cursor-pointer select-none text-black font-bold w-full">
                  View Orders
                  <button class="deleteItem absolute right-0 top-1/2 -translate-y-1/2">
                    <img src="../images/trash.png" alt="Remove"
                         class="w-7 h-7 hover:bg-emerald-100 hover:rounded-full p-1"/>
                  </button>
                </summary>
                    <div id="images-${resp.username.slice(1)}"
                        class="absolute -left-[100px] mt-1 w-auto overflow-scroll h-max-[75px]
                                flex flex-col bg-white text-black font-bold
                                border-gray-300 rounded-xl shadow-md p-2 z-10">

                            <div class="hidden" id="shippingLink">${
                                resp.label
                            }</div>

                            <div class="hidden" id="link">${resp.link}</div>
                            <div class="hidden" id="total">${resp.total}</div>
                    </div>
              </details>
            </td>
          </tr>
        `;

    // Append that <tbody> (with its <tr>) into the table
    table.appendChild(wrapper);

    console.log(
        "label for the current resp is: ",
        resp.label,
        "value of comparison: "
        //shippedLinks.has(resp.link)
    );

    console.log(
        "shippedLinks.includes(resp.link)",
        shippedLinks.includes(resp.link)
    );

    if (shippedLinks.includes(resp.link)) {
        wrapper.querySelector("tr").classList.remove("group");
        wrapper
            .querySelector(`#usernameCell`)
            .classList.remove("bg-emerald-300");

        wrapper.querySelector("#usernameCell").classList.add("bg-yellow-500");
        console.log("changed color");
    }
    // Fill in the “images” part under View Orders
    const newRow = wrapper.querySelector("tr");
    let count = 0;
    for (let image of resp.images) {
        const ordersContainer = newRow.querySelector(
            `#images-${resp.username.slice(1)}`
        );
        const sizeField = document.createElement("div");
        sizeField.classList.add("mb-2");
        sizeField.innerHTML = `
            <div id="image-${count++}" class="pt-2 flex flex-row gap-2 items-center">



              <img src="${image}" alt="order1" class="object-cover rounded-full h-15 w-15"/>
              <label class="block text-[10px] text-black mb-1">Enter size:</label>
              <input type="text" placeholder="28-46"
                    class="w-[200px] h-7 px-2 py-1 border rounded-full text-[10px]"/>
            </div>
          `;
        ordersContainer.appendChild(sizeField);
    }

    // Single-row delete button: remove only this row, send its link to background
    const delBtn = newRow.querySelector(".deleteItem");
    delBtn.addEventListener("click", () => {
        console.log("Clicked delete");
        const wrapperRow = delBtn.closest("tbody");
        const linkToClear = wrapperRow.dataset.link;
        console.log("linkToClear on line 282", linkToClear);
        if (linkToClear) {
            // 2) Tell background to un-visit it
            chrome.runtime.sendMessage(
                { type: "clear", link: linkToClear },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(
                            "Error clearing link:",
                            chrome.runtime.lastError
                        );
                    } else {
                        console.log(
                            "Background acknowledged clear:",
                            linkToClear
                        );
                    }
                }
            );
        }

        // 3) Remove from dataReceived: find the object whose .link matches
        let objectToRemove = null;
        for (let obj of dataReceived) {
            if (obj.link === linkToClear) {
                objectToRemove = obj;
                break;
            }
        }
        if (objectToRemove) {
            dataReceived.delete(objectToRemove);
        }

        // 4) Remove from links array: find that object’s username
        const username = objectToRemove?.username;
        if (username) {
            const idx = links.indexOf(username);
            if (idx > -1) links.splice(idx, 1);
        }

        // 5) Remove the row’s <tbody> from the DOM
        wrapperRow.remove();
        console.log("hello!");
        console.log(dataReceived);
        console.log(links);

        saveData();
    });

    saveData();
}

const selectAllBtn = document.getElementById("selectAll");
selectAllBtn.addEventListener("click", () => {
    if (dataReceived.size > 0) {
        const checkboxes = table.querySelectorAll('input[type="checkbox"');
        allSelected = !allSelected;
        checkboxes.forEach((cb) => (cb.checked = allSelected));
        selectAllBtn.textContent = allSelected ? "Deselect all" : "Select all";
    }
});

const updateSheetBtn = document.getElementById("updateSheet");
updateSheetBtn.addEventListener("click", () => {
    const checkboxes = table.querySelectorAll('input[type="checkbox"]');

    const rows = [];
    checkboxes.forEach((cb) => {
        if (cb.checked) {
            // create table element
            const wrapperTable = document.createElement("table");
            const wrapperBody = document.createElement("tbody");
            wrapperTable.appendChild(wrapperBody);

            const row = cb.closest("tbody");

            // grab username and orders container
            const username = row.querySelector("#usernameCell").innerHTML;
            console.log("username in create Email: ", username);
            const orderImagesAndSizes = row.querySelector(
                `#images-${username.slice(1)}`
            );

            const shippingLink = row.querySelector("#shippingLink").innerHTML;
            console.log("shipping Link innerHTML: ", shippingLink);
            //log
            console.log("orders container: ", orderImagesAndSizes);

            const link = row.querySelector("#link").innerHTML;
            if (link) console.log("link in update sheet: ");
            else console.log("no link found");
            // console.log("link in shipped links? ", //shippedLinks.has(link));
            // console.log("shippingLinks: ", Array.from(//shippedLinks));
            // loop through order entries

            const total = row.querySelector("#total");
            console.log("total element on 410: ", total);

            const images = [];
            for (let count = 0; count < 15; count++) {
                const order = orderImagesAndSizes.querySelector(
                    `#image-${count}`
                );
                console.log(`order: #image-${count} is ${order}`);
                if (order) {
                    // Grab the first <img> and the input value
                    const img = order.querySelector("img");
                    // const size = order.querySelector("input")?.value || "";
                    images.push(img.src);
                } else {
                    break;
                }
            }
            rows.push({
                username: username,
                images: images,
                shippingLink: shippingLink,
                link: link,
                total: total.innerHTML,
            });
        }
    });

    const rowsToSend = [];
    for (let row of rows) {
        const sheetRow = [
            new Date().toDateString(),
            row.images.map((url) => `=IMAGE("${url}", 4, 100, 100)`).join(" "),
            row.username,
            "sent",
            row.total,
        ];
        console.log("row to send: ", sheetRow);
        rowsToSend.push(sheetRow);
    }
    chrome.runtime.sendMessage(
        {
            type: "update-sheet",
            rowsToSend: rowsToSend,
        },
        (response) => {
            console.log("response: ", response);
        }
    );
    // TODO: build response architecture and be done
});

//
const sendEmailsBtn = document.getElementById("sendEmails");
sendEmailsBtn.addEventListener("click", () => {
    console.log("clicked send emails");

    const checkboxes = table.querySelectorAll('input[type="checkbox"');

    const emailBody = [];
    checkboxes.forEach((cb) => {
        if (cb.checked) {
            // create table element
            const wrapperTable = document.createElement("table");
            const wrapperBody = document.createElement("tbody");
            wrapperTable.appendChild(wrapperBody);

            const row = cb.closest("tbody");

            // grab username and orders container
            const username = row.querySelector("#usernameCell").innerHTML;
            console.log("username in create Email: ", username);
            const orderImagesAndSizes = row.querySelector(
                `#images-${username.slice(1)}`
            );

            const shippingLink = row.querySelector("#shippingLink").innerHTML;
            console.log("shipping Link innerHTML: ", shippingLink);
            //log
            console.log("orders container: ", orderImagesAndSizes);

            const link = row.querySelector("#link").innerHTML;
            if (link) console.log("link in send email: ");
            else console.log("no link found");
            // console.log("link in shipped links? ", //shippedLinks.has(link));
            // console.log("shippingLinks: ", Array.from(//shippedLinks));
            // loop through order entries
            for (let count = 0; count < 15; count++) {
                const order = orderImagesAndSizes.querySelector(
                    `#image-${count}`
                );
                console.log(`order: #image-${count} is ${order}`);
                if (order) {
                    // Grab the first <img> and the input value
                    const img = order.querySelector("img");
                    const size = order.querySelector("input")?.value || "";

                    const tableRow = document.createElement("tr");
                    tableRow.innerHTML = `
                        <td>
                        <img
                            src="${img.src}"
                            alt="Icon"
                            style="width: 300px; height: 300px; object-fit: cover;"
                        />
                        </td>
                        <td>
                        <span style="font-size: 3rem; line-height: 1.2;">
                            ${size}
                        </span>
                        </td>
                    `;
                    wrapperBody.appendChild(tableRow);
                    console.log("row appended: ", row);
                } else {
                    break;
                }
            }
            console.log("wrapper div: ", wrapperTable);
            const wrapperString = wrapperTable.outerHTML;
            emailBody.push({
                username: username,
                html: wrapperString,
                shippingLink: shippingLink,
                link: link,
            });
        }
    });

    console.log("emailBody: ", emailBody);
    for (email of emailBody) {
        console.log("email sent: ", email);
        sendEmailsBtn.innerHTML = "Sent!";
        chrome.runtime.sendMessage(
            {
                type: "send-email",
                to: "pasha112sergey@gmail.com",
                subject: `depop-${email.username}`,
                body: email.html,
                shippingLink: email.shippingLink,
            },
            (response) => {}
        );

        shippedLinks.push(email.link);
        console.log("shipped Links after sending email: ", shippedLinks);
        chrome.storage.local.set({ shippedLinks: shippedLinks }, () => {
            console.log("Updated shipped flag in storage");
        });
        saveData();
        //shippedLinks.add(email.link);
        // chrome.storage.local.set({
        //     //shippedLinks: Array.from(//shippedLinks),
        // });
        // console.log(a
        //     "shipped links after sending the email:",
        //     Array.from(//shippedLinks)
        // );
        sendEmailsBtn.innerHTML = "Send Selected";
    }
});
