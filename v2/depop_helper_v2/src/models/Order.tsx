export default class Order {
    private _url: string;
    private _images: string[];
    private _username: string;
    private _total: number;
    private _shippingLink: string;
    private _error: string | null;

    public constructor(
        url: string,
        images: string[],
        username: string,
        total: number,
        shippingLink: string,
        error: string | null = null,
    ) {
        this._url = url;
        this._images = images;
        this._username = username;
        this._total = total;
        this._shippingLink = shippingLink;
        this._error = error;
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
}
