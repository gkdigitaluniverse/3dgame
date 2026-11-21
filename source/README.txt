APEX DRIVE — source
===================

The playable game is the single file:  ApexDrive3D.html
Open it in any modern browser (phone or desktop). No server needed.

This folder is the modular source the single file is built from.

  src/
    index.html    markup + screen structure
    fonts.css     embedded woff2 (Chakra Petch, JetBrains Mono - SIL OFL)
    style.css     all UI styling
    util.js       math, canvas-texture and geometry-merge helpers
    audio.js      procedural Web Audio engine / tyres / nitro / crashes
    track.js      circuit generator, themes, scenery, sky, lights
    world.js      open-world city (Meridian) : grid roads, blocks, gates
    cars.js       procedural sports-car models + performance tables
    game.js       renderer, driving physics, camera, traffic, race logic
    ui.js         save data, HUD, minimap, speedometer, screens
    main.js       boot, input, fullscreen, main loop
  vendor/
    three-0.149.0.min.js   three.js r149 (MIT, github.com/mrdoob/three.js)

Rebuild the single file after editing:

    python3 build.py

It inlines fonts, three.js and all modules into ../output/ApexDrive3D.html

Licences
  three.js ............ MIT
  Chakra Petch ........ SIL Open Font License 1.1
  JetBrains Mono ...... SIL Open Font License 1.1
  everything else ..... written for this project (procedural, no third-party assets)
