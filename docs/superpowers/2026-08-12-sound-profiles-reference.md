# COLDSNAP sound profiles — acoustics reference and retune spec

Date: 2026-08-12
Scope: the muster bell, the sniper, the rifle, the machine gun, the wind bed.
Source module: `src/platform/audio.js` (read in full; 505 lines).
Status: reference only. No code was changed.

---

# PART ONE — plain language, for Jeff

## The short version

Four of the five sounds fail for the same two reasons, and the reasons are measurable.

1. **We put almost all of our sound energy where the ear is least sensitive, or where it is
   least informative.** The bell lives in the deep basement. The guns live way up in the
   whistle register. Neither of those is where the real thing lives.
2. **The bell's ringing voice is built out of a filter so narrow that almost no sound gets
   through it.** The number `0.40` in the code looks like a healthy volume. Measured, the
   bell's ringing part comes out roughly twelve times quieter than a single sniper crack.
   A pebble knocking against stone in our own game is louder than the muster bell.

Everything below is the detail, one sound at a time.

## The bell

**What a real big bell does.** A bronze bell does not make one note. It makes a stack of
five to eight distinct tones at once, and bell founders have tuned them to fixed ratios for
centuries: a deep *hum*, an octave above it the *prime*, then the *tierce* (a minor third
up — that is why bells sound sad), the *quint*, and the *nominal*. Above those sit two more,
the *superquint* and the *octave nominal*.

Here is the part that matters. **The note you think you hear from a bell is not actually
present in the sound.** Your ear invents it, from the top three tones — nominal, superquint,
octave nominal — which sit in an almost-perfect musical relationship, and your hearing fills
in the missing bottom note an octave below the nominal. This is published, replicated,
tested on live listeners. It also has a catch: it only works reliably when the nominal sits
in roughly the 500–1500 Hz window. Below that, the effect weakens.

And the loudness ordering of a real bell is the opposite of what you'd guess. When a clapper
or hammer hits the thick rim (the soundbow), it is the *upper* tones that get slammed —
tierce, nominal, superquint, octave nominal. The tierce is often the loudest single component
of the whole bell. The deep hum is *there*, and it rings the longest, but it is not what
makes the bell loud, and it is not what makes the bell readable as a bell.

So: a bell is **deep because of its long, slow tail and its lowest tone, but audible because
of its bright middle**. We built only the deep half.

**What ours does.** Five tones at 94 / 188 / 226 / 282 / 376 Hz — correct ratios, correct
names, but the whole set is pitched an octave and a half below where the ear does its
strike-note work, the top two tones the ear needs are simply absent, and the volume ordering
is upside down: our loudest component is the hum and our quietest is the nominal. Exactly
backwards from the literature.

Worse, our bell isn't really ringing. It's a hiss squeezed through five extremely narrow
filters. At the hum, that filter is about one and a half hertz wide. Almost nothing gets
through a gap that narrow, which is why the measured output is so small. On top of that,
every toll randomly detunes each tone by up to about one and a third semitones — so even the
tone relationships that generate the strike note are scrambled on every strike.

There is no strike at all, either. A real bell starts with a hammer blow: a hard, bright,
broadband smack, then the tones emerge from under it. Ours fades in over three milliseconds
of the same narrow hiss it will sustain for five seconds. Nothing announces it.

Finally, three practical killers:
- The 62 Hz sine we lay underneath — which is currently carrying almost all of the bell's
  actual audible weight — is *below* what open-fit earbuds reproduce properly. On AirPods
  you lose the one part that was working.
- The compressor that protects the mix is set so that any explosion or burst of fire ducks
  everything else for a quarter of a second, over and over, for the whole five seconds the
  bell is trying to ring.
- There is a hard cap of 26 simultaneous sounds. A single machine-gun burst can claim up to
  seventeen of them. If the bell tolls during a firefight, **it can be silently dropped
  entirely** — not quiet, not buried: never played.

**What it should be.** Move the whole tone stack up so the nominal lands around 500 Hz,
which puts the hum at 125 Hz — still a very big bell, roughly a three-tonne bourdon. Add the
two missing upper tones. Flip the loudness ordering: tierce loudest, nominal and the two
above it strong, hum present but not dominant, quint almost silent. Put a real hammer strike
on the front — a short, bright, broadband knock. Stop the random detuning: bells are tuned
instruments and the ear resolves tuning to about a tenth of a semitone. Let the long tail
carry the deep hum, so it still reads as heavy, and let the bright middle carry the *arrival*,
so it reads as loud. Give the bell priority over the voice cap and duck other sound under it
rather than letting the compressor duck it.

Measured against our own current bell, just fixing the tone content — same volume number —
gets about thirteen decibels more perceived loudness out of it. That is the difference
between "did something happen?" and "the bell rang."

## The sniper, the rifle, the machine gun

**What real gunfire does.** A gunshot is two separate events. The **muzzle blast** is the
gas explosion at the barrel; it lasts under five milliseconds, it is loud, and forensic
acoustics puts its energy peak for small arms **between 500 and 1000 Hz**. The **crack** is
the shockwave from a supersonic bullet; it lasts under a third of a millisecond and its
energy sits *above* 2000 Hz.

The blast is the body of the sound. The crack is the edge on it. You only get the crack at
all if you are near the bullet's path.

**What ours does.** All three of our guns are crack and nothing else. The rifle is a hiss
above 3300 Hz for 26 milliseconds. The sniper is a hiss above 2200 Hz for 32 milliseconds.
The machine gun is a hiss above 2000 Hz, ten of them in a row. We have essentially deleted
the muzzle blast — the part that is 500–1000 Hz, the part that is the *shot* — and kept only
the whip. That is why all three sound alike: they are the same thin white noise with the
corner moved slightly, and a shifted corner on a hiss is a very weak distinguishing cue.
Meanwhile the thing that would actually separate them — the size and pitch of the blast body —
isn't there to differ.

Two more things the literature gives us for free that we're not using. Gunfire is
**directional**: most of the energy goes where the barrel is pointing, and a shot pointed
away measures visibly quieter. And every shot outdoors arrives **twice**, the second time a
millisecond or two later off the ground — which is a real part of the texture of a shot
across open ground.

