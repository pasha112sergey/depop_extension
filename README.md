<h1 style="text-align: center">Depop Extension</h1>

## **Depop helper extension to automate the sending of order emails and shipping labels to my dad.**

### Problem statement

My father owns an e-commerce business where he sells belts, belt buckles, and necklaces on Etsy, Amazon, and eBay. As a member of the younger generation, I saw an opportunity to expand his business: **depop.com**.

This is a newer, less established platform marketed as an online thrift store where people sell their used items. I've been shopping on it for years now, and I noticed that my dad's choice of Western styles could score big on the platform. I introduced him to the opportunity, but he was reluctant to learn the ins and outs of this new website. To test the waters, he gave me some of his samples and defective items to sell. Seeing as depop is a more casual platform where people don't put a lot of effort into their listings, I put them up with terrible pictures for dirt cheap, and waited.

As I suspected, they sold almost instantly! I also discovered that depop's policy is extremely friendly towards sellers: low fees, and buyer pays shipping. This way, I could list the items for low prices, yet still keep a nice profit margin.

However, a problem quickly surfaced. With me being busy at Stony Brook with classes, activites, and the rest of college life, I had very little time to actually process orders. For each order, I had to get the shipping label, username, item, and manually send an email to my dad. Now this doesn't seem like much, but on especially good sales days, this took up to 30 minutes of monotonous, repetitive "labor". Sure, time I had, but time I didn't want to spend.

### Solution

Motivated by an internshipless summer, a desire to pad my resume with a real project, and the boredom of sending those emails, I set out to build a Chrome Extension to automate the process. I used Google's ManifestV3 to develop the extension, JavaScript and HTML to run it, and (perhaps contentiously) Tailwind CSS to style it.

### A brief overview of how it works

This extension has a few moving parts.

1. First, `manifest.json` declares the metadata about the browser extension, which allows the browser to understand, allow, and manage the application's behavior when installed.

2. Second, `background.js`, together with `esbuild` bundler, creates a file `dist/background.bundle.js`, which controls the background service worker for the application. This is the script that runs independently of the web page. As the name suggests, it runs in the background, even when the browser is not displaying the tab. This file and its logic are essential for traversing the tabs and scraping the necessary data that we will then use in the email. It is also responsible for handling the Gmail API call.

3. Third, `popup.js` handles the extension's popup window. It controls all the logic concerning button and displaying the table of orders. On different user actions, it sends messages to the **background service worker** via the `chrome.runtime.sendMessage`. It is through this protocol that the service worker and the user interact. The logic in this file also reads the runtime responses that the background sends, and dynamically builds HTML elements to display the scraped data.

4. Lastly, `output.css` is the Tailwind styles file that makes the `popup.html` file nice and user-friendly. I tried to make the styles acceptable and nice to the eye, but did not put too much emphasis on any crazy effects and animations.

> `/images` directory contains the icon that shows up in the extension bar, the background image for `popup.html`, and the trash icon to remove orders

## A preview of the extension window

<p align="center">
<img src=image.png alt="popup preview" width="400">
</p>

<br></br>

## In-depth overview of how it works: `background.js`

The background service worker has a few responsibilities:

### 1. Sending the email via obtaining the OAuth2 Token and calling the Gmail API

