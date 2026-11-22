# Echolocation

> *You can't see anything until you make a sound. Unfortunately, neither can the things hunting you.*

**Echolocation** is a minimalist, sound-driven horror/mystery exploration game built in the dark for Hack Club's **#3AM** event. 

There are no ambient lights, no glowing floor grids, and no safety nets—just a pitch-black screen. Every time you move or emit a sonar pulse, expanding rings of cyan and white light bounce off the walls around you, briefly mapping out corridors, hidden clues, and whatever else happens to be patrolling in the dark.

🕹️ **Play Live:** `https://hunarskillmaster.github.io/echolocation/`  

---
### How It Works

* **Blind Navigation:** The world starts at pure `#000000`. Walls, doors, and hazards only exist to your eyes for the few seconds after a sound wave hits them and fades away.
* **2D Raycasted Sonar & Reflections:** Clicking or pressing `Space` fires a radial burst of rays that bounce off walls, letting you "peek" around corners using reflected echoes.
* **Procedural Web Audio:** Every sonar ping, distant echo, and proximity rumble is synthesized live in the browser using the Web Audio API—no external `.mp3` or `.wav` files used.
* **Risk vs. Reward:** Spamming pulses keeps your surroundings visible, but sound travels both ways. Stay quiet, listen to directional audio cues, collect the scattered fragments, and find the exit.

---

### Controls

| Action | Key / Input |
| :--- | :--- |
| **Move** | `W` `A` `S` `D` or `Arrow Keys` |
| **Emit Sonar Pulse** | `Left Click` (directional) or `Spacebar` (360° pulse) |
| **Sneak / Quiet Step** | Hold `Shift` *(optional, if implemented)* |
| **Mute / Unmute Audio** | `M` or top-right toggle |

---

### Built With

* **HTML5 Canvas** for real-time wireframe rendering and decaying echo trails
* **TypeScript / JavaScript** for 2D ray-segment intersections and bounce physics
* **Web Audio API** for procedural sonar synthesis, stereo panning, and distance filtering
* Zero external asset packs—built late at night with way too much caffeine