**What they should be.** Give every gun a blast body centred in the 500–1000 Hz region and
make *that* the loudest part of the shot. Then separate the three by what the blast does:
heavy rifle = lower and longer blast; light rifle = higher and shorter; machine gun = the
same light blast repeated at its firing rate, and the rate is its identity. Keep the
high crack, but as an edge on top, not as the whole sound, and only give the full crack to
shots whose path passes near the listener. Add the ground bounce.

## The wind

**What real wind does.** Two findings dominate. First, wind noise is **broadband and falls
off steadily with pitch** — it is not a band, it is a slope, heaviest down low and thinning
as it goes up. Second, and this is the whole problem with ours: **wind's loudness wanders on
every timescale at once**, with the biggest swings the slowest. The published characterisation
puts the broad peak of that wandering below a hundredth of a hertz — minutes-long surges —
with a continuous spread of faster fluctuation on top of it. On top of that, wind makes
*tones* when it passes an obstacle (a wire, a post, an edge), and it makes distinct sounds in
vegetation: branches knocking is low, leaves rustling is high.

**What ours does.** One noise band between 240 and 380 Hz, volume swinging by about a quarter
either way, once every forty-eight seconds. That is, to a listener, a constant. There is no
low rumble, no high hiss, no surge, no whistle. A fixed band of noise with an imperceptibly
slow wobble is the textbook definition of static, and that is what Jeff heard.

**What it should be.** Replace the band with a slope — real bass weight, thinning upward,
still present up top. Replace the single slow wobble with layered random drift: a slow surge
over tens of seconds, a medium gust over a few seconds, and fast flutter, all summed, so it
never repeats. Let the fast layer push the brightness as well as the volume — gusts get
hissier, not just louder. And when the wind is up, let structures on the map sing a thin
whistle whose pitch tracks wind speed.

## The AirPods question

I could not find a frequency-response measurement of standard AirPods from a source that
meets our research standard, and I am not going to make one up. What *is* established is the
mechanism: an earpiece that does not seal loses low frequencies out of the gap, and the
published characterisation of that leakage puts its effect mainly below about 800 Hz. So the
direction is certain — Jeff's AirPods are throwing away exactly the region we put the bell
in — but the exact number of decibels lost at 94 Hz is not something I can cite. Treat this
as: **anything we need heard should not depend on content below ~150 Hz.** That conclusion
holds on the equal-loudness data alone, without needing the headphone measurement.

---

# PART TWO — technical, for the retune agent

## 0. Read this first

Everything below is traceable. Each number is one of:
- **[CITED]** — taken directly from a published authority (full list at the end).
- **[DERIVED]** — computed by me from a cited source, with the computation shown.
- **[DESIGN]** — a choice, made to satisfy a cited constraint, marked as a choice.
- **[MEASURED]** — obtained by numerically simulating the shipped code (noise buffer
  regenerated per `audio.js` lines 40–44; biquads implemented per the W3C Web Audio
  `BiquadFilterNode` coefficient formulas; envelope per the shipped `setTargetAtTime` shape).

Gaps are marked **[GAP]** and are not to be filled by guessing.

## 1. Equal loudness — the master correction

Source: ISO 226:2003, Equation (1) and normative Table 1 (α_f, L_U, T_f). I recovered
Table 1 and Equation (1) from the standard's own published sample and evaluated the contour
directly. **[CITED]** for the tabulated one-third-octave frequencies; **[DERIVED]** (log
interpolation of α_f, L_U, T_f between tabulated points) for the off-grid frequencies, marked
with `*`.

Sound pressure level (dB) required for equal loudness:

| f (Hz) | 40 phon | 60 phon | 80 phon | Δ vs 3150 Hz @60 phon |
|---:|---:|---:|---:|---:|
| 63    | 73.1 | 85.9 | 98.4 | **+29.5** |
| 80    | 68.5 | 82.1 | 95.2 | **+25.6** |
| 94*   | 65.5 | 79.6 | 93.2 | **+23.2** |
| 100   | 64.4 | 78.7 | 92.5 | +22.2 |
| 125   | 60.6 | 75.6 | 90.1 | +19.1 |
| 150*  | 57.7 | 73.3 | 88.4 | +16.9 |
| 188*  | 54.3 | 70.6 | 86.4 | +14.2 |
| 200   | 53.4 | 69.9 | 85.9 | +13.4 |
| 226*  | 51.8 | 68.6 | 85.0 | +12.2 |
| 250   | 50.4 | 67.5 | 84.3 | +11.1 |
| 282*  | 48.9 | 66.4 | 83.6 | +10.0 |
| 315   | 47.6 | 65.4 | 82.9 | +9.0 |
| 376*  | 45.7 | 64.0 | 82.0 | +7.5 |
| 400   | 45.0 | 63.5 | 81.7 | +7.0 |
| 500   | 43.1 | 62.1 | 80.9 | +5.6 |
| 620*  | 41.5 | 60.9 | 80.2 | +4.5 |
| 700*  | 40.8 | 60.4 | 80.0 | +4.0 |
| 1000  | 40.0 | 60.0 | 80.0 | +3.6 |
| 2000  | 39.2 | 60.0 | 80.6 | +3.5 |
| 2200* | 38.1 | 58.8 | 79.4 | +2.4 |
| 3150  | 35.6 | 56.4 | 77.1 | 0.0 |
| 3300* | 35.8 | 56.6 | 77.3 | +0.2 |

**The operative numbers.** At 60 phon (moderate headphone listening), content at 94 Hz needs
**+23.2 dB** more SPL than content at 3150 Hz to be equally loud. At 40 phon (quiet
listening) that penalty grows to **+29.9 dB**. The bell's whole partial set (94–376 Hz)
carries a penalty of **+7.5 to +23.2 dB at 60 phon**; the guns' snaps (2000–3300 Hz) carry
a penalty of **+0.2 to +3.5 dB**.

Note also the contour flattening with level: the 94 Hz penalty falls from +29.9 dB at
40 phon to +23.2 at 60 and +16.2 at 80. **Consequence:** the bell's audibility is
strongly level-dependent — it will disappear first for a quiet listener. **[DERIVED]**

Use this table as a **loudness-correction curve** when setting relative gains: to make a
component at frequency f as loud as a reference component at 1 kHz, its electrical level must
be raised by (Lp(f) − Lp(1000)) at the target phon level.

## 2. Bell

### 2.1 Published profile

