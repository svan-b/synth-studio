# Subharmonicon facts re-read 2026-10-29 (cite printed folio = PDF page + 1 for Owner's Manual)

Manual (M) printed pages:
- p.9 overview: 60HP, alu rails, wood sides; 2 VCOs each 2 subs; two 4-step seqs (any combo of VCO/SUB1/SUB2); 4 rhythm gens (one or both seqs); 2 AD EGs (VCF, VCA); 4-pole -24dB ladder LPF; 32 points 17 in / 15 out.
- p.10 history: Trautonium/Mixtur-Trautonium undertones, Rhythmicon (16 rhythm generators), Schillinger.
- p.11 undertone table f/2..f/16; polyrhythm: integer division of clock, re-sync on common downbeat.
- p.12 tour: hold EG until blink = EGs locked at highest; QUANTIZE until no LED = unquantized; 12-ET -> FREQ knob steps notes.
- p.13 SUB 1 FREQ fully CW = unison, CCW steps undertones. Sequence: OSC 1 lit, SEQ 1 under RHYTHM 1 lit (lets NEXT/RESET navigate), SEQ OCT +-2; RESET -> step 1 + rhythm gens to start.
- p.14 step LED under each STEP knob; NEXT cycles steps.
- p.15 press blinking EG -> lit (steps trigger EGs); PLAY; TEMPO; RHYTHM 1 knob 16 discrete steps 1..16; polyrhythm by adding R2 SEQ 1; RESET tip.
- p.16 filter chirp; WAVE; envelopes; EG AMT bidirectional.
- p.17 just C major C=1/1 D=9/8 E=5/4 F=4/3 G=3/2 A=5/3 B=15/8 C=2/1; ET; exercise: chord with VCO FREQ + SUB FREQ, cycle QUANTIZE; JI lacks beating in minor chords.
- p.18 VCO 1 FREQ: 4 oct, CCW = middle C 262 Hz, CW = 4186 Hz; QUANTIZE limits knob to scale steps. SUB 1 FREQ = VCO/n n=1..16, CW = 1.
- p.19 SUB 2 same; WAVE UP square all three; MIDDLE VCO square(pulse), subs saw, SUB 1 saw normalled as PWM for VCO square; DOWN saw all. TIP: MIDDLE adds 2nd pitched component even with SUB 1 LEVEL at 0. PWM jack overrides normal. VCO 2 FREQ same.
- p.20 VCO 2 subs, wave same.
- p.21 Quantize 12- or 8-tone, JI or ET, shared; FREQ knobs step. Hold QUANTIZE until LED flashes -> SEQ jacks unquantized, oscillators still quantized. Four settings cycle; all off = off. 12-ET chromatic, 8-ET diatonic, 12-JI, 8-JI. Mixer: 6 levels -> filter; near max = warm distortion.
- p.22 the six LEVEL knobs.
- p.23 ladder LP 4-pole 24 dB; CUTOFF 20 Hz-20 kHz; RESONANCE max + low cutoff -> self-osc. VOLUME = AUDIO OUT level.
- p.24 VCF ATTACK 1 ms-10 s (CUTOFF level -> max set by EG AMT); no restart during attack; VCF DECAY 5 ms-10 s; trigger: A then D; gate: A, hold max until gate ends, then D. EG AMT bipolar, centre none. VCA ATTACK 1 ms-10 s from zero to VOLUME level; no restart in attack.
- p.25 VCA DECAY 5 ms-10 s (VOLUME level -> 0). TEMPO .333-50 Hz = 20-3000 BPM @1 PPQ. CLOCK in overrides TEMPO; MIDI clock overrides both. Internal 1 PPQ; with MIDI clock 4 PPQ (16ths).
- p.26 seq: 4 steps, knob + LED; must get clock from >=1 rhythm gen; SEQ 1 OUT -> VCO 2 IN example (with/without OSC 2). STEP centre = no change; CW +, CCW -. Depends on QUANTIZE + SEQ OCT. SEQ 1 ASSIGN OSC 1 (subs follow), SUB 1 (modifies integer of SUB 1 FREQ knob), SUB 2.
- p.27 SEQ 2 same.
- p.28 SEQ OCT shared, three values (listed +-5, +-2, +-1), button cycles, LED. 10 kHz ceiling for seq modulation; full +-5 needs FREQ fully CCW; subs not accurate >10 kHz; CV inputs can drive far above 10 kHz. Hold SEQ OCT until LED flashes -> SEQ jacks always +-5, oscillators keep range; hold again to return. PLAY starts/stops seqs + rhythm gens; unlit stops CLOCK out. TRIGGER: EG on -> instant restart (not in attack).
- p.29 TRIGGER: EG off -> gate (held at max while held, decay on release); EG held -> no effect. NOTE: button linked with rhythm gens + trigger inputs; combined -> TRIGGER out. RESET: steps to 1, rhythm gens initial phase; PLAY lit -> begin again next clock pulse; unlit -> wait for PLAY. Hold RESET = Hold (step 1, no advance, EGs still triggered by rhythm gens assigned to that seq); NEXT while held advances (EGs keep firing). RESET combined with RESET jack. NEXT advances immediately; NEXT does not retrigger EGs (except RESET held / gate at RESET jack). EG: Off unlit, On lit, Held blink; quick press toggles On/Off; hold until blink = Held. OFF: steps don't trigger EGs; TRIGGER button + external triggers do and pass to TRIGGER out. ON: all manual/external/seq triggers -> TRIGGER out.
- p.30 HELD: EGs held open at max until EG pressed again; PLAY unlit + NEXT for tuning. Entering Held: EGs run Attack then hold; exiting: complete Decay. Polyrhythm: 4 gens, tempo / 1..16, to SEQ 1, SEQ 2 or both; internal/analog/MIDI clock. RHYTHM 1 CW = 1, CCW = 16. SEQ 1/SEQ 2 buttons.
- p.31 patchbay: 32 points, 17 in normal text, 15 out reversed; 3.5 mm; 5 cables included. VCO 1 IN 1V/oct summed with FREQ + seq 1 steps, -5..+5 V, normalled to VCO 2. VCO 1 SUB IN chooses 1-16 for both subs, centre knobs for bipolar, -5..+5.
- p.32 VCO 1 PWM: PW of VCO 1 + SUB 1 + SUB 2; square must be selected; overrides internal (SUB 1 saw, centre position); -5..+5 V = 1%..99% duty. VCA OUT Eurorack level 10 Vpp. VCO 1 OUT / SUB 1 / SUB 2 OUT 10 Vpp.
- p.33 VCA IN summed with VCA EG, 0..+8 V. VCO 2 IN 1 V/oct. VCO 2 SUB IN. VCO 2 PWM (text says "sawtooth 2" - p.20 says SUB 1). VCA EG OUT 0..+8.
- p.34 VCO 2 OUT/SUB outs 10 Vpp. CUTOFF IN: knob centred, sweep up to +-5 oct, -5..+5 V. PLAY IN: gate toggles PLAY status; button still works and overrides; rising = play, falling = stop; 0..10 V.
- p.35 RESET IN: trigger = reset (restart next clock pulse if playing); gate = hold; NEXT during gate advances; rising edge = trigger, continuous high = gate. TRIGGER IN: triggers both EGs (not in attack); rising edge = trigger. VCF EG OUT 0..+8. RHYTHM 1/2 IN: sets timing by controlling value of the knob; centre for best range; -5..+5.
- p.36 RHYTHM 3/4 IN. SEQ 1 OUT current step CV respects QUANTIZE + SEQ OCT, -5..+5. SEQ 1 CLK clock of seq 1 tempo 0..+5. SEQ 2 OUT.
- p.37 SEQ 2 CLK 0..+5. MIDI IN TRS type A; clock, notes, CCs; MIDI clock overrides; LED shows MIDI received. CLOCK IN overrides internal; 0..10 V rising edge. CLOCK OUT reflects current source; only while playing & PLAY lit; 0..10 V. TRIGGER OUT: each time EGs triggered (sequencers or TRIGGER button); 0..+5 V pulse 1 ms.
- p.38 DFAM: CLOCK OUT -> DFAM ADV/CLOCK; or TRIGGER / SEQ 1 CLK / SEQ 2 CLK for polyrhythm; press DFAM RUN/STOP first, then PLAY.
- p.39 Mother-32 ASSIGN (clock) -> CLOCK IN; press PLAY first, then M32 RUN/STOP; M32 clock divisions.
- p.40 Eurorack: 360 mA +12 V, no -12 V; EIGHT black M3 screws on the front panel.
- p.41 Fine tune +-50 c: hold OSC 1 + OSC 2 until QUANTIZE LEDs flash, TEMPO sets (centre 0), QUANTIZE exits; stored.
- p.42 MIDI notes offset from C4; FREQ fully CCW -> notes unchanged. CC 4/36 VCO 1 freq 14-bit +-2.5 oct added to knob; CC 103/104 VCO1 SUB1/SUB2, 8 values per integer (0-7 = 16 ... 120-127 = 1), replaces knob until moved. CC 12/44 VCO 2 freq.
- p.43 CC 105/106 VCO2 subs; CC 23/55 VCF attack, 24/56 VCF decay, 28/60 VCA attack, 29/61 VCA decay.
- p.44 Play (MIDI transport) SysEx default ON; CC 113 rhythm logic 0-63 OR / 64-127 XOR (both true -> no advance); MIDI channel SysEx default 1 (1-16, All).
- p.45 presets intro: analog, units differ; Aquatic Chords + Mellow Harmonies sheets ("sequencer pitches are suggestions").
- p.46 Slip & Fall; Point Zero (tune seqs and subs; VCF ATTACK = sweep length).
- p.47 Three Hands on the Wheel; Bateria (kick tuning = CUTOFF; VCF DECAY + EG AMT flavours).
- p.48 Spiral Ways (SUB VCO1 SUB1 a fifth, VCO 2 SUB 2 a major third, VCF ATTACK crescendo); Star-Gate (hi-octave pitches, R2-R4 SEQ 2 rates, VCA DECAY, reset and play, perform the mixer).
- p.49 Poly Rock (subs to chord shapes; CLOCK OUT -> VCA IN for drums); Cloud Path (open VCO 1 LEVEL, tune SEQ 1, VCO 2, SEQ 2, subs, volume 0, reset & play, raise VCO 2 then subs; R3 SEQ 1 for double time).
- p.56 signal flow (PDF 55): RESET/RESET IN -> rhythm gens; CLOCK (CLOCK IN, MIDI IN, PLAY jack, PLAY button) -> CLOCK OUT + gens; RHYTHM n IN into gens; each gen -> SEQ 1 and SEQ 2. SEQ 1 out -> junction -> SEQ RANGE -> QUANTIZE -> OSC 1 assign -> (+) VCO 1 CV IN -> VCO 1; junction also -> SUB 1 / SUB 2 assign (pre range/quantize) -> (+) VCO 1 SUB IN -> SUB 1 / SUB 2. SEQ 2 side: SEQ RANGE -> SEQ 2 OUT jack; SUB assigns drawn without input line (incomplete). SEQ 1 CLK + SEQ 2 CLK -> OR -> TRIGGER OUT; OR -> EG switch -> OR with TRIG button + TRIG IN -> VCF EG + VCA EG. VCO 2 CV IN normalled from VCO 1 CV IN. PWM IN normalled from SUB 1 (wave switch). Mixer -> VCF -> VCA -> VOLUME -> LINE/HEADPHONE OUT and VCA OUT. CUTOFF IN (+) VCF EG +/- ; VCA CV IN (+) VCA EG.
- p.57 specs (PDF 56).

