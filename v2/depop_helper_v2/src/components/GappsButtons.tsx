import Order from "../models/Order";
import { useEffect, useState } from "react";
import { getAuthToken } from "../scripts/googleApi";
import sendEmails from "../scripts/sendEmails";
import updateSheet from "../scripts/updateSheet";
type Props = {
	orders: Map<string, Order>;
	setOrders: Function;
	selected: Set<Order>;
};

/**
 * this component contains the code for buttons responsible for calling Gmail API
 * This applies to both record-keeping and email sending.
 *
 * Specs:
 * On click of the send emails button:
 * 1. poll selected objects
 * 2. Populate list of html documents
 * 3. fire and send emails
 * 4. error check emails, marking erroneous/failed sends
 *
 * On click of the update spreadsheet button:
 *
 * @param param0
 * @returns React component
 */
export default function GappsButtons({ orders, setOrders, selected }: Props) {
	void orders;
	void setOrders;

	const [token, setToken] = useState<string>();

	useEffect(() => {
		(async () => {
			const t = await getAuthToken();
			setToken(t);
		})();
	});

	useEffect(() => {
		console.log("rerendering bc of selected");
	}, [selected.size]);

	return (
		<div className="gappsButtons">
			<button
				id="sendEmails"
				onClick={() => {
					return (async () => {
						return sendEmails(orders, token, setOrders);
					})();
				}}>
				{`Send ${selected.size} emails`}
			</button>
			<button
				id="updateSheet"
				onClick={() =>
					(async () => updateSheet(orders, token, setOrders))()
				}>
				{`Log ${selected.size} orders in sheet`}
			</button>
		</div>
	);
}