**Partial names, orders and tuned ratios.** Bell founders tune the musical modes to
approximate ratios **1 : 2 : 2.4 : 3 : 4** (hum, prime/fundamental, tierce, quint, nominal).
**[CITED — Whyte, Perrin & Halkon 2024]**

**Measured partials of a real bell.** Taylor bell, 214 kg (rim diameter 702 mm, height
566 mm), experimental frequencies: hum 293 Hz (m=2,n=0); fundamental/prime 586 Hz;
tierce 693 Hz; quint 883 Hz; nominal 1172 Hz; superquint 1764 Hz. **[CITED — Whyte, Perrin &
Halkon 2024, Table 1, after Perrin, Charnley & DePont 1983]**
Ratios to hum: 1 : 2.000 : 2.365 : 3.014 : 4.000 : **6.020**. **[DERIVED]**

**Upper partial names and ratios to the nominal:** superquint ≈ a fifth above the nominal
(≈1.5×), octave nominal ≈ an octave above (≈2×), then I-7, I-8, I-9. **[CITED — Hibbert,
"Identifying bell partials"; consistent with the 6.020 measurement above]**

**Strike note / virtual pitch.** "The dominant pitch sensation of a bell, commonly termed the
strike pitch, is a virtual pitch sensation generated in the human auditory system by a set of
partials with an approximate harmonic relationship. The strike pitch of a bell is roughly an
octave below the RIR partial m = 4 (the nominal) **provided that the nominal lies broadly in
the range 500 Hz to 1500 Hz**. The m = 4, m = 5, m = 6 and higher RIR partials have
frequencies which are approximately harmonically related giving rise to the virtual pitch.
**If the nominal is lower than 500 Hz**, for some listeners a secondary strike note is heard
based on the m = 7, m = 9 and m = 11 partials." **[CITED — Hibbert, Sharp, Taherzadeh &
Perrin 2014, Open Journal of Acoustics 4:70–77]** (Study base: 2752 bells.)

