import Order from "../models/Order";

type Props = { orders: Order[] };
export default function SpreadSheetButton({ orders }: Props) {
    return <>{orders}</>;
}
