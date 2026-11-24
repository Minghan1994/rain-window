# Rain Window

Watching raindrops race down a car window, merge, and decide where they'll go.

A single-file web toy: a rainy forest drifts past outside, and the glass is covered in water that behaves like water — drops sit still until they're heavy enough, slide, swallow each other, leave beaded trails, and get pushed around by the wind. With synthesized rain, road, insect and bird sounds.

**Live demo:** https://minghan1994.github.io/rain-window/

## Controls

- Hover the glass pill at the top to open the controls: four weather presets (Mist, Drizzle, Rain, Storm) and dot meters for rain amount, volume and birds & insects. Tap it on touch screens.
- Click anywhere else, or `S`: sound on/off
- `↑` `↓`: more / less rain
- `F`: fullscreen

Settings are remembered in the browser.

## Run it locally

Plain JavaScript modules, no build step and no dependencies. Browsers only load modules over HTTP, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Project layout

| File | What it does |
|---|---|
| [`src/config.js`](src/config.js) | Every tunable number: physics constants, weather presets, and the values that follow the rain amount |
| [`src/main.js`](src/main.js) | Startup, resizing and the frame loop |
| [`src/scene.js`](src/scene.js) | The forest outside, the rain curtain and the car's speed |
| [`src/drops.js`](src/drops.js) | Drop physics: sliding, merging, trails, wind, evaporation |
| [`src/water.js`](src/water.js) | Stamps drops and droplets into the water map |
| [`src/spray.js`](src/spray.js) | Road spray on the glass and how drops wipe it |
| [`src/weather.js`](src/weather.js) | Storm level, gusts and lightning |
| [`src/renderer.js`](src/renderer.js) | The WebGL shader that composites everything |
| [`src/audio.js`](src/audio.js) | Synthesized rain, road, drips, thunder, crickets and birds |
| [`src/ui.js`](src/ui.js) | The control widget, keyboard shortcuts and saved settings |
| [`src/state.js`](src/state.js) | Shared state and small helpers |

To change how the rain behaves, start with `src/config.js`.

## How it works

No images, no audio files: everything is drawn and synthesized in code with Canvas 2D, one WebGL shader and the Web Audio API.

**Rendering**

1. The forest is painted procedurally in parallax layers (pre-blurred tiles), plus a rain curtain and a sharper, brighter copy used for refraction.
2. Every drop and droplet is stamped into a *water map*: a canvas whose colours are not colours — red/green store which way the water surface tilts, blue its thickness, and alpha a soft falloff.
3. A WebGL shader cuts the water map's alpha, so overlapping stamps melt into one surface, then bends the view through each point of water, adds a fog of road spray that drops wipe away, the storm look and lightning.

**Physics (per drop)**

- Sizes are 3-D: merging adds volume (r³).
- Weight (∝ r³) against the glass's grip along the contact line (∝ r): a drop only slides once it's big enough; the grip changes moment to moment, so drops stick, slip and stick again.
- Wet paths have less grip and pull later drops into the same track.
- Above a certain speed a sliding drop's tail pinches off into beads ("pearling") — the faster, the more often. Water isn't lost on the way: what a drop loses is what it leaves behind.
- Wind from the car's speed and storm gusts. Tiny drops sit in the still air right against the glass and hardly move; big ones stick up into the airflow and get pushed back.
- Small drops evaporate faster (dr/dt ∝ 1/r).
- Heavier rain changes many things together: bigger drops, bigger and more frequent trail beads that dry less, thicker spray, a darker and more blurred view, a rain curtain outside, gusts, lightning and thunder.

**Sound** is all generated with the Web Audio API: filtered noise for rain and road, short noise bursts for drips, low rumbles for thunder, sine chirps for crickets, and frequency sweeps for a few birds.

## References and credits

This project is an original implementation. No code, images or other assets from the projects below were copied; they were studied for technique and parameters, credited here with what was used from each.

### [codrops/RainEffect](https://github.com/codrops/RainEffect) — Lucas Bebber, Codrops

License: free to integrate or build upon; not to be republished as-is ([Codrops licensing](http://tympanus.net/codrops/licensing/)).

Used for the core look of the water:

- The overall rendering method: drops drawn into a water map (refraction direction in red/green, thickness in blue, soft alpha) and a WebGL shader that cuts the alpha (`alpha × 6 − 3`) so drops merge, and offsets the background lookup by the surface tilt.
- The shape of a drop: the alpha profile of `drop-alpha.png` was measured (a gaussian falloff with a sharp top edge) and regenerated in code; drops drawn 1.5× taller than wide.
- Seeing the world through drops via a small, very blurry, slightly brighter texture.
- Trails: trail drops left right under the moving drop, so they stay fused to it and stretch into a neck; trail size range (rain 0.25–0.35, storm 0.25–0.40 of the drop); trail rate rising with weather (storm 2.5×); gaps shrinking as the drop speeds up.
- Weather presets that change several parameters at once (drop size ranges, droplet amounts, trail settings), and the flickering multi-flash lightning.
- A sideways nudge toward an absorbed drop when two merge.

### [SardineFish/raindrop-fx](https://github.com/SardineFish/raindrop-fx) — SardineFish

License: MIT.

Used for the drop physics and the mist:

- Gravity against a randomly re-rolled resistance every 0.1–0.4 s, which gives the stick-slip motion.
- Merges that conserve momentum by mass.
- Trail drops never re-merging with their parent drop or their siblings.
- Raindrops erasing the mist roughly their own width (eraser size 0.93–1.0), and the mist growing back over about 10 s (`mistTime`).

### "Heartfelt" — Martijn Steinrucken (BigWings), Shadertoy

License: CC BY-NC-SA 3.0. Ideas only; no shader code was used.

- The view behind the glass blurring more as the rain gets heavier.
- Drops cutting clear trails through mist on the glass.
- Lightning that brightens what's already lit instead of washing everything white, and a cooler tint in a storm.

### Other

- The control widget's visual style was inspired by Dynamic Island–style widget designs.
- Built with [Claude Code](https://claude.com/claude-code).
