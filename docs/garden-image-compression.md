# Garden image compression — manual step

The 5 garden scene images in `assets/garden/` are ~2.5 MB PNGs each, ~12 MB total:

```
main.jpg     797K
stage0.png   1.7M
stage1.png   2.4M
stage2.png   2.5M
stage3.png   2.5M
stage4.png   2.5M
```

These ship inside the app bundle and are decoded into memory whenever the menu is on
screen. Re-encoding the four PNGs as quality-80 JPGs (or WebP) cuts install size by
~8 MB and roughly halves the menu's image-memory footprint, with no perceptible
quality loss for photographic content.

## Recommended

Re-export each `stageN.png` from the source art as **quality-80 JPG** (or WebP), then
swap the `require()` paths in `screens/MainMenu.tsx` (`GARDEN_SCENES`) to the new
file names. Targets: each stage ≤ 600 KB.

## Quick re-encode commands

If you have ImageMagick installed locally:

```bash
cd assets/garden
for i in 0 1 2 3 4; do
  magick stage$i.png -quality 80 -strip stage$i.jpg
done
```

Or with `cwebp` (smaller still, but iOS support varies):

```bash
for i in 0 1 2 3 4; do
  cwebp -q 80 stage$i.png -o stage$i.webp
done
```

After re-export, update `screens/MainMenu.tsx`:

```ts
const GARDEN_SCENES = [
  require("../assets/garden/main.jpg"),
  require("../assets/garden/stage0.jpg"),   // ← .png → .jpg
  require("../assets/garden/stage1.jpg"),
  require("../assets/garden/stage2.jpg"),
  require("../assets/garden/stage3.jpg"),
  require("../assets/garden/stage4.jpg"),
];
```

`expo-image` handles JPG / WebP / AVIF identically — no other code changes needed.
