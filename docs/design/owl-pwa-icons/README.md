# Owl logo — PWA ikone

## index.html <head>
```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#ffffff">
```

## manifest (vite-plugin-pwa ili manifest.webmanifest)
```json
"icons": [
  { "src": "pwa-64x64.png",   "sizes": "64x64",   "type": "image/png" },
  { "src": "pwa-192x192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "pwa-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

`favicon.svg` se sam prebacuje u bijelo u dark modu preglednika.
`logo.svg` je čisti vektor (transparentna pozadina, #111) za upotrebu u UI-ju.
