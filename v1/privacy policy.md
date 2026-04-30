# Privacy Policy for Depop Shipper Extension  
**Last updated: June 2025**

---

## 1. Introduction  
Depop Shipper is a browser extension that helps Depop sellers fetch order details and send shipping labels via Gmail. This Privacy Policy explains what information the extension collects, how it is used, and how it is stored. By installing and using Depop Shipper, you agree to the practices described below.

## 2. Data Collection  
### 2.1. Local Browser Data  
- **Page URLs**  
  We read the URLs of your active tabs when you click “Get Orders” to identify Depop order pages and Shippo label pages.  
- **DOM Elements**  
  We scrape product images and order metadata directly from the Depop page’s HTML.

### 2.2. Chrome Storage  
We store the following under `chrome.storage.local`:  
- **`lastResults`**: a list of recently fetched orders to repopulate your popup table  
- **`shipped` flags**: markers indicating which orders you’ve already shipped, for color-coding  
- **Username selections**: to remember which accounts you’ve chosen

### 2.3. OAuth Token (Gmail)  
We request the **identity** permission only to obtain an OAuth token via `chrome.identity.getAuthToken()` for sending emails through your Gmail account.

## 3. Data Usage  
- **Fetching Labels**  
  We use your session cookies (via in-page `fetch(..., credentials: "include")`) to download PDFs from Shippo.  
- **Emailing**  
  We compose and send a single multipart HTML email (with embedded order images and sizes) via the Gmail API.  No email content or attachments leave your Gmail account.  
- **Local Persistence**  
  All scraped data and shipped-flags remain on your device.  We never transmit your orders, labels, or browsing data to any external server.

## 4. Data Storage & Retention  
- **In-Browser Only**  
  All information is stored locally in your Chrome profile under `chrome.storage.local`.  
- **Retention**  
  Data persists until you clear it with the popup’s “Clear” button or uninstall the extension.  Uninstalling automatically purges all stored data.

## 5. Permissions Requested  

| Permission | Purpose                                                                 |
|------------|-------------------------------------------------------------------------|
| `identity` | Authenticate with Gmail and obtain an OAuth token for sending emails    |
| `storage`  | Save your recent orders, shipped-flags, and username selections         |
| `tabs`     | Read the URL of your active tab when scraping order details             |

> **Note:** We do **not** request the `downloads` permission—Shippo PDFs are fetched and embedded in emails only.

## 6. Third-Party Services  
- **Gmail API**  
  Used solely to send emails from your account.  We do **not** retain your token or email content beyond the immediate API call.  
- **Shippo**  
  We fetch label PDFs directly from Shippo’s delivery domain using your existing session cookies; no Shippo data is forwarded or stored elsewhere.

## 7. Your Choices  
- **Revoke Access**  
  You can revoke Gmail API permissions at any time in Chrome’s _Extensions → Depop Shipper → Details → Site access & permissions_.  
- **Clear Data**  
  Use the “Clear” button in the popup to remove individual orders, or uninstall the extension to purge all data.

## 8. Contact  
If you have questions or concerns about this policy, please reach out to:  
> **Email:** sergey.safronov268@gmail.com

---

*This policy may be updated occasionally. Always check the “Last updated” date at the top.*  
