# WriteShape branding

The approved W/S design uses only two staggered keys, with simple depth on the right and bottom. Both share the theme accent. Their legends sit at fixed upper-left anchors and have equal visible heights of 163 pixels in the 900-pixel icon, including their rounded outlines. The S has an optical weight correction so its curved strokes read as strongly as the W at toolbar size. The complete silhouette, including its depth, is centered and fully visible with no rim or outer frame.

- icons/: centered W/S icons in all nine themes.
- logos/: the same two keys uncropped, with the Courier Prime WriteShape wordmark underneath and a transparent background.
- *-comparison: all nine variants together. Backdrops and labels are for comparison only.
- writeshape-brand-vectors.zip: all SVGs, comparison sheets, font licenses and this guide.

The app uses WriteShapeMark and WriteShapeLogo for theme-aware branding. Downloads/install icons use Rose. Maskable artwork is slightly reduced so both filled keys fit the safe circle; the background fills the tile.

Run npm run brand:icons from beta/ after changing the shared vector geometry or palettes. Requires Inkscape. Sources: src/components/writeShapeKeyboard.ts, src/components/WriteShapeMark.tsx, src/branding/writeShapeThemes.ts, scripts/generate-writeshape-icons.ts.

Key legends use DejaVu Sans Bold outlined paths; the wordmark uses Courier Prime Bold. Both font licenses are in the archive.
