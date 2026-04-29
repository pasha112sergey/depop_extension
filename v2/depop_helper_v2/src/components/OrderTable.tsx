import Order from "../models/Order";

type Props = { orders: Order[] };
export default function OrderTable({ orders }: Props) {
    return <>{orders}</>;
}
