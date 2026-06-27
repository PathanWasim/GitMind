═══════════════════════════════════════════════════════════════
  GITMIND PRO — CINEMATIC SCROLL-DRIVEN REDESIGN
  Inspired by: Lando Norris (Awwwards Site of Year 2025),
  Obys Agency (kinetic type), Telescope (layered zoom scroll),
  Beeble.ai (subtle technical immersion)
═══════════════════════════════════════════════════════════════

IMPORTANT: Read ALL files in frontend/src/ first before writing
a single line. Use ls and read every component, page, css file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CORE PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The website IS the story of indexing a codebase.
As the user scrolls, they literally watch the GitMind
pipeline happen — a repo gets cloned, files appear,
vectors form, an AI answers. The scroll is the narrative.
Typography is the hero. Three.js is the atmosphere.
Motion tells the story. Nothing is static.

Think: cinematic film where scrolling = time passing.
Every section is a "shot". Camera moves. Text breathes.
The product explains itself through experience.

NOT: blobs floating on black. NOT: typical dark SaaS.
NOT: particles for the sake of particles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COLOR & AESTHETIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PALETTE — "Deep Forge × Bioluminescence":
  --void:        #07050E   /* near-black, warm undertone */
  --obsidian:    #0F0B18   /* cards and panels */
  --surface:     #16111F   /* elevated surfaces */
  --amber:       #F97316   /* primary energy — burnt orange */
  --amber-deep:  #C2410C   /* darker amber for depth */
  --amber-glow:  rgba(249,115,22,0.15) /* ambient amber light */
  --teal:        #0D9488   /* bioluminescent secondary */
  --teal-bright: #2DD4BF   /* teal highlights */
  --gold:        #EAB308   /* rare CTA accent */
  --w1:          #F0EBE3   /* warm white, never cold */
  --w2:          rgba(240,235,227,0.70)
  --w3:          rgba(240,235,227,0.40)
  --w4:          rgba(240,235,227,0.18)
  --glass:       rgba(15,11,24,0.60)
  --glass-border: rgba(249,115,22,0.12)

GRAIN TEXTURE — add globally on body::after:
  SVG feTurbulence baseFrequency="0.85" numOctaves="4"
  opacity: 0.038 on the noise rect
  This adds analogue warmth, separating from cheap digital look

FONTS:
  - 'Syne' weight 800/900 — display headlines (keep existing)
  - 'JetBrains Mono' — code, citations, mono text (keep)
  - Add 'Inter' var font via Google Fonts — body text
  (replace Plus Jakarta Sans with Inter for broader support)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GSAP SETUP (CRITICAL — DO THIS FIRST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Install GSAP via CDN in index.html (no npm needed):
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollSmoother.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/SplitText.min.js"></script>

In main.jsx, register globally:
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText)

Wrap the entire app in smooth scroll:
  ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: 1.4,
    effects: true,
    normalizeScroll: true
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CUSTOM CURSOR (global, Cursor.jsx)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Two elements:
  1. dot: 5px circle, amber fill, position: fixed,
     moves instantly with mouse via gsap.quickSetter
  2. ring: 32px circle, border 1.5px amber rgba(249,115,22,0.5),
     follows with gsap.to lerp (duration: 0.15, ease: "power2.out")

States:
  - Default: as above
  - Hover link/button: ring scales to 48px, border teal,
    dot disappears (scale 0)
  - Click: ring squishes scaleX(0.7) scaleY(1.3) then springs
    back with elastic ease
  - Drag/hover on Three.js canvas: ring becomes crosshair shape
    using clip-path

Hide default cursor: cursor: none on html, body, a, button

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LANDING PAGE — SCROLL STORY IN 6 ACTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The entire landing page is 700vh tall.
A Three.js canvas sits FIXED behind everything (z-index: 0).
HTML content scrolls over it (z-index: 10).
As scroll progresses, the Three.js scene transforms.

─── NAVBAR ───────────────────────────────────────────

