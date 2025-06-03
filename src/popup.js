// chrome.runtime.onMessage.addListener(
//     (message, sender, sender, sendResponse) => {
//         if (message.type === "data-update") {
//             const { totals, usernames } = message.payload;
//             document.querySelector("p").textContent = usernames.join(", ");
//         }
//     }
// );
let usernames = [];
let receipts = [];
document.addEventListener("DOMContentLoaded", () => {
    const getUsernamesButton = document.getElementById("getUsernamesButton");
    const output = document.getElementById("insertHere");

    console.log(getUsernamesButton);

    getUsernamesButton.addEventListener("click", () => {
        console.log("clicked!");
        chrome.runtime.sendMessage({ type: "get-data" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }
            console.log(response);
            if (response && response.usernames) {
                addTableRows(response.usernames);
            } else {
                output.textContent = "No data received.";
            }
        });
    });
});

const tables = document.getElementsByTagName("table");
const table = tables[0];
let allSelected = false;
function addTableRows(users) {
    let i = 0;
    for (user of users) {
        if (usernames.includes(user)) continue;
        usernames.push(user);
        // receipts.push(receipts[i++]);
        const tbody = document.querySelector("table");
        const wrapper = document.createElement("tbody");

        wrapper.innerHTML = `
        <tr class="text-black group">
            <td class="p-2 pt-2.5 bg-emerald-400 text-center group-hover:bg-emerald-300">
                <label>
                    <input class="block cursor-pointer w-full" type="checkbox" />
                </label>
            </td>
            <td class="p-2 bg-emerald-300 group-hover:bg-emerald-200">
                <div class="flex items-center w-full">
                    <span class="usernameCell flex-1 text-center font-bold"
                        >${user}</span
                    >

                    <button class="deleteItem ml-2">
                        <img
                            src="../images/trash.png"
                            alt="Remove"
                            class="w-7 h-7 hover:bg-emerald-100 hover:rounded-full p-1"
                        />
                    </button>
                </div>  
            </td>
        </tr>
        `;

        const newRow = wrapper.querySelector("tr");
        tbody.appendChild(newRow);

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
                usernames.splice(index, 1);
                // receipts.splice(index, 1);
                // i--;
                console.log(`removed ${username} from array`, usernames);
            }
            row.remove();
        });
        console.log(usernames);
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

            const index = username.indexOf(username);
            if (index > -1) {
                usernames.splice(index, 1);
                console.log(`removed ${username} from array`, username);
            }
            row.remove();
        }
    }
    if (usernames.length === 0) {
        allSelected = false;
        selectAllBtn.textContent = "Select all";
    }
});

const sendEmails = document.querySelector("#sendEmails");
sendEmails.addEventListener("click", () => {
    chrome.runtime.sendMessage(
        {
            type: "send-emails",
            payload: [0, 1],
        },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }
            console.log("popup received: ", response);
        }
    );
});
