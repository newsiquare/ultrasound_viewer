# Ultrasound DICOM Annotation Viewer

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Start development server:

```bash
npm run dev
```

## Orthanc DICOMweb

Default env values are configured for:

- Base URL: `/dicom-web` (via Vite proxy to `http://localhost:8042`)
- Orthanc REST Base: `/orthanc` (thumbnail fallback via Orthanc preview API)
- Username: `admin`
- Password: `sonocloud2024`

If needed, set a direct DICOMweb URL:

```bash
VITE_DICOMWEB_BASE_URL=http://localhost:8042/dicom-web
```

You can also change the proxy target:

```bash
ORTHANC_TARGET=http://localhost:8042 npm run dev
```

## Features

- Left nav with active DICOM viewer menu
- Studies panel (search/filter/list)
- Center viewer area with toolbar, Cornerstone canvas, overlays, playback
- Right annotation management panel
- Export: COCO JSON, annotation JSON, CSV
