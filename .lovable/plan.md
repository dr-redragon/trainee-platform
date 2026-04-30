

## Problem

Safari on macOS blocks programmatic blob downloads triggered by `file-saver`'s `saveAs()`, especially when the app runs inside an iframe (as in the Lovable preview). The blob is created successfully and the toast fires, but Safari silently prevents the file from saving to disk.

## Root Cause

`file-saver` internally uses `URL.createObjectURL` + an anchor click. Safari restricts this when:
1. The download is triggered inside an iframe with a different origin
2. The click is not considered a direct user gesture (async gap between user click and the eventual `saveAs` call after fetching blobs)

## Plan

### 1. Replace `file-saver` with a Safari-compatible download helper

In `src/lib/resourceDownloads.ts`, replace the `saveAs` import with a custom `saveBlobAsFile` function that:
- Creates an object URL from the blob
- For Safari specifically: opens the blob URL in a new tab/window using `window.open()` (Safari allows the user to then save from the new tab)
- For other browsers: uses the standard anchor-click approach with `URL.createObjectURL` and `link.download`
- Cleans up the object URL after a short delay

### 2. Add Safari detection utility

Add a simple Safari detection check (`/^((?!chrome|android).)*safari/i.test(navigator.userAgent)`) to branch the download logic.

### 3. Remove `file-saver` dependency

Remove `file-saver` and `@types/file-saver` from `package.json` since they will no longer be used.

---

### Technical Detail

```text
saveBlobAsFile(blob, fileName)
  ├── isSafari?
  │   ├── YES → window.open(blobUrl) — user saves from new tab
  │   └── NO  → create <a href=blobUrl download=fileName>, click(), revoke
```

**Files to change:**
- `src/lib/resourceDownloads.ts` — replace `saveAs` with custom function
- `package.json` — remove `file-saver` and `@types/file-saver`

