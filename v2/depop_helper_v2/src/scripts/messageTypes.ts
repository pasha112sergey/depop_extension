/**
 * Specificiations for message types:
 *
 * 1. GET_ORDERS - sent by popup to backend. backend responds with a Order
 * []
 */

enum ChromeMessageType {
    GET_ORDERS = "GET_ORDERS",
    CLEAR_TABLE = "CLEAR",
    UPDATE_SHEET = "UPDATE_SHEET",
    SEND_EMAIL = "SEND_EMAIL",
}

export default ChromeMessageType;
