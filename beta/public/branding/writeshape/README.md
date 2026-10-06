# WriteShape branding

The approved nine theme palettes use the same rounded, subtly tapered WASD geometry. W/S share the primary accent; A/D are neutral outlines at 55% opacity.

- icons/: cropped square icons with a thin primary-color frame.
- logos/: full uncropped key layout and WriteShape underneath, with no outer frame or background. PNGs have transparency.
- *-comparison: all nine variants together. Comparison backdrops are for display only.
- writeshape-brand-vectors.zip: all SVGs, comparison sheets and this guide.

The app uses WriteShapeMark for theme-aware icons and WriteShapeLogo for the full logo. Downloads/install icons use Rose. The maskable export slightly reduces the artwork to keep W/S inside the safe circle; its backdrop fills the tile.

Run npm run brand:icons from beta/ after changing the shared geometry or palettes. Requires Inkscape. Sources: src/components/writeShapeKeycaps.ts, src/components/WriteShapeMark.tsx, src/branding/writeShapeThemes.ts, scripts/generate-writeshape-icons.ts.

All letter shapes are vector outlines from the bundled DejaVu Sans Bold font. Its license is included in the vector archive and at src/fonts/LICENSE.txt.
