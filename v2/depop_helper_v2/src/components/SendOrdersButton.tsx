import Order from "../models/Order";

type Props = { orders: Order[] };
export default function SendOrdersButton({ orders }: Props) {
    return <>{orders}</>;
}
