export function getAuthToken(): Promise<string> {
	return new Promise((resolve, reject) => {
		chrome.identity.getAuthToken({ interactive: true }, (token) => {
			if (chrome.runtime.lastError || !token) {
				reject(
					chrome.runtime.lastError?.message ?? "Token fetch failed",
				);
			} else {
				resolve(token as string);
			}
		});
	});
}

export function buildRawEmail(
	to: string,
	subject: string,
	htmlBody: string,
): string {
	const email = [
		`To: ${to}`,
		`Subject: ${subject}`,
		`MIME-Version: 1.0`,
		`Content-Type: text/html; charset=utf-8`,
		``,
		htmlBody,
	].join("\r\n");

	// base64url encode (no +, /, or = padding)
	return btoa(unescape(encodeURIComponent(email)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export async function callGmailSend(
	rawMessage: string,
	token: string,
): Promise<void> {
	const res = await fetch(
		"https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ raw: rawMessage }),
		},
	);

	if (!res.ok) {
		const err = await res.json();
		throw new Error(`Gmail API error: ${err.error?.message}`);
	}
}
