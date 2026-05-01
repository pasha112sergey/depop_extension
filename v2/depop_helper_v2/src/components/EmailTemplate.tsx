import Order from "../models/Order";

type Prop = { order: Order };

/**
 * Renders a HTML email format
 * @param param0
 */
export default function EmailTemplate({ order }: Prop) {
	let count: number = 0;
	return (
		<div className="emailBody">
			<h1>Depop Order</h1>
			<h2>Here are the order details: </h2>
			<table>
				<tbody>
					{order.images.map((img) => {
						return (
							<tr key={order.url}>
								<td id={`img-${order.url}`}>
									<img
										src={img}
										style={{
											width: "300px",
											height: "300px",
											objectFit: "cover",
										}}></img>
								</td>
								<td id="orderNote">
									<span
										style={{
											fontSize: "3rem",
											lineHeight: 1.2,
											color: "black",
										}}>
										{getImageNote(
											count++,
											img,
											order.url,
										) || "no note!"}
									</span>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			<a href={order.shippingLink}>
				<h1>Shipping Link</h1>
			</a>
		</div>
	);
}

/**
 * gets the note for the corresponding image
 * @param img
 * @returns
 */
function getImageNote(count: number, img: string, orderUrl: string): string {
	console.log("looking for image:", img);
	/**
	 * IMPORTANT NOTE AND BUG REPORT - PLEASE READ!
	 * For orders with multiple of the same images, custom messages for each such item
	 * may not work - it has not been tested.
	 */
	const inputs = Array.from(
		document.getElementsByClassName(`note-${img}-${orderUrl}`),
	);

	console.log(inputs);

	return inputs.length > 1
		? (inputs[count] as HTMLInputElement)?.value
		: (inputs[0] as HTMLInputElement)?.value;
}
