let dataReceived = [];
let usernames = [];

function saveData() {
    chrome.storage.local.set(
        {
            savedReceived: dataReceived,
            savedUsernames: usernames,
        },
        () => {
            console.log(
                "Saved data/usernames to storage: ",
                dataReceived,
                usernames
            );
        }
    );
}

function loadRows() {
    if (dataReceived.length > 0) {
        console.log("dataReceived: ", dataReceived);
        loadTableRows(dataReceived);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["savedReceived", "savedUsernames"], (result) => {
        console.log("saved users: ", result.savedUsernames);
        console.log("saved received: ", result.savedReceived);

        if (Array.isArray(result.savedUsernames)) {
            usernames = result.savedUsernames;
        }
        if (Array.isArray(result.savedReceived)) {
            dataReceived = result.savedReceived;
        }

        console.log("current usernames: ", usernames);
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
            if (response.resultsArray) {
                dataReceived = response.resultsArray;
                addTableRows(dataReceived);
            } else {
                output.textContent = "No data received.";
            }
            console.log("Saving data....");
            saveData();
        });
    });
});

const tables = document.getElementsByTagName("table");
const table = tables[0];
let allSelected = false;

async function addTableRows(response) {
    if (response.length === 0) return;
    for (resp of response) {
        console.log("resp looks like: ", resp);
        if (usernames.includes(resp.username)) continue;
        usernames.push(resp.username);
        createRows(resp);
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

async function createRows(resp) {
    const tbody = document.querySelector("table");
    const wrapper = document.createElement("tbody");

    console.log("creating the entry", resp.username);

    wrapper.innerHTML = `
            <tr class="text-black group">
                <td
                    class="p-2 pt-2.5 bg-emerald-400 text-center group-hover:bg-emerald-300"
                >
                    <label>
                        <input class="block cursor-pointer w-full" type="checkbox" />
                    </label>
                </td>
                <td class="p-2 bg-emerald-300 group-hover:bg-emerald-200">
                    <div class="flex items-center w-full">
                        <span class="usernameCell flex-1 text-center font-bold"
                            >${resp.username}</span
                        >
                    </div>
                </td>
                <td
                    class="p-2 relative text-center bg-emerald-300 group-hover:bg-emerald-200 content-stretch"
                >
                    <details class="relative">
                        <!-- The summary that the user clicks -->
                        <summary
                            class="relative cursor-pointer select-none text-black font-bold w-full"
                        >
                            View Orders

                            <button
                                class="deleteItem absolute right-0 top-1/2 -translate-y-1/2"
                            >
                                <img
                                    src="../images/trash.png"
                                    alt="Remove"
                                    class="w-7 h-7 hover:bg-emerald-100 hover:rounded-full p-1"
                                />
                            </button>
                        </summary>
                        <div
                        id="images-${resp.username.slice(1)}"
                            class="absolute -left-[100px] mt-1 w-auto overflow-scroll h-max-[75px] flex flex-col bg-white text-black font-bold border-gray-300 rounded-xl shadow-md p-2 z-10"
                        >
                        </div>
                    </details>
                </td>
            </tr>   
        `;

    const newRow = wrapper.querySelector("tr");
    tbody.appendChild(newRow);
    for (let order of resp.images) {
        const orders = newRow.querySelector(
            `#images-${resp.username.slice(1)}`
        );
        console.log(orders);
        const sizeField = document.createElement("div");
        sizeField.classList.add("mb-2");
        console.log("order im inserting into src is: ", order);
        sizeField.innerHTML = `
                            <!-- Sample images (just placeholders) -->
                    <div class="pt-2 flex flex-row gap-2 items-center">
                        <img
                            src="${order}"
                            alt="order1"
                            class="object-cover rounded-full h-15 w-15"
                        />
                        <label class="block text-[10px] text-black mb-1">
                            Enter size:
                        </label>
                        <input
                            type="text"
                            placeholder="28-46"
                            class="w-[200px] h-7 px-2 py-1 border rounded-full text-[10px]"
                        />
                    </div>
            `;
        orders.appendChild(sizeField);
    }
    const del = newRow.querySelector(".deleteItem");
    del.addEventListener("click", (event) => {
        const button = event.currentTarget;
        const row = button.closest("tr");
        if (!row) return;

        const usernameCell = row.querySelector(".usernameCell");
        if (!usernameCell) return;

        const username = usernameCell.textContent.trim();

        const index = usernames.indexOf(username);
        if (index > -1) {
            dataReceived.splice(index, 1);
            usernames.splice(index, 1);
            console.log(`removed ${username} from array`, usernames);
        }
        row.remove();
    });
    saveData();
    console.log(usernames);
}

async function loadTableRows(response) {
    if (response.length === 0) return;
    for (resp of response) {
        console.log("resp looks like: ", resp);
        createRows(resp);
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

const selectAllBtn = document.getElementById("selectAll");
selectAllBtn.addEventListener("click", () => {
    const checkboxes = table.querySelectorAll('input[type="checkbox"');
    allSelected = !allSelected;
    checkboxes.forEach((cb) => (cb.checked = allSelected));
    selectAllBtn.textContent = allSelected ? "Deselect all" : "Select all";
});

const delAll = document.getElementById("deleteAll");
delAll.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll('input[type="checkbox"');
    for (box of checkboxes) {
        if (box.checked) {
            const row = box.closest("tr");
            const usernameCell = row.querySelector(".usernameCell");
            const username = usernameCell.textContent.trim();

            const index = usernames.indexOf(username);
            if (index > -1) {
                dataReceived.splice(index, 1);
                usernames.splice(index, 1);
                console.log(`removed ${username} from array`, username);
            }
            row.remove();
        }
    }
    saveData();
    if (usernames.length === 0) {
        allSelected = false;
        selectAllBtn.textContent = "Select all";
    }
});
