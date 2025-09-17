
# Clipaste – Mini Brand Kit

**Concept:** Two overlapping documents (copy) + a downward arrow into a tray (paste). The whole icon is a single, clean monoline that scales to 16px–1024px. Strokes use `currentColor` so the mark inherits color from its context (CLI, docs, website).

## Files
- `clipaste-logo/clipaste-logo-mark.svg` — square logomark (recommended for favicon, social avatar, npm icon)
- `clipaste-logo/clipaste-logo-wordmark.svg` — horizontal lockup (readme header, website)
- `clipaste-logo/clipaste-favicon.svg` — simplified mark for tiny sizes

## Color
- Default monochrome: `#111827` (near-black) on light backgrounds and `#ffffff` on dark backgrounds.
- Accent suggestions (optional): 
  - Paste green `#22C55E` 
  - Indigo `#4F46E5` 
  - Turquoise `#06B6D4`

Because the SVGs use `currentColor`, set color in CSS or the `fill`/`color` property of the parent:

```html
<!-- README example -->
<p align="center">
  <img src="./clipaste-logo/clipaste-logo-wordmark.svg" alt="clipaste logo" width="480" style="color:#22C55E">
</p>
```

## Install/Usage Snippet for README
```md
<p align="center">
  <img src="./clipaste-logo/clipaste-logo-wordmark.svg" width="560" alt="clipaste" />
</p>

<h1 align="center">clipaste</h1>
<p align="center">
  Cross-platform clipboard: copy, get, paste — with persistent files.
</p>
```

## CLI Badge (ASCII)
```
  __ _ _ _ __ _ __ _ ___ _ __ ___ 
 / _` | '_/ _` / _` / -_) '  (_-<
 \__,_|_| \__,_\__, \___|_| _/__/ 
               |___/               
```
