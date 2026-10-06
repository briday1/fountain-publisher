# WriteShape branding

The approved flat top-down keyboard design uses a true zoomed crop, with no outer frame. W/S share the theme accent. All surrounding outlines and legends use one faint neutral color at 20% contrast; nothing is blurred or shaded.

- icons/: borderless square keyboard crops in all nine themes.
- logos/: the same keyboard neighborhood uncropped, with the Courier Prime WriteShape wordmark underneath and a transparent background.
- *-comparison: all nine variants together. Backdrops and labels are for comparison only.
- writeshape-brand-vectors.zip: all SVGs, comparison sheets, font licenses and this guide.

The app uses WriteShapeMark and WriteShapeLogo for theme-aware branding. Downloads/install icons use Rose. Maskable artwork is slightly reduced so both filled keys fit the safe circle; the background fills the tile.

Run npm run brand:icons from beta/ after changing the shared vector geometry or palettes. Requires Inkscape. Sources: src/components/writeShapeKeyboard.ts, src/components/WriteShapeMark.tsx, src/branding/writeShapeThemes.ts, scripts/generate-writeshape-icons.ts.

Key legends use DejaVu Sans Bold outlined paths; the wordmark uses Courier Prime Bold. Both font licenses are in the archive.