PWI (printed page = PDF page):
- p.3 Initialized Patch (image).
- p.4 First Steps: R1 SEQ 1, R2 SEQ 2, EG lit, PLAY, TEMPO ~9 o'clock; same pitch; SEQ 1 -> VCO 1 cable = 4 notes; init SEQ OCT +-5; noon = 0 V; CW = +5 V = +5 oct; set +-1, QUANTIZE 12-ET; then remove cable, press OSC 1 (same effect).
- p.5 Intertwining: OSC 1 lit; SEQ 2 -> VCO 1; R1 fully CW, R2 fully CCW -> seq 1 plays 4 phrases per seq 2 step; seq 2 transposes seq 1 (voltages add).
- p.6 Melody to Rhythm: remove cable, SEQ 2 -> CUTOFF; CUTOFF ~9 o'clock; raise RESONANCE, reduce VCF DECAY -> percussive drum machine; keep cable.
- p.7 Intermingled Drum Machine: + VCO 1 SUB 1 -> RHYTHM 2 IN (R2 knob ~middle), play SUB 1 FREQ; + VCO 1 SUB 2 -> RHYTHM 1 IN; subs act as LFOs; continue with R3/R4 + VCO 2 subs.
- p.8-10 Fun with Envelopes: init; R1 SEQ 1, R2 SEQ 2, EG lit, PLAY, TEMPO ~9; OSC 1 + basic seq; VCO 2 SUB 1 -> CLOCK IN (audio-rate noise); VCO 2 FREQ fully down + VCO 2 SUB 1 FREQ fully down -> sub clocks seq; VCF EG -> VCO 2 SUB IN; VCF DECAY fully CCW, VCF ATTACK ~noon -> accelerating clock (EG raises SUB 1 FREQ); R1 CCW to slow; VCO 2 SUB 2 -> PLAY IN with SUB 2 FREQ ~noon -> stop/start; QUANTIZE 8-ET.
- p.12-15 patch point ideas. TRIGGER IN: "rising gate" triggers both EGs, akin to TRIGGER button; motion in either SEQ triggers EGs; CLOCK -> TRIGGER for every pulse. RESET IN: rising gate resets and holds until gate goes down. PLAY rising = on, falling = off. VCA EG "normalled" to VCA in; VCF EG "normalled" to CUTOFF (internal wiring). TRIGGER OUT: sent to VCF and VCA EGs; only fires whenever SEQ 1 or SEQ 2 moves (differs from CLOCK).