The virtual pitch is not physically present in the signal. **[CITED — Hibbert, "The musical
sound quality of church bells"]**

**Relative amplitudes.** The rim partials other than the hum (tierce, nominal, superquint,
octave nominal, I-7, I-8) are maximally stimulated at or near the rim, which accounts for
their prominence when a bell is struck at the soundbow. The **tierce is often the highest
amplitude partial**. The **quint is typically a very quiet partial**, having a node near the
soundbow. **[CITED — Hibbert, "Identifying bell partials"; "The musical sound quality of
church bells"]**

Partial amplitude differences have only a minor effect on which strike pitch is heard —
i.e. the *frequency relationships* carry the identity, not the balance. **[CITED — Hibbert]**

**Damping / decay.** Measured modal Q factors on a real bell: **624 Hz Q=1300, 981 Hz Q=1000,
1310 Hz Q=2000**; a single-struck bell shows clean exponential decay for each strongly
excited mode. **[CITED — Woodhouse, Rene & Mason 2012, *Advances in Acoustics and Vibration*
2012:681787]**
Converting with T60 = 2.2·Q/f (from the definition of Q): **624 Hz → 4.6 s; 981 Hz → 2.2 s;
1310 Hz → 3.4 s.** **[DERIVED]**

**Strike transient.** For a swung bell the clapper does not deliver one impact but a
decreasing series of bounces, and each impact redistributes energy across the spectrum,
increasing the overall decay rate; a cleanly chimed (single-impact) strike gives "a much
longer and cleaner decay." **[CITED — Woodhouse et al. 2012]** A muster bell is chimed, so
model a **single clean impact**.

**Tuning precision.** Listener pitch resolution is about **10 cents**. **[CITED — Hibbert,
30-subject test]**

**Size scaling.** For geometrically similar bells, modal frequency ∝ 1/(linear size) and mass
∝ (linear size)³, so f ∝ mass^(−1/3). From the 214 kg / nominal-1172 Hz datum: a bell with
nominal 500 Hz has mass ≈ 214 × (1172/500)³ ≈ **2.75 tonnes**; with nominal 376 Hz (our
current bell), ≈ **6.5 tonnes**. **[DERIVED]**

### 2.2 What ours actually does — mechanical audit

Current voice (`audio.js` L265–279):
```
BELL_MODES = [94/Q62/g1.0, 188/Q78/g0.9, 226/Q82/g0.5, 282/Q74/g0.28, 376/Q66/g0.16]
bellToll: modal(..., BELL_MODES, dur 5.2, gain 0.40, wet 0.55)
        + tone(f0 62 -> f1 38, dur 3.4, gain 0.14, atk 0.02)
```

**(a) `modal()` is not a resonator.** `modal()` (L131–152) connects a *continuously looping*
noise buffer through parallel bandpass biquads and shapes the sum with a gain envelope. The
`Q` therefore sets only a filter **bandwidth**, never a ring time. Web Audio's bandpass
`alpha = sin(w0)/(2Q)` ⇒ −3 dB bandwidth = f/Q:

| mode | f (Hz) | Q | bandwidth (Hz) |
|---|---:|---:|---:|
| hum | 94 | 62 | **1.52** |
| prime | 188 | 78 | 2.41 |
| tierce | 226 | 82 | 2.76 |
| quint | 282 | 74 | 3.81 |
| nominal | 376 | 66 | 5.70 |
| (stoneKnock, for scale) | 840 | 20 | 42.0 |

Noise power passed by a bandpass is proportional to its bandwidth. The bell's five modes
together pass a **16.2 Hz** slice of the noise spectrum; `stoneKnock`'s three modes pass
**~121 Hz**. **[DERIVED]**

**(b) Measured output.** Simulating the shipped code and measuring the first 50 ms —
weighted by the ISO 226 60-phon curve from §1, so the figure is a perceived-level proxy
**[MEASURED, metric is DESIGN]**:

| voice | loudness-weighted onset level | peak sample |
|---|---:|---:|
| **BELL modal (as shipped)** | **−25.8 dB** | 0.0074 |
| BELL 62→38 Hz sine tail | −15.1 dB | 0.1400 |
| BELL total | −14.6 dB | 0.1457 |
| SNIPER snap (hp 2200, g 0.19) | **−13.6 dB** | 0.0797 |
| RIFLE snap (hp 3300, g 0.115) | −21.2 dB | 0.0491 |
| MG single tap (hp 2000, g 0.105) | −23.4 dB | 0.0445 |
| `stoneKnock` modal (g 0.20) | −19.3 dB | 0.0118 |

**Findings.**
- The bell's *ringing* voice is **12.2 dB below a single sniper crack** and **6.5 dB below a
  falling-rubble stone knock**, despite carrying the largest gain constant in the file.
- Almost all of the bell's audible weight comes from the **62→38 Hz sine**, not from the
  modal partials at all — i.e. the bell we ship is a sub-bass thud with an inaudible
  ringing decoration, which is precisely the content an unsealed earbud discards.
- Substituting a literature-shaped partial set (see §2.3) at the **same 0.40 gain** measures
  **−12.4 dB** — **+13.4 dB** over the shipped modal voice, with no gain increase.
  **[MEASURED]**

**(c) Per-toll random detuning.** `modal()` applies `vary(m.f, 0.08)` — ±8% per mode per
strike = **±133 cents** (1200·log₂1.08). **[DERIVED]** Listener pitch resolution is 10 cents
**[CITED]**, and the strike note depends on the *ratios* between partials. The detuning
destroys the tuned relationships on every toll.

**(d) No strike transient.** The envelope is a 3 ms linear ramp on the same narrowband noise
that sustains. There is no broadband impact content whatsoever.

**(e) Tail truncation.** The envelope is `setTargetAtTime(0.0001, t0+0.003, dur/3.2)`, and
the source is stopped at `t0 + dur + 0.1`. At the stop instant the envelope is
e^(−5.297/1.625) = 0.038 ⇒ **the 5.2 s bell is hard-cut while still 28 dB below its peak**;
the 3.4 s sine is cut at −26 dB. **[DERIVED]** Both are above audibility at cut.

**(f) Master chain ducks it.** `comp` (L36–37): DynamicsCompressorNode, threshold −18 dB,
ratio 6, knee 12 ⇒ soft knee spanning −24…−12 dBFS. Web Audio spec defaults apply for the
unset params: **attack 0.003 s, release 0.25 s.** **[CITED — W3C Web Audio API,
DynamicsCompressorNode defaults]** With `master.gain = 0.8`, the bell's peak lands at about
−18.6 dBFS — i.e. **exactly on the knee**, so the bell is being compressed by its own peak,
and every explosion or burst during its 5.2 s tail pulls it down again with a 250 ms recovery.

**(g) The bell can be dropped outright.** `VOICE_CAP = 26` (L27); `noise()`, `tone()` and
`modal()` each return silently when `voices >= VOICE_CAP`. One `WEAPON.mg` burst allocates
`1 + 2n` voices with `n = clamp(round(mass²), 2, 8)` ⇒ **up to 17 voices from a single
burst**, held for their full scheduled life (taps are delayed up to 7×0.063 = 0.44 s, and
each voice stops at `t0+dur+0.15`). Two concurrent bursts exceed the cap. `bellToll()` has
**no priority and no reservation** — during a firefight it is not quiet, it is *absent*.

### 2.3 Target spec — bell

**Partial set.** Anchor on the **nominal at 500 Hz** so the strike-note mechanism operates in
its published working range (500–1500 Hz) **[CITED constraint; the specific choice of 500 is
DESIGN — it is the lowest nominal that still satisfies the constraint, preserving as much
"huge bell" character as the literature allows]**. Ratios 1 : 2 : 2.4 : 3 : 4 : 6 : 8
**[CITED for 1–4; 6 from the measured superquint ratio 6.020; 8 from the octave-nominal
≈2× nominal]**.

| partial | ratio | f (Hz) | relative gain | rationale |
|---|---:|---:|---:|---|
| hum | 1 | 125 | 0.45 | present, long tail, not dominant **[CITED: not the prominent partial]** |
| prime | 2 | 250 | 0.55 | **[CITED: excited by soundbow strike]** |
| tierce | 2.4 | 300 | **1.00** | **[CITED: often the highest-amplitude partial]** |
| quint | 3 | 375 | 0.12 | **[CITED: typically very quiet — node near soundbow]** |
| nominal | 4 | 500 | 0.90 | strike-note generator **[CITED]** |
| superquint | 6 | 750 | 0.70 | strike-note generator **[CITED]** |
| octave nominal | 8 | 1000 | 0.50 | strike-note generator **[CITED]** |
| I-7 | ~10.3 | ~1290 | 0.22 | rim partial, adds bite **[CITED: exists and is prominent; exact ratio is DESIGN — see GAP-B]** |

**Do not randomise partial frequencies.** Cap any per-toll variation at **±0.3 %** (≈5 cents,
half the 10-cent resolution limit) **[DERIVED from CITED resolution]**. Vary gain and the
strike transient instead.

**Decay per partial — differentiated, not global.** Target T60, from the measured Q values
via T60 = 2.2Q/f **[DERIVED from CITED]**, extended by the standard observation that the
lowest modes ring longest:
- hum 125 Hz: **T60 ≈ 8–10 s** (the "deep" cue lives here) **[DESIGN, extrapolated]**
- tierce/prime: **T60 ≈ 4–5 s** (matches the measured 624 Hz / Q1300 → 4.6 s) **[CITED-anchored]**
- nominal/superquint: **T60 ≈ 2–3.5 s** (matches 981 Hz → 2.2 s, 1310 Hz → 3.4 s) **[CITED]**
- I-7: **T60 ≈ 1–1.5 s** **[DESIGN]**

This requires per-mode envelopes, which `modal()` does not currently support (one shared
envelope). **Either** extend `modal()` with per-mode gain envelopes, **or** implement the
bell as true resonators. Preferred: **true resonators** — excite with a short (≈3–5 ms)
impulse rather than continuous noise, and set biquad Q so the *ringing* produces the decay.
For a resonant filter, Q = 2.2·f·T60/2 … in practice, use the relation **Q = π·f·T60/6.908**
**[DERIVED from the same definition]**: e.g. hum 125 Hz @ T60 9 s ⇒ Q ≈ 512; nominal 500 Hz
@ T60 3 s ⇒ Q ≈ 682. Note these are **an order of magnitude above the shipped Q values** and
are only meaningful if the filter is actually ringing — which is the point.

**Strike transient (currently absent).** Add a single clean impact **[CITED: chimed bell =
single impact]**: broadband noise burst, **3–6 ms**, high-passed around 1.5–2 kHz, at a level
about **6 dB above** the steady partial sum, decaying inside 15 ms. This costs almost nothing
in perceived-loudness terms (it sits where the ear needs ~0 dB correction, §1) and it is what
makes the toll *arrive*.

**Level relationship, loudness-corrected.** Set the bell so that its **loudness-weighted
onset level exceeds a single sniper crack by at least 6 dB** — i.e. target ≈ **−7 dB** on the
§2.2 metric versus the sniper's −13.6 dB. Reaching that from the current −25.8 dB needs
about **+19 dB**, of which **+13.4 dB** comes free from the partial reshaping alone
**[MEASURED]**; the remaining ~6 dB is a gain increase.

**Low sine tail.** Keep it, but drop it to a *support* role and move it up: **80–90 Hz**
rather than 62→38 Hz, at roughly −10 dB relative to the partial sum. Rationale: below ~80 Hz
the equal-loudness penalty exceeds +25 dB at 60 phon **[CITED §1]** and open-fit leakage
removes it entirely **[CITED mechanism, §5]**. Nothing load-bearing may live there.

**Envelope tail.** Extend the source stop to at least **t0 + 4.5·tau** so the cut happens
below −39 dB, or apply an explicit final ramp to zero over the last 200 ms. **[DERIVED]**

**Mix priority.** Reserve voice budget for `bellToll()` (exempt it from `VOICE_CAP`, or
reserve 4 slots), and **duck the rest of the mix under it** rather than letting the shared
compressor duck the bell — e.g. a −4 dB, 200 ms-attack / 1.5 s-release sidechain on the
combat bus, triggered by the toll.

## 3. Gunshots

### 3.1 Published profile

**Two distinct events.** The primary acoustic evidence is the **muzzle blast**, plus the
**projectile shock wave** if the bullet is supersonic, plus (very close in) the mechanical
action. **[CITED — Maher 2007]**

**Durations.** "The shock wave front lasts less than **300 microseconds** and the muzzle
blast lingers for less than **5 milliseconds**." **[CITED — Maher & Shaw 2008]** Elsewhere:
the muzzle blast "typically lasts for less than **3 milliseconds**." **[CITED — Maher 2007]**

**Spectral placement — the key finding.** "the peak spectral energy for small firearms is
**between 500 and 1000 Hz**. The peak energy for a ballistic shockwave is often **above
2000 Hz**." **[CITED — Begault, Beck & Maher 2019, AES Conf. on Audio Forensics, §5.1, citing
Rasmussen, Flamme, Stewart, Meinke & Lankford 2009]**

**Fine structure at the muzzle** (.22 Hornet, Winchester Model 43, measured):
first peak ≈500 Pa (~148 dB SPL peak) as the bullet front exits; ~0.1 ms later a much higher
peak ≈4000 Pa (**166 dB**) from the expanding hot gases; a **secondary peak ≈2000 Pa (160 dB)
repeated after about 0.8 ms**, attributed to reflection of the first pressure pulse inside the
barrel. In front of the rifle, peak ≈32 000 Pa (**184 dB**). At the shooter's head ≈154 dB;
250 mm behind the muzzle ≈166 dB. **[CITED — Rasmussen et al. 2009, *Sound & Vibration*
43(8)]**

**Directionality.** "the majority of the acoustic energy is expelled in the direction the gun
barrel is pointing"; with the muzzle pointed away from the microphones "the muzzle signature
is of lesser amplitude." **[CITED — Maher 2007]**

**Ground reflection.** Both the shock wave and the muzzle blast arrive a second time off the
ground, at slightly lower amplitude "due to the ground absorption and the longer propagation
path." At 9 m range with mics 1.6 m up, the whole event — direct shock, shock reflection,
blast, blast reflection — spans just **10 ms**. **[CITED — Maher 2007; Maher & Shaw 2008]**

**Distance.** "As the distance down range increases, the spherical energy spreading of the
muzzle blast reduces its level in comparison to the shock wave projected by the supersonic
bullet." **[CITED — Maher & Shaw 2008]** "Higher frequencies (shorter wavelengths) are almost
always attenuated more than lower frequencies"; relative-humidity absorption "increases
monotonically with increasing frequency, and is greatest for relative humidity in the
10–30% range." **[CITED — Maher 2007]** A .308 bullet slows to roughly half its muzzle
velocity over 700 m, widening the Mach cone downrange. **[CITED — Maher & Shaw 2008]**

Atmospheric absorption is computed per **ISO 9613-1**; higher octave bands attenuate more, so
"the further away … the more the received sound spectrum becomes biased towards the lower
frequencies." **[CITED — NPL, *Sound propagation theory & methodologies*, Appendix A]**
Exact dB/km coefficients: see **GAP-C**.

### 3.2 What ours does

```
WEAPON.sniper: hp 2200 Hz, 0.032 s, g 0.19  +  bp 700 Hz Q1.6, 0.06 s, g 0.09  + range-scaled echoes
WEAPON.rifle : hp 3300 Hz, 0.026 s, g 0.115 + (mass>1.5) bp 1350 Hz Q1.2, g 0.07
WEAPON.mg    : tone 150->62 Hz g 0.10 ; n×[ hp 2000 Hz 0.02 s g 0.105 + bp 620 Hz Q1.4 0.03 s g 0.05 ] @63 ms
```

**Contradiction 1 — the blast is missing.** All three weapons place their dominant component
in the **2000–3300 Hz** highpass region, which the literature identifies as *shock wave*
territory, and give the 500–1000 Hz **muzzle-blast** region either nothing (rifle at
default mass), a −6.5 dB accessory (sniper: 0.09 vs 0.19), or a −6.4 dB accessory (MG: 0.05
vs 0.105). The literature says the blast is the *peak spectral energy* of a small-arms shot.
We have inverted the ratio.

**Contradiction 2 — the three guns differ only in a highpass corner.** 2200 vs 3300 vs
2000 Hz on the same pink-ish noise through the same envelope. Measured loudness-weighted
onset levels (§2.2 metric): sniper −13.6, rifle −21.2, MG tap −23.4 dB — i.e. the guns
currently differ mostly in **level**, not in **timbre**, and level is the cue distance
already consumes.

**Contradiction 3 — shock wave given to everyone.** The shock only exists for a listener near
the bullet's path **[CITED — Maher 2007, Mach-cone geometry]**. We give a full crack to every
shot regardless of geometry, which is both wrong and the reason every shot sounds the same.

**Contradiction 4 — no directionality.** `chain()` (L76–89) applies distance and pan only.
There is no shooter-facing term, though the engine knows the firing direction.

**Contradiction 5 — ground reflection absent.** `echoes()` fires only off registered
reflectors and explicitly **skips any tap under 45 ms** (L164). The ground bounce is a 1–3 ms
tap. It is structurally excluded.

### 3.3 Target spec — gunshots

**Universal shot skeleton** (all small arms):

| layer | content | timing | level |
|---|---|---|---|
| A. blast body | band-limited noise + short low tone, centred **500–1000 Hz** **[CITED]** | **2–5 ms** decay **[CITED]** | **dominant** — the loudest layer |
| B. barrel echo | repeat of A at −6 dB | **+0.8 ms** **[CITED — Rasmussen et al.]** | −6 dB |
| C. crack | highpassed noise ≥2000 Hz **[CITED]** | **0.2–0.3 ms** effective **[CITED]** | only when the round's path passes within the crack radius |
| D. ground bounce | A+C darkened (−4 dB, LP ~4 kHz) | **+1.5–3 ms** **[CITED]** | −4 dB |
| E. map answer | existing `echoes()` | ≥45 ms | as now |

Layer C must be **much shorter than we currently make it**: 0.2–0.3 ms is roughly a *single
sample cluster* at 48 kHz. Practically, synthesise it as a 1–2 ms burst, not the 20–32 ms
hiss we ship now — that is 100× the published duration and is why it reads as "hiss" rather
than "crack."

**Weapon separation — put it in layer A, not in the highpass corner.**

| weapon | blast centre | blast decay | crack | cadence |
|---|---:|---:|---|---|
| sniper (heavy rifle) | **550 Hz** | 4.5 ms | strong, path-gated | single |
| rifle (light) | **850 Hz** | 2.5 ms | moderate, path-gated | single |
| MG | **800 Hz** | 2.0 ms | light | repeated at the gun's rate (current 63 ms = 952 rpm) |

All three centres are inside the cited 500–1000 Hz band; the **within-band placement and the
decay length are [DESIGN]**, chosen so heavier = lower and longer. See **GAP-D**: I could not
find an authority that maps caliber/charge to a blast spectral peak, so do not present these
three numbers as measured.

**Loudness-corrected levels.** Moving the dominant energy from 3150 Hz to 700 Hz costs
**+4.0 dB** at 60 phon (§1). Raise gun gains by that much when the blast becomes the dominant
layer, otherwise the guns will get quieter as they get better.

**Directionality.** Apply a facing term to layer A: full level along the barrel axis, and
attenuate off-axis. The cited measurements show a clearly lower muzzle signature when the
barrel points away **[CITED — Maher 2007]**; the exact off-axis dB curve is **GAP-E**, so
implement a modest **−3 to −6 dB** rear attenuation and mark it as a design value.

**Distance.** Two cited effects, both currently missing:
1. The blast/shock ratio shifts toward the shock downrange **[CITED]** — scale layer A down
   faster than layer C with distance.
2. The received spectrum tilts toward low frequencies with range **[CITED]** — this is what
   `chain()`'s `air` lowpass already models; keep it, and note that at COLDSNAP's ≤80 m map
   scale atmospheric absorption is **small** and the dominant distance cues are spreading,
   ground reflection and reverberation, not air absorption. (Magnitude claim depends on
   GAP-C.)

**Ground bounce.** Lower `echoes()`' minimum tap from 45 ms, or add a dedicated ground tap at
1.5–3 ms. The current 45 ms floor was there to avoid phasing — a 1.5–3 ms tap *is* comb
filtering, and that comb is a real, cited part of the sound of a shot over open ground.

## 4. Wind

### 4.1 Published profile

**Most of what a microphone records as "wind" is not sound.** "the pressures that are most
readily measured and associated with the blowing wind are not a result of propagating acoustic
waves. Turbulent wind produces pressure fluctuations, which are recorded by an acoustic
sensor regardless of whether they are acoustical." **[CITED — Lyons, Hart & Raspet,
*Acoustics Today*, ASA]**

