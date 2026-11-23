# Echolocation

> *You can't see anything until you make a sound. Unfortunately, neither can the things hunting you.*

**Echolocation** is a minimalist, sound-driven horror/mystery game I made for Hack Club's **#3AM** event. Built in one late night session with way too much caffeine and a weird obsession with making web audio sound scary.

There are no lights. No minimap. No glowing walls. Just a pitch-black screen and whatever you can ping with a sonar pulse. Walls only exist to your eyes for a second or two after a sound wave bounces off them - then they vanish again.

🕹️ **Play Live:** `https://hunarskillmaster.github.io/echolocation/`

---

### How It Works

* **Total Darkness:** The world is pure `#000000`. Walls only appear when a sonar echo hits them and fades out over a few seconds.
* **2D Raycasted Sonar:** Click or press `Space` to send out a burst of rays that bounce off walls (up to 2 bounces), letting you peek around corners via reflected echoes.
* **Web Audio Only:** Every sound - pings, echoes, footsteps, enemy rumbles - is synthesized live in the browser using the Web Audio API. No audio files at all.
* **Risk vs Reward:** Pinging keeps walls visible but sound travels both ways. Enemies hear your pulses and footsteps. Hold Shift to sneak quietly.

---

### Controls

| Action | Key / Input |
| :--- | :--- |
| **Move** | `W` `A` `S` `D` or Arrow Keys |
| **Focused Pulse** | `Left Click` (fires a narrow forward cone) |
| **Omni Pulse** | `Spacebar` (360° burst, more expensive) |
| **Sneak** | Hold `Shift` |
| **Mute** | `M` |
| **Pause** | `Escape` or `P` |

---

### Built With

* **HTML5 Canvas** for rendering echo trails and wireframe silhouettes
* **TypeScript** for the ray-segment math and bounce physics
* **Web Audio API** for all procedural sounds (footsteps are 3-layer synthesis)
* **React** for the HUD overlays
* Zero external audio or image assets

---

### Running It Locally

```bash
git clone https://github.com/hunarskillmaster/echolocation.git
cd echolocation
npm install
npm run dev
```
