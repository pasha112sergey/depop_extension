import Order from "../models/Order";
import { useEffect, useState } from "react";
import { getAuthToken } from "../scripts/googleApi";
import sendEmails from "../scripts/sendEmails";
import updateSheet from "../scripts/updateSheet";
import { Color } from "../scripts/utils";

type Props = {
	orders: Map<string, Order>;
	setOrders: Function;
	selected: Set<Order>;
	emailDestination: string;
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
export default function GappsButtons({
	orders,
	setOrders,
	selected,
	emailDestination,
}: Props) {
	void orders;
	void setOrders;

	const [token, setToken] = useState<string>();
	const [sent, setSent] = useState<boolean>(false);
	const [accounted, setAccounted] = useState<boolean>(false);

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
				style={{
					backgroundColor: sent ? Color.SUCCESS : Color.FAILURE,
				}}
				onClick={() => {
					(async () =>
						sendEmails(
							orders,
							token,
							setOrders,
							emailDestination,
						))();
					setSent(true);
				}}>
				{`Send ${selected?.size ?? 0} emails`}
			</button>
			<button
				id="updateSheet"
				style={{
					backgroundColor: accounted ? Color.SUCCESS : Color.FAILURE,
				}}
				onClick={() => {
					(async () => updateSheet(orders, token, setOrders))();
					setAccounted(true);
				}}>
				{`Log ${selected?.size ?? 0} orders in sheet`}
			</button>
		</div>
	);
}
