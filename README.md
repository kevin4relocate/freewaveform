# FreeWaveform

A browser-based audio-reactive waveform editor for music visualizers. Audio and images stay local in the browser.

## Current workflow

1. Load local audio (MP3/WAV/M4A)
2. Add an optional background image and adjust fit, zoom, darkness, blur and saturation
3. Add up to five independent waveform layers
4. Tune reaction, shape, detail, color, Global Wave Look and Center Plate
5. Edit Song Name, Artist / Channel and extra text layers
6. Select, drag, multi-select and align waveform/text elements directly on the preview
7. Switch between 16:9 and 9:16
8. Export the full audio duration to WebM in real time

## Render architecture

The preview uses one explicit render pipeline:

`Background → Ambient FX → Center Plate → Waveform → Text → Overlay`

`Ambient FX` is intentionally reserved for integrated effects such as snow, smoke, mist and dust. Visual modules register a render stage instead of intercepting Canvas APIs, so preview and export use the same deterministic layer order.

Waveform state has one owner: `wave-engine-v2.js`. Each waveform layer contains its own Center Plate configuration, so duplication, presets and future reordering stay consistent.

## Waveform features

- Brush Ring, Smooth Ring, Radial Bars, Orbit Dots
- Center Wave, Mountain Wave
- Bottom, Top, Top + Bottom, Left, Right and Side waves
- Circle, triangle, square, diamond, pentagon, hexagon, octagon, star, lotus and ink-blob shapes
- Up to five waveform layers
- Reaction, beat punch, sensitivity, smoothing, detail, depth, sharpness and glow controls
- Manual color, HEX input and EyeDropper support
- Global Wave Look with Auto Contrast, Outline and Local Backdrop
- Center Plate with blob/circle/rounded/diamond/follow-wave shapes, dark/auto/light/custom tone, size, opacity, soft halo and shadow

## Text and layout

- Song Name supports up to two lines
- Multiple font stacks including Chinese display/calligraphy fonts
- HEX color controls
- Direct canvas positioning
- Marquee selection, group drag, smart guides, alignment and distribution

## Layout presets

Layout Presets save waveform layers, Global Wave Look, Center Plate settings, text content/styles and positions. Background image files are intentionally not embedded in presets. Older preset schemas are migrated when loaded.

## Code organization

- `fw-runtime-v1.js` — shared utilities, toast service and render pipeline
- `wave-config-v1.js` — waveform defaults, styles, shapes and built-in templates
- `app-v3.js` — audio analysis, background, text, timeline and export orchestration
- `wave-engine-v2.js` — waveform state, UI binding, rendering and layer API
- `center-plate-v20.js` — Center Plate UI and plate-stage renderer
- `multi-wave-ui-v15.js` — Global Wave Look UI/state
- `text-engine-v2.js` — text positioning/font bridge without Canvas interception
- `styles.css` — base application layout
- `styles-components.css` — editor component/polish styles

## Export

WebM export records the same canvas used by the live preview in real time. The progress panel shows current position, elapsed time and estimated time remaining.

## Privacy

Uploaded audio and images remain in the browser. There is no upload backend.