**Spectral shape.** "wind noise is broadband with a wide range of scales. Wind noise is
observed most often over low frequencies, contributing typically below a few kilohertz. The
largest eddies with length scale 𝓛 ensure a **broad peak in the wind noise spectrum near
Uc/𝓛**. Because this frequency can be **less than a hundredth of a hertz**, it is usually not
observed… The spectrum then **decreases as a negative power law with increasing frequency**."
**[CITED — Lyons, Hart & Raspet]**

Within the inertial subrange the characteristic spectral slope is on the order of
**−6.7 dB per decade** for pressure fluctuations coherent across a windscreen. **[CITED —
Lyons/Hart/Raspet-adjacent windscreen literature; see GAP-F for the exact applicability of
this slope to free-ear listening]**

**Temporal structure.** Turbulence is a continuous distribution of eddy scales, the largest
carrying most of the kinetic energy, with faster fluctuation superimposed and decorrelating
more rapidly at smaller scale. **[CITED — Lyons, Hart & Raspet]** Combined with the spectral
peak below 0.01 Hz, this means the correct model of gustiness is a **broadband random process
whose power rises toward low modulation rates** — not a periodic wobble.

**Aeolian tones.** "A cylindrical body in the wind, such as a pole or a wire, will
periodically shed turbulent eddies from its leeward side. The unsteady forces load the
surface, causing sound radiation known as an **Aeolian tone**." **[CITED — Lyons, Hart &
Raspet, citing Strutt/Rayleigh 1879]** The tone frequency follows the Strouhal relation
f = St·U/D; for the numeric value of St see **GAP-G**.

