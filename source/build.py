#!/usr/bin/env python3
"""Build the single-file game from the modular sources.

    python3 source/build.py

Reads   source/src/*  +  source/vendor/three-*.min.js
Writes  index.html      (repo root — this is what GitHub Pages serves)
"""
import os
import sys
import glob

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.abspath(os.path.join(ROOT, '..', 'index.html'))

ORDER = ['util.js', 'audio.js', 'track.js', 'world.js', 'cars.js',
         'game.js', 'ui.js', 'main.js']


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def main():
    missing = [f for f in ORDER if not os.path.exists(os.path.join(SRC, f))]
    if missing:
        sys.exit('missing source files: ' + ', '.join(missing))

    three_files = sorted(glob.glob(os.path.join(ROOT, 'vendor', 'three-*.min.js')))
    if not three_files:
        sys.exit('three.js build not found in source/vendor/')
    three = read(three_files[0])

    css = read(os.path.join(SRC, 'fonts.css')) + '\n' + read(os.path.join(SRC, 'style.css'))
    js = '\n'.join('/* ==== %s ==== */\n%s' % (f, read(os.path.join(SRC, f))) for f in ORDER)
    html = read(os.path.join(SRC, 'index.html'))

    for bad in ('</script',):
        if bad in js.lower() or bad in three.lower():
            sys.exit('refusing to inline: found %r inside a script' % bad)

    html = (html.replace('/*__CSS__*/', css)
                .replace('/*__THREE__*/', three)
                .replace('/*__JS__*/', js))

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    print('wrote %s (%.0f KB)' % (OUT, len(html) / 1024))


if __name__ == '__main__':
    main()
