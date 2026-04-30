import Order from "../models/Order";

type Props = { orders: Order[] };
export default function OrderTable({ orders }: Props) {
    console.log(orders);
    return (
        <div id="orderTable">
            {orders.map((order) => (
                <Row order={order} key={order.url} />
            ))}
        </div>
    );
}

type RowProp = { order: Order };
/**
 * create a row for the table
 * @param param0
 */
function Row({ order }: RowProp) {
    return (
        <div id={order.url}>
            <tr>
                <td>
                    <input
                        type="checkbox"
                        className="selected"
                        value={order.url}
                    ></input>
                </td>
                <td>{order.username}</td>
                <td>
                    <details open>
                        <summary>Expand</summary>
                        <div className="imageContainer">
                            {order.images.map((img) => (
                                <img key={img} src={img} />
                            ))}
                        </div>
                    </details>
                </td>
            </tr>
        </div>
    );
}
