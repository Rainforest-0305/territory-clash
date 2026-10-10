# Territory Clash (땅따먹기)

Territory-capture arcade game built with TypeScript and Vite.

- Play (web build): https://rainforest-0305.github.io/territory-clash/
- This branch holds the **source**. The `main` branch holds the built web output served by GitHub Pages.

## Run

```bash
npm install
npm run dev        # local dev server
npm run typecheck
```

## Notes

- **Ads:** the Apps-in-Toss build contains ads (`src/ads`).
- Production ad placement IDs, promotion codes, and the push template code are replaced with placeholders (`ait.v2.live.XXXXXXXXXXXXXXXX`, `__PROMOTION_CODE__`, `__PUSH_TEMPLATE_CODE__`), so this source does not reproduce the production build as-is.
- Build output (`dist/`), submission bundles (`*.ait`), and internal work logs are not tracked.
