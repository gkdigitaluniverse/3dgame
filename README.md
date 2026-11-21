# APEX DRIVE — 3D Racing

A 3D car racing game that runs entirely in the browser. No install, no build step.

**Play:** https://gkdigitaluniverse.github.io/3dgame/

- 3 circuit races + Meridian City open world
- 6 procedural sports cars, nitro, traffic, rivals, coins, checkpoint gates
- Touch controls (buttons / wheel / tilt), fullscreen, customisable controls
- Single self-contained index.html — three.js and fonts embedded, works offline

Built with three.js (MIT). Fonts: Chakra Petch & JetBrains Mono (SIL OFL).

## Source

The modular source lives in `source/` (12 files) and builds the single `index.html`:

```bash
python3 source/build.py
```

`source/vendor/three-0.149.0.min.js` is three.js r149 (MIT). Fonts are embedded (SIL OFL).