Position: fixed top, full width, z-index: 100
Background: rgba(7,5,14,0.01) → on scroll past 80px:
  backdrop-filter blur(24px) saturate(180%)
  background rgba(7,5,14,0.75)
  border-bottom 1px solid rgba(249,115,22,0.08)
  Transition: 400ms ease

Left: Logo mark (orange square with G) + "GitMind" in Syne 800
  G and M letters colored --amber, rest --w1
  On hover: logo mark rotates 180deg over 600ms

Center: Nav links — FEATURES · HOW IT WORKS · GITHUB
  Font: Inter 500, size 12px, letter-spacing 0.12em, uppercase
  Color: --w3 → hover: --w1 + amber underline slides in from left

Right: "Launch App →" button
  Background: transparent
  Border: 1px solid --amber-glow (rgba 0.3)
  On hover: border becomes solid amber, inner amber glow,
  text color shifts to amber
  Magnetic effect: on mouse proximity within 80px,
  button moves toward cursor max 8px using:
    gsap.to(btn, { x: dx*0.3, y: dy*0.3, duration: 0.4 })

─── ACT 1: HERO (0vh – 100vh) ───────────────────────

Layout: viewport height, centered content

HEADLINE ANIMATION (on page load, not scroll):
  Text: "Any Codebase." (line 1) "Instantly" (line 2)
  "Understood." (line 3, amber gradient)

  Use SplitText to split into individual chars.
  Initial state per char:
    opacity: 0
    y: 60
    rotateX: -40deg
    filter: blur(8px)
  Animate to natural state, staggered 0.025s per char,
  ease: "power3.out", duration: 0.8
  Line 1 starts at t=0.2s, Line 2 at t=0.6s, Line 3 at t=1.0s

  "Understood." — amber gradient text:
    background: linear-gradient(135deg, #F97316, #EAB308)
    -webkit-background-clip: text
    -webkit-text-fill-color: transparent

HEADLINE SIZE: clamp(64px, 9vw, 128px), Syne 900, line-height 0.9
  Left-aligned, occupies left 55% of viewport

RIGHT SIDE: Three.js mini-scene visible through
  a CSS clip-path organic shape (not a rectangle — use:
  clip-path: polygon(8% 0%, 100% 0%, 100% 100%, 0% 92%, 4% 44%)
  This creates an angled cut revealing the 3D scene on right

TWO BADGE PILLS above headline:
  "⚡ 800 tokens/sec via Groq" and "🔒 100% Local Embeddings"
  Glass pill: background rgba(15,11,24,0.7),
  border 1px solid rgba(249,115,22,0.2),
  padding 6px 14px, border-radius 100px
  Left dot: 6px circle pulsing green (CSS keyframe pulse)
  Animate in: opacity 0 → 1, y: -16 → 0, delay 0.1s stagger

SUBHEADLINE below main text:
  "Index any public repo and interrogate it in plain English
   — with precise, source-cited answers."
  Color: --w3, Inter 400, size: clamp(16px, 1.8vw, 22px)
  Animate: blur(16px) opacity(0) → blur(0) opacity(1)
  Delay: 1.4s after page load

CTA BUTTON:
  "Launch App →", large: padding 16px 40px, border-radius 12px
  Background: linear-gradient(135deg, #F97316, #C2410C)
  Box-shadow: 0 0 0 0 rgba(249,115,22,0.4)
  On hover: box-shadow expands to 0 0 40px 8px rgba(249,115,22,0.3)
  + translateY(-3px), transition 300ms
  Grain texture overlay on button surface (pseudo-element)
  Animate in: scale(0.9) opacity(0) → scale(1) opacity(1), delay 1.6s

SCROLL INDICATOR:
  Bottom center: "scroll" text in --w3 Inter 11px uppercase
  + animated chevron bouncing down 6px, loop infinite
  Fades out when scroll > 50px

─── THREE.JS FIXED SCENE (behind all content) ────────

Scene concept: A floating 3D CODEBASE UNIVERSE.
NOT a blob. NOT random particles.

Actual implementation:
  - 200 small glowing cubes (BoxGeometry 0.08, 0.08, 0.08)
    arranged in a loose 3D grid/cloud formation
    representing "files in a repository"
  - Each cube: MeshStandardMaterial, color cycles between
    amber #F97316 and teal #0D9488 based on its index
  - Cubes slowly rotate individually (each has random rotation speed)
  - Cubes gently float: y position += sin(time + index) * 0.002
  - 1 large central TorusKnot (the "AI core") slowly rotating:
    TorusKnotGeometry(0.8, 0.25, 100, 16)
    MeshPhysicalMaterial: metalness 0.9, roughness 0.1,
    color #F97316, iridescence: 0.6
  - Point lights: amber at (3,3,3) intensity 2,
    teal at (-3,-2,3) intensity 1.5
  - Camera starts far back: z=12

AS SCROLL PROGRESSES (ScrollTrigger scrub: true):

  0% → 16% (Act 1 Hero):
    Camera: z=12, looking at origin
    Cubes: spread in loose cloud formation
    TorusKnot: slowly rotating, centered

  17% → 33% (Act 2 Clone):
    Camera: gsap moves z: 12→8, x: 0→-1
    Cubes: animate to a COLUMN formation (like a file tree)
    on the right side of scene (x: 2 to 3)
    New cubes cascade in from top (staggered y: 5→position)
    TorusKnot: moves to x: -2, scales down to 0.6

  34% → 50% (Act 3 Scan):
    Camera: z: 8→6, tilts slightly (camera.rotation.z: 0→0.05)
    A horizontal amber SCANNING LINE sweeps through the cube cluster
    (thin BoxGeometry plane, y position animated top→bottom)
    Cubes glow brighter as scan line passes them
    (emissive intensity increases momentarily)

  51% → 66% (Act 4 Embed):
    Camera: z: 6→5, looking slightly up
    Cubes DETACH from column and fly toward the TorusKnot
    (animate position to cluster around knot)
    Connecting lines appear between cubes (Three.js Line objects)
    forming a neural network around the knot
    Lines: opacity 0→0.4 with stagger

  67% → 83% (Act 5 Answer):
    Camera pulls back: z: 5→10
    TorusKnot PULSES (scale 1→1.2→1 rapid)
    emits a ring shockwave (expanding torus, opacity 1→0)
    Cubes settle into orbital paths around the knot
    Golden particles stream from knot (50 small points,
    position lerps from knot position outward)

  84% → 100% (Act 6 CTA):
    Camera: z: 10→14 (pulling further back)
    Everything becomes smaller, peaceful, complete
    A soft amber ambient glow pulses once every 3s

─── ACT 2: CLONE SECTION (100vh – 200vh) ────────────

Pinned section: height 100vh, pin: true

Left side (40%): sticky content panel
  Section label: "01 / CLONE" in Inter 600 11px amber uppercase
  Headline: "Any public GitHub repo." in Syne 900
    clamp(40px, 5vw, 72px)
  Body: "Paste a URL. GitMind shallow-clones it in seconds —
    only the latest commit, no history bloat."
  SplitText word reveal: words animate in as scroll progresses
  Each word: y:24→0 opacity:0→1 blur:8px→0, staggered by word

Right side (60%): ANIMATED TERMINAL
  Fake terminal window — glass panel, border-radius 12px
  Glass bg: rgba(15,11,24,0.85) backdrop-blur(20px)
  Title bar: 3 dots (red/yellow/green) + "bash" label
  Terminal text types out as scroll progresses:
    $ git clone --depth 1 https://github.com/user/repo
    Cloning into 'repo'...
    remote: Enumerating objects: 847
    remote: Counting objects: 100% (847/847)
    ✓ Cloned in 4.2s — 847 files indexed
  Each line appears character by character (typewriter)
  tied to scroll progress (not time-based)
  Cursor: blinking block | at end of current line
  Lines: JetBrains Mono 13px, --teal-bright color for success,
  --w2 for regular, --amber for the $ prompt

─── ACT 3: SCAN SECTION (200vh – 300vh) ─────────────

Pinned section: height 100vh

Split screen: Left = file tree visualization, Right = copy

LEFT: Animated SVG file tree
  SVG paths DRAW themselves as scroll progresses
  (stroke-dashoffset animation tied to ScrollTrigger progress)
  Files appear as nodes: small squares + filename labels
  Folders: larger squares with expand indicator
  Language color dots: py=amber, js=teal, md=gold etc
  Lines connecting nodes draw in with DrawSVG technique
  (simulate: strokeDashoffset from total-length to 0)

RIGHT: Section copy
  Label: "02 / SCAN"
  Headline: "Every file. Every line."
  Body: "30+ source extensions. Binary detection.
    Vendor dirs skipped. Clean signal only."
  Stats cascade in on scroll:
    "30+" extensions → counter counts up
    "350KB" limit → slides in from right
    "<1s" scan time → fades up

─── ACT 4: EMBED SECTION (300vh – 400vh) ────────────

Full-width section, NOT pinned (normal scroll)

Background: changes here to a slightly lighter --surface
  creating a visual "chapter break"

VECTOR SPACE VISUALIZATION:
  2D scatter plot rendered on Canvas element (not Three.js)
  300 small dots, positioned randomly initially
  As section enters viewport (IntersectionObserver):
    Dots animate into CLUSTERS (6-8 clusters)
    Each cluster is a different "topic" — files about auth,
    files about API, files about UI etc
    Dots move with CSS transitions (each has random delay 0-800ms)
    Cluster centers are labeled with floating text pills:
      "authentication", "indexing", "vector store" etc
  Color: amber dots, teal cluster label pills
  Canvas size: full section width, 400px height

COPY alongside:
  Label: "03 / EMBED"
  Headline: "384 dimensions of understanding."
  Sub: "Local sentence-transformers model.
    Zero external API calls during indexing.
    Your code never leaves your machine."
  Three feature lines with amber checkmarks, stagger in

─── ACT 5: ANSWER SECTION (400vh – 500vh) ───────────

Pinned section. The CENTREPIECE of the page.

This section demonstrates the actual product working.

Layout: full viewport, centered

ANIMATED CHAT DEMO (not static screenshot — actually animates):
  A glass chat interface appears in center (600px wide, 400px tall)
  Glass: rgba(15,11,24,0.90) backdrop-blur(32px)
  Border: 1px solid rgba(249,115,22,0.2)
  Border-radius: 20px
  Box-shadow: 0 32px 80px rgba(0,0,0,0.6),
    inset 0 0 0 1px rgba(255,255,255,0.05)

  As scroll enters this section:
  Step 1 (scroll 0-25%): User message types in:
    "How does the authentication middleware work?"
    Characters appear one by one (typewriter, 40ms per char)
    Message bubble: right-aligned, amber tint background

  Step 2 (scroll 25-50%): "Thinking" indicator
    Three amber dots pulse in sequence (CSS animation)
    Label: "GitMind is analyzing 12 relevant chunks..."

  Step 3 (scroll 50-90%): AI response streams in word by word:
    "The auth middleware lives in middleware/auth.py.
    It intercepts every request, extracts the JWT from
    the Authorization header, and validates it against
    the secret in config.py using PyJWT's decode() method.
    If validation fails, it returns HTTP 401 immediately."
    Words appear with opacity 0→1 + blur 4px→0, staggered 80ms

  Step 4 (scroll 90-100%): Citations slide up from bottom:
    Two glass chips: "middleware/auth.py:34-52"
    and "config.py:18" animate up with spring ease

SURROUNDING ATMOSPHERE:
  Behind the chat card: radial amber glow
  (radial-gradient centered, amber 0% opacity 0.12, void 70%)
  Subtle orbiting particles (8 tiny dots orbit the card,
  CSS animation: rotate 20s linear infinite around card center)

─── ACT 6: FEATURES BENTO (500vh – 600vh) ───────────

Normal scroll section (not pinned)

BENTO GRID — asymmetric, award-winning layout:
  CSS Grid:
    grid-template-columns: repeat(12, 1fr)
    grid-template-rows: auto
  Cards:

  Card A (cols 1-7, row 1): "Lightning Fast Indexing"
    Spans most of first row. Has animated bar chart inside:
    5 bars representing indexing stages, each fills
    left→right in sequence on loop (CSS animation)
    Colors: amber bars, teal success state
    Large: clamp(28px, 3vw, 42px) headline
    Icon: lightning bolt SVG, amber stroke

  Card B (cols 8-12, row 1): "Local Embeddings"
    Taller card. Neural network node diagram SVG
    (static nodes, edges animate strokeDashoffset in loop)
    Text: "all-MiniLM-L6-v2 · 384 dims · ~80MB · CPU"
    in JetBrains Mono, teal color

  Card C (cols 1-4, row 2): "800+ tok/s"
    Large number in Syne 900 clamp(56px, 6vw, 96px)
    Amber gradient text
    Below: "via Groq LLaMA 3.3 70B" in --w3

  Card D (cols 5-8, row 2): "Source Citations"
    Two fake citation chips stacked:
    "auth.py:34-52" and "config.py:18"
    with a connecting line between them
    Chips animate in on scroll with spring

  Card E (cols 9-12, row 2): "100% Local"
    Lock icon SVG (amber) centered
    Text: "Embeddings never leave your machine"
    Background slightly different: --surface

ALL CARDS:
  Background: rgba(15,11,24,0.80) backdrop-blur(20px)
  Border: 1px solid rgba(249,115,22,0.10)
  Border-radius: 16px
  Padding: 28px
  On scroll enter: translateY(40px) opacity(0) →
    translateY(0) opacity(1), staggered 100ms
  On hover: border brightens rgba(249,115,22,0.28),
    translateY(-4px), box-shadow deepens
  3D tilt on mousemove: perspective(800px)
    rotateX(±6deg) rotateY(±8deg), max tilt

─── ACT 7: CTA SECTION (600vh – 700vh) ──────────────

Full viewport height, centered

LARGE KINETIC HEADLINE:
  "Ready to understand any codebase?"
  Syne 900, clamp(48px, 7vw, 96px), --w1
  Each word on its own line
  As section enters: words slide in from alternating
  left/right (odd words: x:-80→0, even words: x:80→0)
  opacity 0→1, stagger 200ms, ease power3.out

SUBTEXT: Inter 400, --w3, max-width 480px, centered

CTA CLUSTER:
  Primary: "Launch GitMind →"
    Large button, amber gradient, grain texture overlay
    Padding: 18px 48px, border-radius: 14px
    On hover: glow expands + lifts 4px
  Secondary: "View on GitHub ↗"
    Text link, --w3 → --w1 on hover, underline animates in

AMBIENT EFFECT:
  Two large radial gradients (CSS, not Three.js):
    Left: amber, 400px radius, opacity 0.06, position -200px 50%
    Right: teal, 300px radius, opacity 0.04, position right+100 50%
  These create a subtle warm glow framing the CTA

FOOTER:
  Minimal: Logo + "GitMind Pro" + nav links + GitHub link
  Background: --void
  Border-top: 1px solid rgba(249,115,22,0.06)
  Text: --w4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  APP PAGE — MISSION CONTROL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Three-column layout:
  [Sidebar 260px fixed] [Main flex-grow] [detail on demand]

SIDEBAR:
  Background: rgba(7,5,14,0.97)
  Right border: 1px solid rgba(249,115,22,0.07)
  
  Top: Logo (28px) + "GitMind" Syne 700 18px
  Section header: "REPOSITORIES" Inter 600 10px amber
    letter-spacing 0.15em, margin-top 24px
  
  Repo list items:
    Active: left border 2px solid amber,
      background rgba(249,115,22,0.07),
      repo name --w1 Inter 500 14px
    Inactive: --w3, no border, hover fades in
    Status dot: 6px circle, pulsing amber CSS animation
    File count: --w4 Inter 400 11px below name
    Enter animation: x:-20→0 opacity:0→1 stagger 80ms on load
  
  Bottom: "+ Index New Repo" button
    Dashed border: 1px dashed rgba(249,115,22,0.25)
    Full width, glass bg, border-radius 10px
    On hover: border solid, amber glow 0 0 20px rgba(249,115,22,0.1)

TOP BAR:
  Glass: rgba(7,5,14,0.85) backdrop-blur(20px)
  Border-bottom: 1px solid rgba(249,115,22,0.07)
  Height: 52px
  
  Left: Breadcrumb "GitMind / {repo} / Chat"
    "/" separators in --amber, Inter 400 13px
    Repo name animates in when changed: x:-8→0 opacity:0→1
  
  Right: Model chip "LLaMA 3.3 70B"
    Glass pill, teal border rgba(13,148,136,0.3)
    + EQ visualizer: 5 vertical bars, 14px tall max,
    each independently animates height 4px↔14px
    random intervals 300-800ms, amber color
    Purely decorative, label "Neural Activity" --w4 10px

CHAT VIEW:
  Background: --void
  Subtle radial teal gradient bottom-center:
    radial-gradient(ellipse 60% 40% at 50% 100%,
    rgba(13,148,136,0.06) 0%, transparent 100%)

  USER MESSAGES:
    Right-aligned, max-width 65%
    Background: rgba(249,115,22,0.08)
    Border: 1px solid rgba(249,115,22,0.20)
    Border-radius: 18px 4px 18px 18px
    Padding: 12px 16px
    Left accent: 2px solid --amber (inside border-left)
    Inter 14px --w1
    Animate in: x:20→0 opacity:0→1 duration 300ms

  ASSISTANT MESSAGES:
    Full width card
    Background: rgba(15,11,24,0.85)
    Border: 1px solid rgba(255,255,255,0.06)
    Left accent: 3px solid --teal
    Border-radius: 4px 18px 18px 18px
    Padding: 16px 20px
    Streaming: text appears word by word
    Cursor: | blinks at end of streaming text
    Code blocks: JetBrains Mono 12px, darker bg,
      amber line numbers, teal syntax highlight key terms
    Animate in: y:16→0 opacity:0→1 duration 400ms

  CITATIONS:
    After assistant message completes:
    Glass chips slide up: y:12→0 opacity:0→1
    staggered 60ms each
    Chip: "file.py:34-52" JetBrains Mono 11px
    Background: rgba(13,148,136,0.10)
    Border: 1px solid rgba(45,212,191,0.20)
    Border-radius: 6px, padding 4px 10px
    On hover: expand height to show 2-line code preview
    with blur overlay transition

  EMPTY STATE:
    Center: pulsing teal orb (120px)
    CSS radial-gradient + animation: pulse-breathe 3s infinite
    box-shadow: 0 0 60px rgba(13,148,136,0.3)
    Below: "Ask anything about {repo name}" --w3 Inter 16px
    5 suggestion chips in horizontal row below orb:
      each: glass pill, on hover border brightens + lift
      on click: fills input with spring animation

  INPUT AREA:
    Glass panel: rgba(7,5,14,0.95) backdrop-blur(20px)
    Border-top: 1px solid rgba(249,115,22,0.08)
    Padding: 16px 24px
    
    Input field: full-width, no default border
    Background: rgba(15,11,24,0.70)
    Border: 1px solid rgba(255,255,255,0.06)
    Border-radius: 12px, padding 12px 16px
    On focus: border shifts to rgba(249,115,22,0.35)
    + amber box-shadow 0 0 0 3px rgba(249,115,22,0.08)
    Scanning border animation on focus:
      pseudo-element travels clockwise around field perimeter
      using CSS @keyframes and clip-path progression
    
    Send button: 40px circle, amber gradient
    On loading: transforms to circular progress ring
    On hover: scale(1.08) + glow

INDEX MODAL — FULLSCREEN TAKEOVER:
  Phase 1 (input):
    Centered glass card, 480px wide
    Frosted: backdrop-blur(40px) rgba(15,11,24,0.92)
    Border: 1px solid rgba(249,115,22,0.20)
    Border-radius: 20px
    Box-shadow: 0 40px 100px rgba(0,0,0,0.7)
    
    Title: "Index a Repository" Syne 700 24px
    URL input with scanning border animation
    Submit: full-width amber gradient button

  Phase 2 (indexing — FULLSCREEN):
    Modal expands with clip-path animation:
    inset(50% 50% 50% 50%) → inset(0% 0% 0% 0%)
    Duration 600ms, ease power3.inOut
    
    LEFT HALF: Terminal log view
    Monospace 13px, lines appear one by one
    Color coding: amber=cloning, --w2=scanning,
    teal=embedding, gold=complete
    
    RIGHT HALF: Mini Three.js scene (separate canvas)
    Changes per stage:
      Cloning: git branch tree growing (Line objects)
      Scanning: file cubes appearing (scale 0→1 staggered)
      Embedding: cubes fly to cluster (lerp animation)
      Complete: golden particle burst, then peaceful orbit
    
    Progress bar: thin amber line, bottom of screen
    Fills left→right tied to SSE percent events
    Number: odometer style counter, JetBrains Mono

REPO OVERVIEW:
  Stats cards: 2×2 grid, glassmorphism
  Large icon (SVG amber), number Syne 900, label --w3
  Count-up on enter, 3D tilt on hover
  
  Language bar: pills growing from left, staggered 80ms
  Each pill height proportional to %, hover tooltip
  
  File tree: indented with folder icons
  Folder expand/collapse with height animation
  Active file: amber left border

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PAGE TRANSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Route change (/ → /app):
  Full-screen amber overlay sweeps:
  clip-path: inset(0 100% 0 0) → inset(0 0 0 0) [300ms]
  Then: inset(0 0 0 0) → inset(0 0% 0 100%) [300ms]
  Fixed div, z-index 9999, amber gradient
  Implement with React Router + useNavigate +
  a TransitionOverlay component that mounts/unmounts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IMPLEMENTATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Read ALL existing files first. Touch zero API/SSE/routing logic.
   Only visual layer: CSS, JSX structure, Three.js, animations.

2. Implement in this EXACT order (one file at a time):
   Step 1: index.html (add GSAP CDN scripts)
   Step 2: index.css (full token system, grain, cursor CSS)
   Step 3: main.jsx (GSAP register, ScrollSmoother init)
   Step 4: Cursor.jsx (new component, add to App.jsx)
   Step 5: ThreeBackground.jsx (codebase universe scene)
   Step 6: LandingPage.jsx (complete scroll story)
   Step 7: AppPage.jsx (mission control layout)
   Step 8: ChatView.jsx (new message design)
   Step 9: IndexModal component (fullscreen takeover)
   Step 10: RepoOverview.jsx (enhanced overview)
   Step 11: TransitionOverlay.jsx (page transitions)

3. After completing EACH step: tell me exactly what changed,
   what file, and flag any issues before moving to next step.
   Do not skip ahead. Wait for confirmation.

4. GSAP in React: always use useLayoutEffect not useEffect
   for GSAP animations. Always return ctx.revert() in cleanup.
   Use gsap.context() to scope all animations.

5. Three.js cleanup: every scene useEffect returns cleanup:
   renderer.dispose(), all geometries, all materials,
   renderer.domElement.remove(), cancelAnimationFrame

6. prefers-reduced-motion:
   CSS: @media (prefers-reduced-motion: reduce)
   JS: if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
   { skip all GSAP animations, show static state }

7. Mobile < 768px:
   Disable Three.js (CSS gradient fallback)
   Disable ScrollSmoother
   Simplify to opacity/translate only
   Sidebar → bottom tab bar

8. NO new npm packages. GSAP via CDN only.
   Access via window.gsap, window.ScrollTrigger etc.
   Or: import gsap from 'gsap' if already in package.json.
   Check package.json first.

9. Performance targets:
   60fps scroll animations
   Batch ScrollTrigger instances
   Use gsap.quickSetter for cursor
   Three.js: max 300 objects total in scene

START NOW. Begin with:
ls frontend/src/ and read EVERY file completely.
Then implement Step 1 (index.html GSAP scripts) immediately.
Tell me when Step 1 is done before doing Step 2.