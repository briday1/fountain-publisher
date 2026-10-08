# WriteShape branding

The approved W/S design uses only two staggered keys, with simple depth on the right and bottom. Both share the theme accent. Their legends have equal 55-unit top and left insets at the upper-left anchors and use unmodified Liberation Sans Bold outlines at one shared font scale. The common cap height is 163 pixels in the 900-pixel icon; the S retains its natural curve overshoot. Neither letter has an added outline or a separate size or weight adjustment. The complete silhouette, including its depth, is centered and fully visible with no rim or outer frame.

- icons/: centered W/S icons in all nine themes.
- logos/: the same two keys uncropped, with the Courier Prime WriteShape wordmark underneath and a transparent background.
- *-comparison: all nine variants together. Backdrops and labels are for comparison only.
- writeshape-brand-vectors.zip: all SVGs, comparison sheets, font licenses and this guide.

The app uses WriteShapeMark and WriteShapeLogo for theme-aware branding. Downloads/install icons use Rose. Maskable artwork is slightly reduced so both filled keys fit the safe circle; the background fills the tile.

Run npm run brand:icons from beta/ after changing the shared vector geometry or palettes. Requires Inkscape. Sources: src/components/writeShapeKeyboardLegends.ts, src/components/WriteShapeMark.tsx, src/branding/writeShapeThemes.ts, scripts/generate-writeshape-icons.ts.

Key legends use Liberation Sans Bold outlined paths; the wordmark uses Courier Prime Bold. Both font licenses are in the archive.