**Vegetation.** "Trees generate sound aerodynamically, primarily as Aeolian tones from their
leaves and branches and mechanically through unsteady contact between branches…
**Low-frequency contributions** in both coniferous and deciduous trees are due to **mechanical
contact between branches** and unsteady aerodynamic forces. Fully leafed deciduous trees
generate **high-frequency noise** through the unsteady contact of leaves." **[CITED — Lyons,
Hart & Raspet, citing Fégeant 1999, Bolin 2009]**

### 4.2 What ours does

`audio.js` L417–421:
```
windPh += dt * (0.13 + sin(windPh*0.37)*0.02)
getLoop("wind", 300, "bandpass", 0.35)
setLoop(W, 0.011 + 0.008*(0.5+0.5*sin(windPh)),
           240 + 140*(0.5+0.5*sin(windPh*0.61 + 1.7)), dt)
```

- One **bandpass, Q 0.35** ⇒ −3 dB bandwidth ≈ 300/0.35 ≈ **857 Hz**, centre sweeping
  240–380 Hz. So the wind occupies roughly 100 Hz–800 Hz and nothing else. **[DERIVED]**
- Gain range **0.011–0.019** — a ±26 % swing about the mean, i.e. **±2.0 dB**. **[DERIVED]**
- Modulation period: 2π/0.13 ≈ **48 s** for the level, 2π/(0.13·0.61) ≈ **79 s** for the
  centre frequency. **[DERIVED]**
