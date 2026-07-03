# api function listing

btw writing this shi is pmo so i might just ask ai

## WindowHandle
class — src/Apis/iSApi.ts

### fromHWnd(hwnd)
src/Core/windowhelpers.ts (`getSymbolByHWnd`)
takes: `string`, returns: `WindowHandle | undefined`

### close()
src/Core/windowhelpers.ts (`closeWindow`)
takes: nothing, returns: `void`

### minimize()
src/Core/windowhelpers.ts (`minimize`)
takes: nothing, returns: `void`

### bringupwards()
src/Core/windowhelpers.ts (`bringupwards`)
takes: nothing, returns: `void`

### getTitle()
src/Core/windowhelpers.ts (`windows`)
takes: nothing, returns: `string | undefined`

### getContent()
src/Core/windowhelpers.ts (`windows`)
takes: nothing, returns: `JSX.Element | undefined`

### setContent(content)
src/Core/windowhelpers.ts (`setContent`)
takes: `JSX.Element`, returns: `void`

### dimensions()
src/Core/windowhelpers.ts (`getDimensions`)
takes: nothing, returns: `{ width: number; height: number } | undefined`

### setDimensions(d)
src/Core/windowhelpers.ts (`setDimensions`)
takes: `{ width: number; height: number }`, returns: `void`

### position()
src/Core/windowhelpers.ts (`getPosition`)
takes: nothing, returns: `{ x: number; y: number } | undefined`

### getMousePosition()
src/Core/windowhelpers.ts (`getCurrentMousePosition`)
takes: nothing, returns: `{ x: number; y: number }`

### getMousePositionRelative()
src/Core/windowhelpers.ts (`getMousePositionRelativeToWindow`)
takes: nothing, returns: `{ x: number; y: number; globalX: number; globalY: number } | undefined`

### getMouseInfo()
src/Core/windowhelpers.ts (`getCurrentMousePosition`, `getMousePositionRelativeToWindow`)
takes: nothing, returns: `{ global: { x: number; y: number }; relative: { x: number; y: number; globalX: number; globalY: number } | undefined }`

### setPosition(pos)
src/Core/windowhelpers.ts (`setPosition`)
takes: `{ x: number; y: number }`, returns: `void`

### setCenter(center)
src/Core/windowhelpers.ts (`setCenter`)
takes: `{ x: number; y: number }`, returns: `void`

### corners()
src/Core/windowhelpers.ts (`getCorners`)
takes: nothing, returns: `{ topLeft: { x: number; y: number }; topRight: { x: number; y: number }; bottomLeft: { x: number; y: number }; bottomRight: { x: number; y: number } } | undefined`

### draw(fn)
src/Core/overlay.ts (`drawToWindow`)
takes: `(ctx: CanvasRenderingContext2D) => void`, returns: `void`

## systems
src/Core/systems.ts

### setWallpaper(url)
takes: `string`, returns: `void`

### setWallpaperWithBlob(blob)
takes: `Blob`, returns: `void`

### setWisp(url)
takes: `string`, returns: `void`

### wFetchText(url)
takes: `string`, returns: `Promise<string>`

### wFetchBlob(url)
takes: `string`, returns: `Promise<string>`

## registry
src/Apis/RegistryApi.ts

### RegistryValueHandle
- `value` (getter) — takes: nothing, returns: `RegistryValue`
- `type` (getter) — takes: nothing, returns: `string`
- `loaded` (getter) — takes: nothing, returns: `boolean`

### RegistryInstanceAccess
- `getKey(path)` — takes: `string`, returns: `RegistryKey`
- `_load(path)` — takes: `string`, returns: `Promise<RegistryRecord | null>`
- `_save(record)` — takes: `RegistryRecord`, returns: `Promise<void>`
- `_write(path, name, value)` — takes: `string, string, RegistryValue`, returns: `Promise<void>`
- `_deleteValue(path, name)` — takes: `string, string`, returns: `Promise<void>`
- `_deleteKey(path)` — takes: `string`, returns: `Promise<void>`

### RegistryKey
- `getKey(sub)` — takes: `string`, returns: `RegistryKey`
- `getValue(name)` — takes: `string`, returns: `RegistryValueHandle`
- `setValue(name, value)` — takes: `string, RegistryValue`, returns: `void`
- `deleteValue(name)` — takes: `string`, returns: `void`
- `deleteKey()` — takes: nothing, returns: `void`
- `list()` — takes: nothing, returns: `{ keys: string[]; values: string[] }`
- `createKey()` — takes: nothing, returns: `void`

## fs
src/Apis/FileSystemApi.ts

### FileHandle
- `read()` — takes: nothing, returns: `Promise<string | undefined>`
- `write(data)` — takes: `string | Blob`, returns: `void`
- `append(data)` — takes: `string | Blob`, returns: `void`
- `delete()` — takes: nothing, returns: `void`

### DirectoryHandle
- `list()` — takes: nothing, returns: `string[]`
- `createFile(name)` — takes: `string`, returns: `FileHandle`
- `createDirectory(name)` — takes: `string`, returns: `DirectoryHandle`
- `delete()` — takes: nothing, returns: `void`

### FileSystemAccess
- `exists(path)` — takes: `string`, returns: `boolean`
- `isFile(path)` — takes: `string`, returns: `boolean`
- `isDirectory(path)` — takes: `string`, returns: `boolean`
- `createDirectory(path)` — takes: `string`, returns: `void`
- `deleteDirectory(path)` — takes: `string`, returns: `void`
- `listDirectory(path)` — takes: `string`, returns: `string[]`
- `createFile(path)` — takes: `string`, returns: `void`
- `deleteFile(path)` — takes: `string`, returns: `void`
- `openFile(path)` — takes: `string`, returns: `FileHandle`
- `updateFileMeta(path, data)` — takes: `string, Blob | string`, returns: `void`
- `rename(oldPath, newPath)` — takes: `string, string`, returns: `void`

## launcher
src/Apis/Launcher.ts

### launch(code)
takes: `string`, returns: `void`
evals `code` in global scope (so it can call `spawn`, `window.__API`, etc., like a custom app)

### launchfromfile(path)
takes: `string`, returns: `Promise<void>`
reads the file at `path` from the VFS and passes its contents to `launch`

### launchhtml(title, html)
takes: `string, string`, returns: `void`
spawns a window and sets its content to the given raw HTML string

## spawn
src/Core/windowhelpers.ts (reexported from src/Apis/iSApi.ts)
takes: `string = "window", (hwnd: symbol) => void | undefined`, returns: `void`

# usage from custom app
spawn("hi", (hwnd) => {//your code here});
launcher.launchhtml("hi", "<h1>hello</h1>");
