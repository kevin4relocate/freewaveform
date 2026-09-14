# FreeWaveform

A browser-based audio-reactive waveform editor for music visualizers. Audio and images stay local in the browser.

## Current workflow

1. Load local audio (MP3/WAV/M4A)
2. Add an optional background image and adjust fit, zoom, darkness, blur and saturation
3. Add up to five independent waveform layers
4. Tune reaction, shape, detail, color, Global Wave Look and optional waveform Fill
5. For closed waveform shapes, tap/click the center of the waveform and type its built-in text
6. Add independent Free Text layers only when needed
7. Select, drag, multi-select and align waveform/free-text elements directly on the preview
8. Switch between 16:9 and 9:16 and export the full track to WebM

## Render architecture

The visible layer order is:

`Background → Ambient FX → Waveform Fill → Waveform Border → Waveform Center Text → Free Text → Overlay`

`Ambient FX` is reserved for integrated effects such as snow, smoke, mist and dust. Fill and waveform center text use the same preview/export canvas, so export matches the live preview.

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

## Text behavior

Closed waveform visualizers own their center text. There is no Free/Inside placement switch.

- Tap/click the empty center area of a closed waveform to add or edit text
- Center text stays attached to that waveform when it moves or is duplicated
- Center text auto-fits up to three lines and uses the waveform color
- Open/edge visualizers such as Center Wave, Mountain, Bottom, Top and Side Bars do not expose center text because they have no enclosed text area
- Center text always renders above waveform Fill and border

The **Text** tab is reserved for independent **Free Text**. It starts empty; use **+ Add Free Text** only when a separate text object is needed.

## Layout presets

Layout Presets preserve waveform-layer visual settings, waveform center text, Fill, Global Wave Look and Free Text layers. Background image files are intentionally not embedded. Older Center Plate presets remain compatible through the Fill migration layer.

## Code organization

- `fw-runtime-v1.js` — shared utilities, toast service and render pipeline
- `wave-config-v1.js` — waveform defaults, styles, shapes and Fill defaults
- `app-v3.js` — audio analysis, background, Free Text, timeline and export orchestration
- `wave-engine-v2.js` — waveform state, border rendering, UI binding and layer API
- `wave-fill-v1.js` — Fill UI plus audio-reactive Fill renderer
- `center-text-v1.js` — per-waveform tap-to-edit center text and Free Text tab cleanup
- `text-engine-v2.js` — Free Text positioning/font bridge
- `styles.css` — base application layout
- `styles-components.css` — editor component/polish styles

## Export

WebM export records the same canvas used by the live preview in real time, preserving Fill, waveform border, waveform center text and Free Text layer order.

## Privacy

Uploaded audio and images remain in the browser. There is no upload backend.
