export default class Order {
	private _url: string;
	private _images: string[];
	private _username: string;
	private _total: number;
	private _shippingLink: string;
	private _sent: boolean;
	private _accounted: boolean;
	private _error: string | null;

	public constructor(
		url: string,
		images: string[],
		username: string,
		total: number,
		shippingLink: string,
		error: string | null = null,
		sent: boolean | undefined = false,
		accounted: boolean | undefined = false,
	) {
		this._url = url;
		this._images = images;
		this._username = username;
		this._total = total;
		this._shippingLink = shippingLink;
		this._error = error;
		this._sent = sent;
		this._accounted = accounted;
	}

	public get error(): string | null {
		return this._error;
	}

	public get shippingLink(): string {
		return this._shippingLink;
	}

	public set shippingLink(link: string) {
		this._shippingLink = link;
	}

	public get total(): number {
		return this._total;
	}

	public set total(x: number) {
		this._total = x;
	}

	public get username(): string {
		return this._username;
	}

	public set username(u: string) {
		this._username = u;
	}

	public get images(): string[] {
		return this._images;
	}

	public set images(imgs: string[]) {
		this._images = imgs;
	}

	public get url(): string {
		return this._url;
	}

	public set url(u: string) {
		this._url = u;
	}

	public get sent(): boolean {
		return this._sent;
	}

	public set sent(s: boolean) {
		this._sent = s;
	}

	public get accounted(): boolean {
		return this._accounted;
	}

	public set accounted(a: boolean) {
		this._accounted = a;
	}
}
