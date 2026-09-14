# FreeWaveform

A browser-based audio-reactive waveform editor for music visualizers. Audio and images stay local in the browser.

## Current workflow

1. Load local audio (MP3/WAV/M4A)
2. Add an optional background image and adjust fit, zoom, darkness, blur and saturation
3. Add up to five independent waveform layers
4. Tune reaction, shape, detail, color, Global Wave Look and optional waveform Fill
5. Edit Song Name, Artist / Channel and extra text layers
6. Select, drag, multi-select and align waveform/text elements directly on the preview
7. Switch between 16:9 and 9:16
8. Export the full audio duration to WebM in real time

## Render architecture

The visible layer order is:

`Background → Ambient FX → Waveform Fill → Waveform Border → Text → Overlay`

`Ambient FX` is reserved for integrated effects such as snow, smoke, mist and dust. Fill is drawn immediately before its waveform border from the same audio/shape parameters, while text is always drawn afterward.

## Waveform features

- Brush Ring, Smooth Ring, Radial Bars, Orbit Dots
- Center Wave, Mountain Wave
- Bottom, Top, Top + Bottom, Left, Right and Side waves
- Circle, triangle, square, diamond, pentagon, hexagon, octagon, star, lotus and ink-blob shapes
- Up to five waveform layers
- Reaction, beat punch, sensitivity, smoothing, detail, depth, sharpness and glow controls
- Manual color, HEX input and EyeDropper support
- Global Wave Look with Auto Contrast, Outline and Local Backdrop
- Optional Fill for Brush Ring, Smooth Ring, Radial Bars and Orbit Dots
- Fill color, HEX, opacity and one-click **Use Wave Color**
- Fill follows the audio-reactive waveform contour instead of using a separate static plate shape

## Text and layout

- Text always renders above waveform Fill and border
- Song Name supports up to two lines
- Multiple font stacks including Chinese display/calligraphy fonts
- HEX color controls
- Direct canvas positioning
- Marquee selection, group drag, smart guides, alignment and distribution

## Layout presets

Layout Presets preserve waveform-layer visual settings, including Fill, together with Global Wave Look and text content/styles/positions. Background image files are intentionally not embedded. Older layouts that used Center Plate are interpreted as Fill so existing saved layouts remain usable.

## Code organization

- `fw-runtime-v1.js` — shared utilities, toast service and render pipeline
- `wave-config-v1.js` — waveform defaults, styles, shapes and Fill defaults
- `app-v3.js` — audio analysis, background, text, timeline and export orchestration
- `wave-engine-v2.js` — waveform state, border rendering, UI binding and layer API
- `wave-fill-v1.js` — Fill UI plus audio-reactive Fill renderer
- `multi-wave-ui-v15.js` — Global Wave Look UI/state
- `text-engine-v2.js` — text positioning/font bridge
- `styles.css` — base application layout
- `styles-components.css` — editor component/polish styles

## Export

WebM export records the same canvas used by the live preview in real time, so Fill, waveform and text use the same layer order in preview and export.

## Privacy

Uploaded audio and images remain in the browser. There is no upload backend.
