import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Pozadie ikon pre Android (maskable) a iPhone (apple-touch-icon) má farbu kruhu loga,
// aby okolo neboli biele okraje. Systém si ikonu oreže do vlastného tvaru.
const paper = '#efdcb4'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: paper } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: paper } },
  },
  images: ['public/favicon.svg'],
})
