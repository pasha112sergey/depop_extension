/**
 * Clears local cache and reloads component
 * @returns React component
 */
export default function ClearCacheButton() {
    return (
        <button
            id="clearCache"
            onClick={() => {
                chrome.storage.local.clear();
                window.location.reload();
            }}
        >
            Clear Cache
        </button>
    );
}