- Both modulators are **single sinusoids**.

**Contradictions with the literature:**
1. Wind is a **falling broadband slope**; ours is a **fixed mid band**. There is no low
   rumble and no high hiss at all.
2. Wind's modulation is **broadband and multi-scale with most power at the slowest rates**;
   ours is **two sinusoids** at 48 s and 79 s. A pure 48-second sinusoid at ±2 dB is, over any
   listening window, a constant — which is the definition of the static Jeff reported.
3. Aeolian tones and vegetation noise are **cited components of outdoor wind sound**; we have
   neither.

Measured for scale: the wind bed's loudness-weighted energy over one second is **−10.8 dB**,
i.e. *above* the bell's total (−14.6 dB in the same metric over the first 50 ms, −5.9 dB over
a full second). **[MEASURED]** The wind is a significant part of the mix, not a whisper.

### 4.3 Target spec — wind

**Spectrum: three stacked bands forming a falling slope**, replacing the single bandpass.
Slope target **−6 dB/octave** across the audible band **[DESIGN, chosen to approximate the
cited "negative power law"; see GAP-F for the exact exponent]**:

| band | filter | relative level |
|---|---|---:|
| rumble | lowpass ~180 Hz | 0 dB (reference) |
| body | bandpass ~450 Hz, Q 0.7 | −6 dB |
| air | highpass ~1.2 kHz | −14 dB |

**Modulation: three summed random walks, not sinusoids** **[DESIGN, satisfying the CITED
multi-scale/low-rate-dominant structure]**:

| layer | timescale | depth on level | depth on brightness |
|---|---|---:|---:|
| surge | 20–60 s | ±6 dB | ±2 dB |
| gust | 2–8 s | ±4 dB | ±4 dB |
| flutter | 0.15–0.6 s | ±1.5 dB | ±3 dB |

Use low-passed noise (or summed detuned LFOs at incommensurate rates) so the pattern never
repeats. Crucially, **gusts must brighten as well as swell** — the "air" band should rise
faster than the "rumble" band with gust intensity, because gustier flow puts more energy into
the smaller, faster scales. **[DESIGN, motivated by the CITED eddy-scale distribution]**

**Aeolian tones.** When gust intensity is high, add 1–3 narrow resonant peaks (Q 8–20) whose
frequency follows **f = St·U/D** for the map's cylindrical structures (poles, wire, gun
barrels), at −18 dB relative to the rumble band, fading in above a gust threshold. Frequency
mapping requires St — **GAP-G**; until sourced, treat the pitch mapping as a tuned design
parameter, not a physical one.

**Vegetation, if the map has trees.** Two additional beds: a low knock/creak layer for branch
contact, and a high rustle layer for leaves, the high layer gated on foliage presence.
**[CITED mechanism]**

**Level.** Keep the mean where it is; the problem is shape and motion, not volume. But the
measured energy comparison in §4.2 says the wind is currently competitive with the bell —
after the bell retune, re-check that the wind bed does not mask it in the 250–1000 Hz region,
which the new bell will occupy.

## 5. AirPods

**What is established.** Vent leakage in a non-sealing (open) earpiece coupling causes loss
of output sound pressure in the ear canal; the vent-leakage effect operates "from ~200 to
3150 Hz, with the **majority of the effect below about 800 Hz**," converging to zero above
3150 Hz. **[CITED — Audioscan vent-correction methodology, AudiologyOnline art. 27884]**
Related: an occluding coupling can boost low-frequency ear-canal SPL by 20 dB or more
relative to an open canal. **[CITED — same body of audiology literature]**

For sealed AirPods Pro 2 the FDA 510(k) clearance for the Hearing Aid Feature records
OSPL90 = **106 dB SPL**, full-on gain (FOG50) = **27 dB**, THD < 1 % at 500/800/1600 Hz.
**[CITED — FDA K243453]** This bounds output but does not give a response curve.

**What I could not establish: see GAP-A.** No authority-published frequency-response
measurement of standard (open-fit) AirPods was obtainable. Apple publishes none.

**Operative conclusion that does not depend on the gap.** The equal-loudness data alone
(§1) requires +23.2 dB at 94 Hz versus 3150 Hz at moderate level; the leakage mechanism
removes further output in exactly that region. Therefore: **no load-bearing information in
COLDSNAP may live below ~150 Hz.** Sub-100 Hz content is permitted only as *weight* under
something that is independently audible higher up.

## 6. Gaps — not to be filled by guessing

- **GAP-A — AirPods frequency response.** No authority-published measured response for
  standard open-fit AirPods. Apple publishes no FR; the FDA clearance gives output limits,
  not a curve. The mechanism (vent leakage, effect mainly below ~800 Hz) is cited; the
  magnitude at 94 Hz is not.
- **GAP-B — bell partial I-7 ratio.** The existence and prominence of I-7/I-8 is cited; I did
  not obtain a measured frequency ratio for I-7 relative to the nominal. The 10.3× in §2.3 is
  a design placeholder.
- **GAP-C — atmospheric absorption coefficients.** ISO 9613-1 is the governing standard and
  NPL publishes the computed dB/km curve, but the numeric values sit inside a figure I could
  not extract, and the ISO tables are paywalled. The *direction* (higher frequencies attenuate
  more) is cited; the dB/km numbers are not. The claim "absorption is negligible at ≤80 m"
  in §3.3 is therefore **unverified**.
- **GAP-D — caliber → blast spectral peak.** The 500–1000 Hz band for small arms as a class is
  cited. No source found mapping charge/caliber to a peak frequency within that band, so the
  550 / 850 / 800 Hz split is a design choice, not data.
