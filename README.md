# WordSpark — GitHub Pages only

A lightweight, mobile-friendly English vocabulary helper. The website itself is static and can be hosted on GitHub Pages. No build step, backend, account, or API key is required.

## Publish on GitHub Pages

1. Create a public GitHub repository, for example `wordspark`.
2. Upload `index.html`, `style.css`, `script.js`, and `README.md` to the repository's root folder.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch `main`, folder `/ (root)`, then press **Save**.
6. Wait for GitHub Pages to publish the site. The URL will look like `https://YOUR-USERNAME.github.io/wordspark/`.

## Features

- English dictionary definitions from dictionaryapi.dev.
- Persian translation from MyMemory's public translation endpoint.
- Click-to-pronounce English words using the browser's speech synthesis.
- Related image search through Wikimedia Commons; the page displays the image itself.
- Sentence examples from dictionary data where available, with varied practice sentences as a fallback.
- Responsive RTL design.

## Important limits

- GitHub Pages is static hosting. It cannot run a private AI model or hide API secrets. This project intentionally uses public endpoints and does not include an AI API key.
- Sentence examples are not guaranteed to be AI-generated or semantically tailored to every word. When the dictionary has no example, the site uses a practice sentence that contains the word.
- Meaning translation and images depend on third-party public services, internet access, and their current availability/rate limits. No static website can guarantee those services will never fail.
- The image is fetched from Wikimedia Commons; licensing and attribution details are provided by the image's source page/metadata where available. This version shows the image title but does not claim every image is public domain.
- Browser speech synthesis depends on the device/browser's available English voices.

## Files

- `index.html` — page structure
- `style.css` — appearance and responsive layout
- `script.js` — public API requests, rendering, and speech