> 1. In order to send the email, the user selects the orders they'd like to send and then clicks the **'Send Selected'** button. `popup.js` then reads that click through a simple `eventListener`, scrapes the information from `popup.html`, and sends a `chrome.runtime` message to the backend with the type `"send-email"` for each selected order. Below is the schema of the message:
>    <br></br>
>    | Message Field | Description | Example |
>    | :--- | :---- | :--- |
>    | `message.type` | Tells the service worker that the user wants to send the email | `"send-email"` |
>    | `message.to` | Selects the recipient (dad's email, mine for testing) | `"test@gmail.com"` |
>    | `message.subject` | Email subject. This includes username | `"depop-@example_user"` |
>    | `message.body` | This is the HTML table for each item of the user's order. This is stored in an object called "email", under the "html" field. More on this in the `popup.js` section | `"email.html"` |
>    | `message.shippingLink` | The link to the shipping label | `"https://deliver.goshippo..."` |
>
> <br></br>

> 2. The backend listens for messages constantly. If it receives the `"send-email"` type, it reads the fields of the message described above, and calls `sendGmailMultipart` with the necessary information:

```javascript
sendGmailMultipart({
    tabId,
    to: message.to,
    subject: message.subject,
    htmlBody: `
            <h2 style="font-family: Arial, sans-serif;">Depop Order</h2>
                <p style="font-family: Arial, sans-serif;">Order:</p>
                ${message.body}
            <h2 style="font-family: Arial, sans-serif;">${message.shippingLink}</h2>`,
});
```

> 3.  The `sendGmailMultipart` function then gets the Gmail OAuth2 token, builds the message, and calls the Gmail API. Then, the callback to `sendGmailMultipart` decides whether the response to send to `popup.js` is a success or an error. It also updates the `shippedLinks` array in `chrome.storage.local` to keep track of what orders the user has already shipped.
>
> 4.  If everything was successful, the email has been sent and the order will be marked as shipped by highlighting in yellow in `popup.html`.

### 2. Scraping the data from Depop's _selling hub_ page to obtain necessary order information.

> This is the biggest part of the application, and is the central logic that allows the whole app to work.
>
> Again, this responsibility is invoked by a message from `popup.js`. On click of the 'Get orders' button, `popup.js` sends a message of type `"get-data"`. Background's message listener picks it up and executes the request as follows.
>
> 1. Since the background lives in an independent context, we must inject a script into the depop _selling hub_ webpage via `chrome.scripting.executeScript` on the current tab's ID.
>
> 2. Now that we have an injected script, we can read the page and its content using various selectors. Helper functions like `getInfo` and `testValidDate` make sure the receipts links we are selecting are valid by testing its status text. For instance, the text must contain the 'Ship Order' text to continue.
>
> 3. After that, we follow the receipt link by calling `navigateToUrl`, which opens up **Depop's order details page**. On this page, we get all of the important data that we need for the order by calling `scrapeDataFromDom`. Through various selectors, this function extracts the images of items in the order, the username, the total, and gets the shipping label.
>     > **_NOTE:_** _Clicking the 'Get Shipping Label' button calls depop's internal API to fetch a shipping label link from a service called goshippo. I was not able to intercept this call because ManifestV3 does not allow blocking webRequests. Instead, I opted for clicking the button via the injected script and listening for a page redirect. Then, I grabbed the URL from that newly opened page and closed it quickly. Please let me know if you have any suggestions on using the API instead, as that will make the user experience smoother._

> 4.  After reading the page content and getting the shipping label, we update the stored orders in `chrome.storage.local` and send the response via an array, which I uncreatively called resultsArray. Each element of this array is a JavaScript object that contains the following fields:
>
> -   **.username** : username of the buyer
> -   **.images** : images array of all the items in the order
> -   **.link** : link to the receipt from which we fetched all the data. This value is unique to each order.
> -   **.label** : link to the GoShippo shipping label
>     <br></br>

### 3. Clearing data when the user deletes orders through the pop-up UI

> To prevent clutter, I added some additional message infrastructure that wipes orders from `chrome.storage.local` cache. This is an optional feature, as deleting orders from `popup.html`'s table is not necessary in the user workflow, but it is a nice touch. This function is executed through a simple loop that checks for the link passed in the message and removes it.

<br></br>

## In-depth overview of how it works: `popup.js`

`popup.js` handles everything related to the UI and serves as the interface between the backend and frontend.

### 1. Setting up listeners for the buttons that the user interacts with

> This is a simple procedure: select the button via its HTML id and hook up a listener to it.
> For example:

```javascript
const selectAllBtn = document.getElementById("selectAll");
selectAllBtn.addEventListener("click", () => {
    //... functionality of the code
});
```

### 2. Sending messages on eventListener calls

> There are only 3 types of messages to send:
>
> | Message Type   | Description                                                                                                                                                                                                                                                                                                                                           |                                                                                                                   Usage |
> | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------: |
> | `"get-data"`   | Tells the service worker to scrape the data from the **selling hub** webpage                                                                                                                                                                                                                                                                          |                                          A "get-data" message is sent whenever the user clicks the "Get Orders" button. |
> | `"clear"`      | Sends a link of the item to remove from the `chrome.storage.local` cache and background's internal cache that keeps track of the links it has already seen. Perhaps this is an unnecessary message to send, as the `chrome.storage.local` cache can be updated from any file, but it gave me some extra practice with message passing, I guess (lol). |        A "clear" message is sent whenever a user clicks the "Clear selected" or the individual table row trash can icon |
> | `"send-email"` | As explained in the in-depth overview of `background.js`, this passes the fields for the background to send emails to. Again, this also could've been handled in `popup.js`, but it seemed sensical to delegate this to the backend of the application at the time of development.                                                                    | A "send-email" message is sent whenever the user selects the orders to ship, and then clicks the "Send Selected" button |

### 3. Injecting table rows on `background.js` _"get-data"_ response

> After sending the _"get-data"_ message, `popup.js` reads the `resultsArray` elements, and injects table rows one by one. It first injects a skeleton for each element `resp`, which is referenced by a wrapper element:

```html
wrapper.innerHTML = '
<tr class="text-black group">
    <td
        class="p-2 pt-2.5 bg-emerald-400 text-center group-hover:bg-emerald-300"
    >
        <label
            ><input class="block cursor-pointer w-full" type="checkbox"
        /></label>
    </td>
    <td class="p-2 bg-emerald-300 group-hover:bg-emerald-200">
        <div class="flex items-center w-full">
            <span
                id="usernameCell"
                class="usernameCell flex-1 text-center font-bold"
                >${ resp.username }</span
            >
        </div>
    </td>
    <td
        class="p-2 relative text-center bg-emerald-300 group-hover:bg-emerald-200 content-stretch"
    >
        <details class="relative">
            <summary
                class="relative cursor-pointer select-none text-black font-bold w-full"
            >
                View Orders
                <button
                    class="deleteItem absolute right-0 top-1/2 -translate-y-1/2"
                >
                    <img
                        src="../images/trash.png"
                        alt="Remove"
                        class="w-7 h-7 hover:bg-emerald-100 hover:rounded-full p-1"
                    />
                </button>
            </summary>
            <div
                id="images-${resp.username.slice(1)}"
                class="absolute -left-[100px] mt-1 w-auto overflow-scroll h-max-[75px]
                        flex flex-col bg-white text-black font-bold
                        border-gray-300 rounded-xl shadow-md p-2 z-10"
            >
                <div class="hidden" id="shippingLink">${ resp.label }</div>

                <div class="hidden" id="link">${resp.link}</div>
            </div>
        </details>
    </td>
</tr>
';
```

> Then, for each image `image` of `resp.images`, it creates a new field in the `details` tag and appends it to the `wrapper` above.

```html
sizeField.innerHTML = `
<div id="image-${count++}" class="pt-2 flex flex-row gap-2 items-center">
    <img
        src="${image}"
        alt="order1"
        class="object-cover rounded-full h-15 w-15"
    />
    <label class="block text-[10px] text-black mb-1">Enter size:</label>
    <input
        type="text"
        placeholder="28-46"
        class="w-[200px] h-7 px-2 py-1 border rounded-full text-[10px]"
    />
</div>
`;
```

Now, the user sees the details collapsed and populated with the data that `background.js` scraped.

### 4. Handling Selected Items

> There are 2 things that the user can do with selected items: they can either delete them in bulk or send them.
>
> -   On deleting, each item's link is sent to the background with the "clear" message type.
>
> -   On sending, the popup reads the now-populated HTML table, and the input field for any details about the order. It then creates an HTML table styled by vanilla CSS (I wish I could've used tailwind, but emails don't have any way to reference it, or, I should say, I couldn't find any) and sends the "send-email" message for each row of the table. It also updates the `shippedLinks` cache so that the user knows what links they've already shipped.

### 5. Miscellaneous Population of Table Rows

> On `popup.html` loading, the script reads the `chrome.storage.local` caches and builds the table with any data that was stored. This is done so that the information is persistent when closing the pop-up window.
>
> **A next step to add would be to make the details input persistent as well.**

# Demo Video

I included a demo video in the `./demo_video` folder to better show what the functionality accomplishes. Sensitive data is blurred. After sending, the sent usernames will appear highlighted in yellow to signify that they have already been shipped.

# Next steps

> 1. In the future, I would like to add functionality to support record keeping. Ideally, I would like a spreadsheet that gets automatically populated by the extension with the username, shipping label, items, and total.
>
> 2. I would also like to figure out how to intercept the API call to obtain the shipping label. The constant tab switching is annoying to the user as their application focus always jumps to the opened URL.
>
> 3. Extensive testing needs to be conducted on different orders of various sizes and edge cases like separate orders from the same users to verify functionality. This, unfortunately, cannot be tested until such an order actually comes in. For now, the application works.

# Results

> Currently, the application is working and has already successfully sent over 15 emails to my dad. The total process of all shipping orders now takes around 2 minutes, while before, it took around 2 minutes for each order. This is a massive improvement and I'm very happy with the result!
