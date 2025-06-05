let dataReceived = new Set();
let links = [];
let totalOrderInfo = {};
let working = false;
function saveData() {
    const arrayToSave = Array.from(dataReceived);
    chrome.storage.local.set(
        {
            savedReceived: arrayToSave,
            savedUsernames: links,
        },
        () => {
            console.log(
                "Saved data/usernames to storage: ",
                dataReceived,
                links
            );
        }
    );
}

function clearTableBodies() {
    const table = document.querySelector("table");
    table.querySelectorAll("tbody").forEach((tb) => tb.remove());
}

function loadRows() {
    if (dataReceived.size > 0) {
        console.log("dataReceived: ", dataReceived);
        clearTableBodies();
        addTableRows(Array.from(dataReceived));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["savedReceived", "savedUsernames"], (result) => {
        console.log("saved users: ", result.savedUsernames);
        console.log("saved received: ", result.savedReceived);

        if (Array.isArray(result.savedUsernames)) {
            links = result.savedUsernames;
        }
        if (Array.isArray(result.savedReceived)) {
            dataReceived = new Set(result.savedReceived);
        }

        console.log("current usernames: ", links);
        console.log("current dataReceived: ", dataReceived);
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
            if (Array.isArray(response.resultsArray)) {
                // response.resultsArray is an array of objects { username, images }
                // We want to merge them into our dataReceived Set (no duplicates).

                response.resultsArray.forEach((item) => {
                    // If the Set doesn’t already have an entry with the same username, add it.
                    // However, since Set uses object identity and we want to dedupe by username,
                    // we need to check manually:
                    const alreadyExists = Array.from(dataReceived).some(
                        (existing) => existing.username === item.username
                    );
                    if (!alreadyExists) {
                        dataReceived.add(item);
                    }
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
                        {
                            type: "clear",
                            link: linkToClear,
                        },
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
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

async function createRows(resp) {
    const table = document.querySelector("table");
    // Create a <tbody> wrapper for this one row
    const wrapper = document.createElement("tbody");
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
                <span class="usernameCell flex-1 text-center font-bold">${
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
                            border-gray-300 rounded-xl shadow-md p-2 z-10"></div>
              </details>
            </td>
          </tr>
        `;

    // Append that <tbody> (with its <tr>) into the table
    table.appendChild(wrapper);

    // Fill in the “images” part under View Orders
    const newRow = wrapper.querySelector("tr");
    for (let order of resp.images) {
        const ordersContainer = newRow.querySelector(
            `#images-${resp.username.slice(1)}`
        );
        const sizeField = document.createElement("div");
        sizeField.classList.add("mb-2");
        sizeField.innerHTML = `
            <div class="pt-2 flex flex-row gap-2 items-center">
              <img src="${order}" alt="order1" class="object-cover rounded-full h-15 w-15"/>
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
    const checkboxes = table.querySelectorAll('input[type="checkbox"');
    allSelected = !allSelected;
    checkboxes.forEach((cb) => (cb.checked = allSelected));
    selectAllBtn.textContent = allSelected ? "Deselect all" : "Select all";
});
