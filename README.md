# Echolocation

> *You can't see anything until you make a sound. Unfortunately, neither can the things hunting you.*

**Echolocation** is a sound-based horror and mystery game I built for Hack Club's **#3AM** event. The idea was simple: what if you were trapped in a world where you couldn't see anything, and the only way to understand your surroundings was by making noise?

The entire game takes place in complete darkness. There are no lights, no minimap, and no visible paths to follow. You have to send out sonar pulses to reveal the walls and objects around you. But there's a catch: the sounds you make can also attract whatever is lurking in the dark.

I built the game in one late-night coding session, experimenting with the Web Audio API to create an atmosphere that feels unsettling without relying on traditional visuals or sound files.

🕹️ **Play the game:** https://hunarskillmaster.github.io/echolocation/

---

## How It Works

- **A World in Complete Darkness:** Everything starts as a pitch-black screen. Walls and surroundings only become visible when a sonar pulse reaches them, and they slowly disappear as the echoes fade.

- **Sonar and Reflections:** Click or press `Space` to send out sound waves. The rays can bounce off walls up to two times, allowing you to discover areas around corners and get a better sense of your surroundings.

- **Sounds Created From Scratch:** Every sound in the game, including sonar pulses, echoes, footsteps, and enemy noises, is generated directly in the browser using the Web Audio API. No pre-recorded audio files are used.

- **Every Sound Has a Risk:** Sending out pulses helps you navigate, but enemies can hear them too. Even your footsteps can give away your position. You can hold `Shift` to move more quietly and avoid attracting unwanted attention.

## Controls

| Action | Key / Input |
|---|---|
| Move | `W` `A` `S` `D` or Arrow Keys |
| Focused Pulse | `Left Click` (narrow forward cone) |
| Omni Pulse | `Spacebar` (360° sonar burst, costs more) |
| Sneak | Hold `Shift` |
| Mute | `M` |
| Pause | `Escape` or `P` |

## Built With

- **HTML5 Canvas** – Renders sonar waves, echo trails, and wireframe silhouettes.
- **TypeScript** – Handles raycasting, line intersections, and sound-wave reflection calculations.
- **Web Audio API** – Generates all game audio in real time, including three-layer synthesized footsteps.
- **React** – Powers the HUD and other interface elements.

One thing I particularly wanted was to avoid relying on external assets, so all the visuals and sounds are generated through code.

## Running It Locally

Want to try it out or explore the code? You can run the project locally:

```bash
git clone https://github.com/hunarskillmaster/echolocation.git
cd echolocation
npm install
npm run dev
```

---

Built late at night, one sonar pulse at a time.
