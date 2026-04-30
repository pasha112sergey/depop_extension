import ChromeMessageType from "./messageTypes";
import Order from "../models/Order";
import getOrders from "./getOrders";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void sender;

    switch (message.type) {
        case ChromeMessageType.GET_ORDERS:
            getOrders(sender, sendResponse);
            return true;
    }
});