- **GAP-E — muzzle directivity curve.** Directionality is cited qualitatively (and one
  measured pair: ≈154 dB at the head vs ≈166 dB 250 mm behind the muzzle, which is a
  *position* difference, not a polar pattern). No published polar response in dB vs azimuth
  obtained.
- **GAP-F — wind spectral slope for free-ear listening.** The −6.7 dB/decade figure comes from
  windscreen/microphone self-noise literature. Whether it transfers to wind as *heard* by an
  unshielded listener is not established here.
- **GAP-G — Strouhal number for aeolian tones.** The mechanism and the relation f = St·U/D are
  cited; a numeric St for the relevant obstacle geometries was not obtained from an authority.
- **GAP-H — per-partial bell decay times.** Woodhouse et al. give measured Q at three
  frequencies on one bell. No source found giving decay times indexed by *named partial*
  (hum, tierce, nominal…) across bells. The T60 targets in §2.3 are anchored to the three
  measured values and extrapolated.
- **GAP-I — bell strike transient spectrum.** The single-vs-multiple-impact distinction is
  cited. No measured spectrum or duration of the initial hammer transient was obtained; the
  3–6 ms / ≥1.5 kHz figures in §2.3 are design values.

## 7. Citations

1. **ISO 226:2003**, *Acoustics — Normal equal-loudness-level contours*, International
   Organization for Standardization, 2nd ed. Equation (1) and normative Table 1 (α_f, L_U,
   T_f). https://www.iso.org/standard/34222.html
2. **Whyte, H., Perrin, R. & Halkon, B.** (2024) "A New Analysis of the Normal Modes of a
   Large English Church Bell", *Proceedings of Acoustics 2024*, Australian Acoustical Society,
   Gold Coast, 6–8 Nov 2024.
   https://acoustics.asn.au/conference_proceedings/AAS2024/papers/p87.pdf
3. **Perrin, R., Charnley, T. & DePont, J.** (1983) modal analysis of the modern English
   church bell — the experimental dataset reported in [2].
4. **Hibbert, W. A., Sharp, D. B., Taherzadeh, S. & Perrin, R.** (2014) "Partial Frequencies
   and Chladni's Law in Church Bells", *Open Journal of Acoustics* 4:70–77.
   https://doi.org/10.4236/oja.2014.42007
5. **Hibbert, W. A.** (2008) *The Quantification of Strike Pitch and Pitch Shifts in Church
   Bells*, PhD thesis, The Open University; and the derived articles "Identifying bell
   partials", "The musical pitch of bells", "What note do we hear when a bell rings?", "The
   musical sound quality of church bells". https://www.hibberts.co.uk/
6. **Woodhouse, J., Rene, J. C. & Mason, S.** (2012) "The Dynamics of a Ringing Church Bell",
   *Advances in Acoustics and Vibration* 2012:681787. https://doi.org/10.1155/2012/681787
7. **Maher, R. C.** (2007) "Acoustical Characterization of Gunshots", *IEEE SAFE 2007*,
   Washington DC, 11–13 April 2007, pp. 109–113.
   https://www.montana.edu/rmaher/publications/maher_ieeesafe_0407_109-113.pdf
8. **Maher, R. C. & Shaw, S. R.** (2008) "Deciphering Gunshot Recordings", *AES 33rd
   International Conference*, Denver, 5–7 June 2008.
   https://www.montana.edu/rmaher/publications/maher_aesconf_0608_1-8.pdf
9. **Begault, D. R., Beck, S. D. & Maher, R. C.** (2019) "Overview of Forensic Audio Gunshot
   Analysis Techniques", *AES International Conference on Audio Forensics*, Porto, 18–20 June
   2019. https://www.montana.edu/rmaher/publications/begault_beck_maher_0619_20475.pdf
10. **Rasmussen, P., Flamme, G., Stewart, M., Meinke, D. & Lankford, J.** (2009) "Measuring
    Recreational Firearm Noise", *Sound & Vibration* 43(8).
    http://www.sandv.com/downloads/0908rasm.pdf
11. **Routh, T. K. & Maher, R. C.** (2016) "Recording anechoic gunshot waveforms of several
    firearms at 500 kilohertz sampling rate", *Proc. Meetings on Acoustics* / NIJ.
    https://nij.ojp.gov/library/publications/recording-anechoic-gunshot-waveforms-several-firearms-500-kilohertz-sampling
12. **Beck, S. D., Nakasone, H. & Marr, K. W.** (2011) "Variations in Recorded Acoustic
    Gunshot Waveforms Generated by Small Firearms", *J. Acoust. Soc. Am.* 129(4):1748–1759.
13. **Lyons, G. W., Hart, C. R. & Raspet, R.** "As the Wind Blows: Turbulent Noise on Outdoor
    Microphones", *Acoustics Today*, Acoustical Society of America.
    https://acousticstoday.org/wp-content/uploads/2021/11/As-the-Wind-Blows-Turbulent-Noise-on-Outdoor-Microphones-Gregory-W.-Lyons-Carl-R.-Hart-and-Richard-Raspet.pdf
14. **Fégeant, O.** (1999); **Bolin, K.** (2009) — vegetation-generated wind noise, as cited
    in [13].
15. **Strutt, J. W. (Lord Rayleigh)** (1879) — aeolian tones from a wire, as cited in [13].
16. **National Physical Laboratory (UK)**, *Sound Propagation Theory & Methodologies*,
    Appendix A (atmospheric attenuation computed per ISO 9613-1:1993).
    https://resource.npl.co.uk/acoustics/techguides/envnoiseassessment/appendix_a.pdf
17. **ISO 9613-1:1993**, *Acoustics — Attenuation of sound during propagation outdoors —
    Part 1: Calculation of the absorption of sound by the atmosphere*.
    https://www.iso.org/standard/17426.html
18. **W3C**, *Web Audio API* — `DynamicsCompressorNode` default parameter values and
    `BiquadFilterNode` coefficient formulas. https://www.w3.org/TR/webaudio/
19. **US FDA**, 510(k) K243453 — Apple Inc., Hearing Aid Feature (AirPods Pro).
    https://www.accessdata.fda.gov/cdrh_docs/pdf24/K243453.pdf
20. **Audioscan / AudiologyOnline** (art. 27884), *Vent Corrections for Simulated Real-Ear
    Measurements* — vent-leakage frequency range for open couplings.
    https://www.audiologyonline.com/articles/audioscan-vent-corrections-27884
