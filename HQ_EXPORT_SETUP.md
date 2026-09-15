# HQ MP4 Export Setup

FreeWaveform now supports an optional cloud HQ renderer:

- Browser/Cloudflare Pages: editor + upload + progress UI
- Pages Function: stores jobs/assets in R2 and triggers GitHub Actions
- GitHub Actions: deterministic 1920x1080 30 FPS renderer
- FFmpeg: H.264 High Profile, CRF 16, AAC 320 kbps
- R2: temporary assets and final MP4

## 1. Cloudflare Pages bindings

Create an R2 bucket (for example `freewaveform-hq`) and bind it to the Pages project as:

`HQ_BUCKET`

Add these Pages secrets / variables:

- `HQ_EXPORT_KEY` - your private key used by the browser to start/check HQ jobs
- `HQ_RENDER_TOKEN` - long random secret shared with GitHub Actions
- `GITHUB_TOKEN` - fine-grained GitHub token that can dispatch Actions in `kevin4relocate/freewaveform`
- `GITHUB_REPO=kevin4relocate/freewaveform`
- `GITHUB_WORKFLOW=hq-render.yml`
- `GITHUB_REF=main`

For personal use, set an R2 lifecycle rule to delete objects under `jobs/` after 1 day.

## 2. GitHub Actions secrets

Add these repository Actions secrets:

- `HQ_RENDER_TOKEN` - exactly the same value as the Pages secret
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Create the R2 access key with Object Read & Write permission for the HQ bucket only.

## 3. Important branch note

GitHub `workflow_dispatch` only becomes callable after `.github/workflows/hq-render.yml` exists on the repository default branch.

During development this implementation stays on `editor-controller-v2`. Do not merge it to `main` until the editor behavior is approved. After the workflow reaches `main`, the **Export HQ MP4** button can trigger GitHub Actions normally.

## 4. First export

Open FreeWaveform, upload audio/background, build the visualizer, then click **Export HQ MP4**.

The first request asks for `HQ_EXPORT_KEY`; it is stored only in that browser's localStorage. The UI then shows queued/rendering progress. When the job reaches 100%, **Download MP4** downloads the completed file directly from R2 through the Pages Function.

## Output profile

- 1920x1080 or 1080x1920 according to project ratio
- 30 deterministic frames per second
- H.264 High Profile
- CRF 16
- preset `medium`
- yuv420p
- AAC 320 kbps
- MP4 fast start

The renderer is offline/deterministic: slow server rendering does not create dropped video frames.