Decisions:
- TRIGGER OUT = every sequencer move (either seq, any EG mode: diagram + PWI p.15) OR TRIGGER button (EG ON trigger / EG OFF gate start; not in HELD) OR TRIGGER IN rising edge OR MIDI note-on. (text p.29, p.37)
- SEQ ASSIGN SUB taps raw step (pre SEQ RANGE/QUANTIZE, diagram p.56): raw = knob frac x 5 V; research suggested post-range (x SEQ OCT): noted as conflict.
- TRIGGER IN edge only (p.35). RESET IN trigger + gate hold (p.35).
- HELD: enter runs attack then holds; exit runs decay (p.30).
- PWM jack: 1..99 % over +-5 V (p.32), linear: duty = 0.5 + 0.098 * V.
- VCA OUT after VOLUME (diagram p.56).

## Coordinator: AUDIO QA GATE (before final commit)
node /home/user/synth-studio/scripts/audio-qa.cjs http://localhost:3124 subharmonicon --target -18 --suggest --out <scratch>/aqa-keys
node /home/user/synth-studio/scripts/audio-qa.cjs http://localhost:3124 subharmonicon --excite subharmonicon=transport --target -18 --suggest --out <scratch>/aqa-seq
Both exit 0: true peak <= -1 dBTP; |DC| <= 0.005; no clicks, no stuck tails (drones note only); each preset within +-4 LU of -18 LUFS. Old baseline: DC .055 on 'Envelope PWM (cable)'; median -26.9 LUFS (needs ~+9 dB). Report final summary lines. Docs: /home/user/synth-studio/docs/AUDIO_QA.md
## Coordinator: Safari/iPad rules: WebkitUserSelect none / select-none; no onDoubleClick (pointer timing); no per-quantum allocs in worklet; clocks in worklet; meters scaleX; no essential info only in title tooltips.
