# Back to You

**A scroll-driven infographic about plastic in Japan, and how it finds its way back into your body.**

🔗 **Live site:** https://vonnes123.github.io/Back-to-you-plastic/

*Communication Design 1 · TU/e exchange · 2026*

---

## About the project

*Back to You* is an interactive web story for **Japanese university students (18–24)**. Its message is simple: *the plastic we use finds its way back to us.* You scroll through it like a short film. A 3D scene stays on screen the whole time while text, data and 2D illustrations move in and out.

The story starts as a catch at sea and ends with a question to the viewer:

| # | Scene | What happens |
|---|-------|--------------|
| 01 | **The Catch** | From a fishing boat at night you click to catch a sardine. Blue flecks (microplastics) cover the fish and drift in the water. 77% of anchovies sampled in Tokyo Bay had plastic in their gut. |
| 01b | **Packed** | The fish goes into a styrofoam cooler, then onto a supermarket tray under cling film: three layers of plastic before it reaches you. |
| 02 | **Your Table** | A Japanese dinner seen from above. Every plastic item is drawn in blue. Bite by bite you eat the fish while a counter tracks the particles you take in. |
| 03 | **On You** | Your hand rises into view covered in flecks. The camera turns around to show *you*, then your family, pets and friends lit up one by one in the dark. |
| 04 | **Plastic Everywhere** | A supermarket trip: an umbrella sleeve, a snack bag full of individually wrapped cookies, and a plastic bag to carry it all home. |
| 05 | **Japan & the World** | A 3D map of Japan with a bar for plastic waste per person, compared with the USA, China and India. |
| 06 | **Inside** | The camera dives into your chest and cuts to a radiologist's lightboard: X-ray films showing where microplastics have been found in the body, each with its source. |
| 07 | **So What?** | You drop the bags and shrug. *"So what can I do?"* You click four times to break free. |
| 08 | **The Big Players** | The plastic industry, the waste and "recycling" industry, and national economic interests rise up around you. Next to them, your impact is small. |
| 09 | **Small Switches** | Reusable alternatives (eco-bag, my-bottle, my-hashi), plus evidence that Japan's 2020 bag fee changed behaviour fast. |
| 10 | **Together** | One by one, thousands of people with reusable items appear behind you, out to the horizon. |
| 11 | **Your Turn** | *"So, will you be the change for a better future?"* With useful links and full references. |

### Visual language
- **Grayscale ink world, blue means plastic.** Everything is dark and desaturated with a grain overlay, and the only colour is a palette of blues (`#08869C`, `#154F66`, `#E3F2FA` and a glowing `#3FD3E8`). Anything plastic is drawn in that blue, and microplastics are small tumbling blue flecks.
- **2D and 3D mixed.** SVG illustrations (sea, supermarket, dinner table, X-ray films) are layered with simple, stylised 3D models (the fish, rounded pictogram people, buildings).
- **HUD annotations** (thin brackets, leader lines, monospace labels) make the data read like scientific findings.
- **Languages:** English, with Japanese and Korean versions behind the switch in the top right.

---

## Tech stack

The site is plain HTML, CSS and JavaScript (ES modules). There's no build step or framework; libraries load from a CDN.

