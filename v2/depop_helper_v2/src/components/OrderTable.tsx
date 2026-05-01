import Order from "../models/Order";
import GetOrdersButton from "./GetOrdersButton";

type Props = { orders: Map<string, Order>; setOrders: Function };
export default function OrderTable({ orders, setOrders }: Props) {
    console.log(orders);
    let collapsed: boolean = false;
    let selected: boolean = false;

    return (
        <>
            <table id="orderTable">
                {Array.from(orders.values()).map((order) => (
                    <Row order={order} key={order.url} />
                ))}
            </table>
            <div className="tableButtons">
                <button
                    id="selectAll"
                    onClick={() => {
                        selected = !selected;
                        selectAll(selected);
                    }}
                >
                    Select All
                </button>
                <button
                    id="collapseAll"
                    onClick={() => {
                        collapsed = !collapsed;
                        collapseAll(collapsed);
                    }}
                >
                    Collapse All
                </button>
                <button
                    id="deleteSelected"
                    onClick={() => {
                        deleteSelected(orders, setOrders);
                    }}
                >
                    Delete Selected
                </button>
                <button id="clearCache" onClick={() => clearCache(setOrders)}>
                    Clear Cache
                </button>
                <GetOrdersButton setOrders={setOrders} />
            </div>
        </>
    );
}

/**
 * clears chrome.storage.local 
 @param {Function} setOrders: setter
 */
function clearCache(setOrders: Function): void {
    chrome.storage.local.clear();
    setOrders([]);
}

/**
 * Selects or deselects all input elements in the table
 * @param selected
 */
function selectAll(selected: boolean): void {
    const inputs = document.querySelectorAll(`input[type="checkbox"]`);
    document.getElementById("selectAll")!.innerText = selected ? "Deselect All" : "Select All";

    for (let inp of inputs) {
        (inp as HTMLInputElement).checked = selected;
    }
}
/**
 * Collapses or exapnds all elements in the table
 * @param collapsed
 */
function collapseAll(collapsed: boolean) {
    const details = document.querySelectorAll("details");
    document.getElementById("collapseAll")!.innerText = collapsed ? "Expand All" : "Collapse All";

    for (let d of details) {
        d.open = collapsed;
    }
}

/**
 * Deletes selcted orders
 * @param orders
 * @param setOrders
 */
function deleteSelected(orders: Map<string, Order>, setOrders: Function): void {
    const inputs = document.querySelectorAll(`input[type="checkbox"]`);
    console.log("orders before: ", orders);

    const newOrders = new Map(orders);
    for (let inp of inputs) {
        if ((inp as HTMLInputElement).checked) {
            newOrders.delete(inp.id);
        }
    }

    chrome.storage.local.set({
        lastResults: Array.from(newOrders.values()),
    });

    setOrders(newOrders);
}

type RowProp = { order: Order };
/**
 * create a row for the table
 * @param param0
 */
function Row({ order }: RowProp) {
    return (
        <tr className="orderRow">
            <td className="username">
                <label className="username-label" htmlFor={order.url}>
                    <p>{order.username}</p>
                    <input
                        type="checkbox"
                        className="selected"
                        id={order.url}
                        value={order.url}
                    ></input>
                </label>
            </td>

            <td className="dropDown">
                <details open>
                    <label className="username-label" htmlFor={order.url}>
                        <summary>Expand</summary>
                        <div className="imageContainer">
                            {order.images.map((img) => (
                                <>
                                    <img key={img} src={img} />
                                    <input type="text" placeholder="28-48"></input>
                                </>
                            ))}
                        </div>
                    </label>
                </details>
            </td>
        </tr>
    );
}