| Library | Version | Used for |
|---------|---------|----------|
| [Three.js](https://threejs.org/) | 0.160.0 | All 3D: the fish, people, buildings, map, particles, lighting |
| [GSAP](https://gsap.com/) + ScrollTrigger | 3.12.5 | Scroll-scrubbed timelines and all animation |
| [Lenis](https://lenis.darkroom.engineering/) | 1.1.13 | Smooth scrolling |
| Google Fonts | — | Inter Tight, IBM Plex Mono, Noto Sans JP / KR |

Hosted on **GitHub Pages**.

### File structure
```
index.html        page structure, text cards, scroll sections
css/style.css     layout, cards, HUD, responsive rules
js/main.js        renderer, camera rig, state, all scroll timelines, HUD
js/fish.js        procedural sardine + shaders (swim, cook, eat, underwater) + microplastic flecks
js/scenery.js     SVG scenery: sea, boat, cooler, tray, dinner table, supermarket
js/people.js      pictogram people, pets, spotlights, props, Japan/country map + bars
js/players.js     the "big players" (factory, incinerator, crest), reusable items, instanced crowd
js/xray.js        the 2D X-ray lightboard (three films + call-outs)
js/i18n.js        EN / JA / KO strings
```

---

## How it works

### One state object, many scroll timelines
Everything that moves (fish pose, camera, lights, cards, particles) reads from a few plain JS state objects, such as `S` (scene), `C` (camera) and `P` (props). Each scroll section has a GSAP timeline that is **scrubbed** by ScrollTrigger and tweens those values. A single render loop reads the state every frame and applies it to the 3D scene and the HUD. Because the timelines are scrubbed and use `fromTo` tweens, the whole story plays correctly in **reverse** when you scroll back up.

### Keeping 2D and 3D aligned
The SVG layers sit in a 1600×900 "stage" that scales with the viewport **height**, just as the 3D camera's vertical field of view does. Because both scale the same way, a point in the 3D world always lands on the same spot in the 2D illustration (the fish stays on its plate) at any screen width. Layer order is: SVG background → WebGL canvas → SVG foreground → HUD. That's how waves, cling film and chopsticks can sit *in front of* the 3D fish.

### The camera rig
The camera orbits around the protagonist's eyes using three values: `theta` (angle), `r` (distance) and `h` (height). `r = 0` is first-person view. `theta = π` faces the protagonist from the front. Each scene change is a tween between two rig poses, which gives the "turn around and look at yourself" moments.

### Procedural models and shaders
- **The fish** is built from a mathematical body profile, not a downloaded model. Its material is extended with custom GLSL that:
  - **bends** the body for swimming;
  - tints it **underwater**;
  - adds grill marks and char when it's **cooked**;
  - **discards** pixels to bite chunks out of it, revealing the skeleton inside.
- **Microplastic flecks** are point sprites drawn as small rotating rectangles. They're sampled on mesh surfaces (`MeshSurfaceSampler`), and as each bite is taken they fly toward the camera, "into you".
- **People** are rounded pictograms made from lathe and capsule shapes, with simple features (hair, glasses, a dress, a crossbody bag).

### Performance
- **The crowd** (~2,000 people) uses `InstancedMesh`: a handful of draw calls instead of thousands. Only people the final camera can actually see are created. Distance fog fades the crowd toward the horizon.
- **Moving waves** are separate SVG layers moved with CSS transforms, so the browser composites them on the GPU instead of repainting the whole scene every frame.

### Phones
On portrait screens the view **pans** to whatever is in focus: the hand, then family, then friends, then each factory. It shifts the 3D projection matrix and translates the SVG layers by the same number of pixels, so they stay aligned. The X-ray films stack vertically and the board scrolls to each one as its call-outs appear.

### Run it locally
ES modules need a local server; opening `index.html` directly from the file system won't work.
```bash
npx http-server -p 5173 -c-1
# then open http://localhost:5173
```

---

## A note on the data

Every number on screen has a source, listed below. Some honest caveats, which are also stated on the site:
- **No study has measured microplastics specifically in Japanese 18–24-year-olds.** The site uses a study of young university students in Beijing and a study of healthy Japanese adults.
- Most studies of microplastics in the body are **small and show associations, not proof of harm**. In 2026 some researchers questioned how certain organ studies were measured.
- Japan's figure for single-use plastic waste per person is reported as **about 35–40 kg** depending on the source; the site uses ~37 kg.
- The country outlines on the map are symbolic and **not to scale**.
- The Japanese and Korean translations are drafts.

---

## References

**Sea & seafood**
1. Tanaka, K. & Takada, H. (2016). Microplastic fragments and microbeads in digestive tracts of planktivorous fish from urban coastal waters. *Scientific Reports*. https://link.springer.com/content/pdf/10.1038/srep34351.pdf
2. Isobe, A. et al. (2015). East Asian seas: a hot spot of pelagic microplastics. *Marine Pollution Bulletin*. https://researchmap.jp/read0008573/published_papers/22044631

**Microplastics in people**

3. Cox, K. D. et al. (2019). Human consumption of microplastics. *Environmental Science & Technology*. https://pubs.acs.org/doi/10.1021/acs.est.9b01517
4. Tsuji et al. (2026). Microplastics in stool, diet and inflammation in healthy Japanese people. https://pmc.ncbi.nlm.nih.gov/articles/PMC12981973/
5. Zhang, N. et al. (2021). You are what you eat: microplastics in the feces of young men living in Beijing. *Science of the Total Environment*. https://www.sciencedirect.com/science/article/abs/pii/S0048969720378761
6. Leslie, H. A. et al. (2022). Discovery and quantification of plastic particle pollution in human blood. *Environment International*. https://doi.org/10.1016/j.envint.2022.107199
7. Zhang, J., Wang, L. & Kannan, K. (2019). Polyethylene terephthalate and polycarbonate microplastics in pet food and feces. *Environmental Science & Technology*. https://pubs.acs.org/doi/10.1021/acs.est.9b03912

**Health effects (X-ray scene)**

8. Marfella, R. et al. (2024). Microplastics and nanoplastics in atheromas and cardiovascular events. *New England Journal of Medicine*. https://www.nejm.org/doi/full/10.1056/NEJMoa2309822
9. Jenner, L. C. et al. (2022). Detection of microplastics in human lung tissue using μFTIR spectroscopy. *Science of the Total Environment*. https://doi.org/10.1016/j.scitotenv.2022.154907
10. Yan, Z. et al. (2022). Analysis of microplastics in human feces reveals a correlation between fecal microplastics and inflammatory bowel disease status. *Environmental Science & Technology*. https://pubs.acs.org/doi/10.1021/acs.est.1c03924
11. Nihart, A. J. et al. (2025). Bioaccumulation of microplastics in decedent human brains. *Nature Medicine*. https://www.nature.com/articles/s41591-024-03453-1
12. Mother Jones / The Guardian (2026). Scientists question microplastics-in-body studies. https://www.motherjones.com/politics/2026/01/scary-research-findings-microplastics-human-health-flawed/

**Plastic in Japan**

13. Plastic Waste Management Institute (2025). *Material Flow Chart 2024*. https://pwmi.or.jp/pdf/panf2.pdf
14. UNEP (2018). *Single-use plastics: a roadmap for sustainability*. https://wedocs.unep.org/handle/20.500.11822/25496
15. Heinrich Böll Stiftung. *Plastic Atlas Japan* (special edition). https://kr.boell.org/en/node/879
16. Minderoo Foundation (2021). *Plastic Waste Makers Index*, via Statista. https://www.statista.com/chart/24874/single-use-plastic-waste-generated-per-person-in-selected-countries/
17. Ministry of the Environment, Japan. Effects of the plastic shopping bag fee. https://www.env.go.jp/content/000050376.pdf

**The big players**

18. Greenpeace East Asia (2024). Petrochemical production in South Korea, Japan and Taiwan. https://www.greenpeace.org/eastasia/press/8698/new-research-finds-plastic-production-in-south-korea-japan-and-taiwan-as-major-contributors-to-plastic-climate-crisis/
19. Down To Earth (2024). Japan sorts its plastic better than any country. It still recycles very little of it. https://www.downtoearth.org.in/waste/epr-in-asia-pacific-japan-sorts-its-plastic-better-than-any-country-it-still-recycles-very-little-of-it
20. The Diplomat (2023). Global plastics treaty will test Japan's clean image. https://thediplomat.com/2023/05/global-plastics-treaty-will-test-japans-clean-image/
21. Eco-Business (2024). Global plastics treaty talks in Busan fail to reach agreement. https://www.eco-business.com/news/global-plastics-treaty-talks-in-busan-fail-to-reach-agreement-and-adjourned-due-to-persisting-divergence

**Useful links (shown on the final screen)**
- Plastics Smart, Ministry of the Environment, Japan: https://plastics-smart.env.go.jp/
- mymizu, free water refill spots in Japan: https://www.mymizu.co/
- UNEP, plastic pollution: https://www.unep.org/plastic-pollution
- Break Free From Plastic: https://www.breakfreefromplastic.org/
- Plastic Free July: https://www.plasticfreejuly.org/

---

*Built with the help of Claude Code (Anthropic) for code generation; the concept, art direction and story are by the author.*
