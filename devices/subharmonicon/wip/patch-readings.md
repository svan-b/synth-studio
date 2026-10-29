# Patch sheet readings (clock positions of the blue pointer; 7 = fully CCW, 12 = noon, 5 = fully CW)
# Conversion: theta = (clock-12)*30 deg; p = (theta+150)/300. Divider index = floor((theta+150)/18.75) -> div = 16-index.
# XPB printed page = PDF page - 2 (folio printed bottom right). Manual printed = PDF + 1. PWI printed = PDF.

## XPB p.4 (PDF 6) "Transistor Insects" -> notes: play with sequencer and polyrhythm settings
SEQ1 steps: 11:30, 2, 9, 4   -> -10, +40, -60, +77 %
SEQ2 steps: 1, 3, 12, 8:40   -> +20, +60, 0, -67 %
RHYTHM: R1 ~8:50 (div 13-14), R2 10 (div 12), R3 8 (div 15), R4 ~9:10 (div 13); all 8 SEQ buttons lit
TEMPO ~4:50 (p~0.98); EG ON; PLAY on; SEQ OCT +-5; QUANTIZE off
VCO1: WAVE UP (square); FREQ ~4:40 (p~0.96); SUB1 ~1 (div 7); SUB2 ~7 (div 16); ASSIGN OSC1 + SUB2
VCO2: WAVE UP; FREQ ~4:30 (p~0.95); SUB1 ~1 (div 7); SUB2 ~7:20 (div 15-16); ASSIGN OSC2 + SUB2
LEVELS: VCO1 2 (68), SUB1 2 (68), SUB2 ~7:10 (3); VCO2 2 (68), SUB1 1:40 (65), SUB2 7:30 (8)
CUTOFF 10 (p .33); RES ~4:50 (97); EG AMT 4 (+77); VOLUME noon (taste)
VCF A 8 (p .12), VCF D 9 (p .2); VCA A ~7:20 (p .05), VCA D 8 (p .12)
CABLES: VCO 2 SUB 2 out -> VCO 1 in; VCO 1 SUB 2 out -> VCO 2 in; VCO 1 out -> RHYTHM 4 in

## XPB p.5 (PDF 7) presumably "Neon Cactus Tips Their Cap" (no notes) [verify title]
SEQ1 steps: 7:30, 10, 1:20, 10:10  -> -90, -40, +27, -37 %
SEQ2 steps: 10, 9:10, 8:10, 12     -> -40, -57, -77, 0 %
RHYTHM: R1 ~12:50 (div 7) SEQ1; R2 11 (div 10) SEQ2; R3 12 (div 8) none; R4 12 (div 8) none
TEMPO ~9:30 (p .25); EG ON; PLAY on; SEQ OCT +-2; QUANTIZE 8-JI
VCO1: WAVE UP; FREQ ~1:10 (p .62); SUB1 ~12:50 (div 7); SUB2 ~3:10 (div 3); ASSIGN SUB1 + SUB2 (no OSC1)
VCO2: WAVE MIDDLE; FREQ 11 (p .40); SUB1 10:30 (div 11); SUB2 ~2:40 (div 4); ASSIGN SUB1 + SUB2 (no OSC2)
LEVELS: VCO1 11 (40), SUB1 1 (60), SUB2 2 (68); VCO2 1 (60), SUB1 1 (60), SUB2 2:10 (72)
CUTOFF ~4:40 (p .97); RES 10:40 (37); EG AMT 10 (-40); VOLUME noon
VCF A 10 (p .30), VCF D 11:10 (p .42); VCA A ~8:50 (p .18), VCA D 11:30 (p .45)
CABLES: SEQ 1 out -> RHYTHM 1 in; SEQ 2 out -> VCO 2 PWM in; SEQ 2 CLK -> TRIGGER in

## XPB p.6 (PDF 8) "Duet for Tone and Wind" (play with VCF ATTACK, RHYTHM 1, RHYTHM 2; rings drawn on those)
SEQ1 steps: 10:20, 11:30, 12:50, 10   -> -33, -10, +17, -40 %
SEQ2 steps: 9:30, 11:20, 12:20, 2     -> -50, -13, +7, +40 %
RHYTHM: R1 ~7:30 (div 16) SEQ1; R2 ~7:30 (div 16) SEQ2; R3 12 (div 8) none; R4 12 none
TEMPO ~10:50 (p .38) [irrelevant: CLOCK patched]; EG ON; PLAY on; SEQ OCT +-5; QUANTIZE 8-ET
VCO1: WAVE MIDDLE; FREQ 2 (p .70); SUB1 11 (div 10); SUB2 11:10 (div 10); ASSIGN none
VCO2: WAVE MIDDLE; FREQ ~7:20 (p .03); SUB1 10 (div 12); SUB2 10:50 (div 10); ASSIGN none
LEVELS: VCO1 3 (80), SUB1 3 (80), SUB2 3 (80); VCO2 ~4:20 (93), SUB1 3 (80), SUB2 ~7:20 (3)
CUTOFF ~1:50 (p .68); RES ~3:50 (88); EG AMT 11 (-20); VOLUME noon
VCF A 8 (p .12); VCF D 10:10 (p .32); VCA A ~7:10 (p .02); VCA D 11 (p .40)
CABLES: SEQ 1 out -> VCO 2 PWM in; VCO 2 out -> CLOCK in (audio-rate clock)

## XPB p.7 (PDF 9) "Touchtone Wiretap" (adjust VCO 1 SUB 1 FREQ to change rhythm; ring on VCO 1 SUB 1 FREQ)
SEQ1 steps: 10, 3, 8:15, 1:30      -> -40, +60, -75, +30 %
SEQ2 steps: 11:50, 10:30, 3, 12:30 -> -3, -30, +60, +10 %
RHYTHM: R1 10 (div 12) SEQ1; R2 ~10:10 (div 11-12) SEQ2; R3 12 none; R4 12 none
TEMPO ~11:10 (p .42); EG ON; PLAY **unlit** (PLAY jack is patched); SEQ OCT +-2; QUANTIZE 12-ET
VCO1: WAVE UP; FREQ ~9:10 (p .22); SUB1 ~8:50 (div 14) [perform]; SUB2 ~8:20 (div 14); ASSIGN OSC1
VCO2: WAVE UP; FREQ 12:20 (p .53); SUB1 ~1:10 (div 7); SUB2 12:30 (div 8); ASSIGN none
LEVELS: VCO1 ~7:20 (3), SUB1 ~7:20 (3), SUB2 ~7:20 (3); VCO2 ~3:10 (82), SUB1 3 (80), SUB2 2 (70)
CUTOFF 1 (p .60); RES ~4:40 (97); EG AMT 3 (+60); VOLUME noon
VCF A 11:10 (p .42); VCF D 10:10 (p .32); VCA A 8:20 (p .13); VCA D 11:50 (p .48)
CABLES: VCO 1 SUB 1 out -> PLAY in; VCA EG out -> VCO 2 in; VCO 1 SUB 2 out -> CUTOFF in; SEQ 2 out -> VCO 1 PWM in

## XPB p.8 (PDF 10) "Ant Parade" (fade in VCO 2 SUB 1+2 for low end; play VCF ATTACK, VCF DECAY, both sequencers; rings on VCO2 SUB1/SUB2 LEVEL)
SEQ1 steps: 11, 11, 2, 9:20        -> -20, -20, +40, -53 %
SEQ2 steps: 3, 11:20, 11:50, 11:30 -> +60, -13, -3, -10 %
RHYTHM: R1 11:20 (div 10) SEQ1; R2 10:40 (div 11) SEQ2; R3 12 none; R4 12 none
TEMPO 1:30 (p .65); EG ON; PLAY on; SEQ OCT +-2; QUANTIZE 12-JI
VCO1: WAVE UP; FREQ 12:30 (p .55); SUB1 12 (div 8); SUB2 ~4:40 (div 1); ASSIGN OSC1 + SUB1 + SUB2
VCO2: WAVE UP; FREQ ~7:20 (p .03); SUB1 ~7:20 (div 16); SUB2 ~7:20 (div 16); ASSIGN none
LEVELS: VCO1 3 (80), SUB1 3 (80), SUB2 3 (80); VCO2 ~7:20 (3), SUB1 ~7:20 (3, fade in), SUB2 ~7:20 (3, fade in)
CUTOFF ~4:40 (p .97); RES 11 (40); EG AMT 10 (-40); VOLUME noon
VCF A 9:20 (p .23); VCF D 8 (p .12); VCA A 8 (p .12); VCA D 9:20 (p .23)
CABLES: CLOCK out -> VCO 1 in (also reaches VCO 2 by the normal); SEQ 2 out -> VCO 1 SUB in

## XPB p.9 (PDF 11) "Octave Fuzz" (SEQ 2 shifts SEQ 1 by +-1 octave)
SEQ1 steps: 11:10, 12:50, 10, 11:10 -> -17, +17, -40, -17 %
SEQ2 steps: 7:30, 12, ~4:50, 12     -> -93, 0, +95, 0 %   (octave down / none / up / none)
RHYTHM: R1 ~3:30 (div 3) SEQ1; R2 ~7:30 (div 16) SEQ2; R3 12 none; R4 12 none
TEMPO 10:10 (p .32); EG ON; PLAY on; SEQ OCT +-1; QUANTIZE 12-JI
VCO1: WAVE UP; FREQ 9:30 (p .25 = C5); SUB1 ~3:30 (div 3); SUB2 1:30 (div 6); ASSIGN OSC1
VCO2: WAVE UP; FREQ 9:30 (p .25); SUB1 7:30 (div 16); SUB2 7:30 (div 16); ASSIGN none
LEVELS: VCO1 3 (80), SUB1 3 (80), SUB2 3 (80); VCO2 / SUB1 / SUB2 ~7:20 (3)
CUTOFF ~8:20 (p .13); RES 11 (40); EG AMT ~4:30 (+93); VOLUME noon
VCF A 11 (p .40); VCF D 9:10 (p .22); VCA A 9:20 (p .23); VCA D 9:20 (p .23)
CABLES: SEQ 2 out -> VCO 1 in; VCO 1 SUB 1 out -> VCA in

## XPB p.10 (PDF 12) "Aliased Wind Chimes" (no notes)
SEQ1 steps: 10:30, 11:20, 1, 12:20  -> -30, -13, +20, +7 %
SEQ2 steps: 10:10, 1:50, 9:20, 3:20 -> -37, +37, -53, +67 %
RHYTHM: R1 ~3:30 (div 3) SEQ1; R2 ~9:10 (div 13) SEQ2; R3 ~9:10 (div 13) SEQ2; R4 ~11:50 (div 8-9) SEQ1
TEMPO 10:30 (p .35); EG ON; PLAY on; SEQ OCT +-2; QUANTIZE off
VCO1: WAVE DOWN (saw); FREQ ~4:40 (p .97); SUB1 ~4:50 (div 1); SUB2 ~4:50 (div 1); ASSIGN OSC1
VCO2: WAVE UP; FREQ ~7:20 (p .03); SUB1 7:20 (div 16); SUB2 7:20 (div 16); ASSIGN none
LEVELS: VCO1 3 (80), SUB1 3 (80), SUB2 3 (80); VCO2 / SUB1 / SUB2 ~7:20 (3)
CUTOFF ~4:40 (p .97); RES 2 (70); EG AMT 10 (-40); VOLUME noon
VCF A 9:20 (p .23); VCF D 9:20 (p .23); VCA A 9:20 (p .23); VCA D 9:20 (p .23)
CABLES: VCA EG out -> RHYTHM 3 in; VCO 2 SUB 1 out -> RHYTHM 4 in; SEQ 1 CLK out -> CUTOFF in

## XPB p.1 (PDF 3) "Music for Washing Dishes" (play with VCF ATTACK; ring with CW arrow on VCF ATTACK)
SEQ1 steps: 7:30, 10, 11:10, 1     -> -93, -40, -17, +20 %
SEQ2 steps: 1, 8:30, 12:30, 3      -> +20, -70, +10, +60 %
RHYTHM: R1 8:30 (div 14) SEQ1+SEQ2; R2 10 (div 12) SEQ1; R3 9:10 (div 13) SEQ1+SEQ2; R4 8 (div 15) SEQ2
TEMPO 1:30 (p .65); EG ON; PLAY on; SEQ OCT +-5; QUANTIZE 8-JI
VCO1: WAVE DOWN (saw); FREQ ~7:20 (p .03 -> C4); SUB1 ~2:50 (div 4); SUB2 7:30 (div 16); ASSIGN SUB2 only
VCO2: WAVE DOWN; FREQ ~7:20 (p .03 -> C4); SUB1 ~8:50 (div 13-14); SUB2 7:30 (div 16); ASSIGN OSC2 + SUB2
LEVELS: VCO1 ~7:20 (3), SUB1 ~7:20 (3), SUB2 3 (80); VCO2 ~7:20 (3), SUB1 3 (80), SUB2 3 (80)
CUTOFF 9:30 (p .25); RES ~4:50 (98); EG AMT ~2:10 (+43); VOLUME noon
VCF A 8 (p .10, perform: turn up); VCF D ~7:50 (p .09); VCA A 8:10 (p .12); VCA D 9:30 (p .25)
CABLES: SEQ 2 out -> CUTOFF in

## XPB p.2 (PDF 4) "Shuffled Subs" (tune VCO 1 and VCO 2 together; adjust bassline with VCO 1 SUB 1 FREQ; ring on it)
SEQ1 steps: 10:20, 1:30, 9:30, 1    -> -33, +30, -50, +20 %
SEQ2 steps: 1, 11:20, 12:20, 2      -> +20, -13, +7, +40 %
RHYTHM: R1 12 (div 8) SEQ1; R2 12:30 (div 8) SEQ2; R3 12 none; R4 12 none
TEMPO 10:50 (p .38); EG ON; PLAY on; SEQ OCT +-1; QUANTIZE 8-JI
VCO1: WAVE UP; FREQ 9:30 (p .25 = C5); SUB1 ~3:20 (div 3) [perform]; SUB2 ~7:10 (div 16); ASSIGN none
VCO2: WAVE DOWN; FREQ 9:30 (p .25 = C5); SUB1 ~3:10 (div 3); SUB2 7:30 (div 16); ASSIGN OSC2
LEVELS: VCO1 3 (80), SUB1 3 (80), SUB2 ~7:10 (2); VCO2 3 (80), SUB1 3 (80), SUB2 7:20 (3)
CUTOFF 2:30 (p .75); RES ~7:20 (3); EG AMT 10:10 (-37); VOLUME noon
VCF A ~7:20 (p .03); VCF D ~9:20 (p .23); VCA A 8:30 (p .15); VCA D 10:30 (p .35)
CABLES: SEQ 1 out -> VCO 2 in (sums with SEQ 2 via OSC 2); SEQ 2 out -> CUTOFF in

## XPB p.3 (PDF 5) "Nosferatu's Flotation Tank" (VCO 1 a perfect fourth below VCO 2; play with the polyrhythm SEQ buttons)
SEQ1 steps: 1:30, 3, 10:10, 8      -> +30, +60, -37, -80 %
SEQ2 steps: 11, 1, 11:10, 1        -> -20, +20, -17, +20 %
RHYTHM: R1 9:10 (div 13) SEQ1; R2 12 (div 8) none; R3 ~9:20 (div 13) SEQ2; R4 12 none
TEMPO 10:10 (p .32); EG ON; PLAY on; SEQ OCT +-2; QUANTIZE 8-ET
VCO1: WAVE MIDDLE; FREQ 9:30 (p .25 = C5); SUB1 ~3:30 (div 3); SUB2 2 (div 5); ASSIGN OSC1
VCO2: WAVE MIDDLE; FREQ 10:30 (p .35 = F5); SUB1 ~3:30 (div 3); SUB2 1:30 (div 6); ASSIGN OSC2
LEVELS: all six 3 o'clock (80)
CUTOFF 2 (p .70); RES 10 (30); EG AMT ~3:10 (+63); VOLUME noon
VCF A 12 (p .50); VCF D 1 (p .60); VCA A 12 (p .50); VCA D ~1:10 (p .62)
CABLES: SEQ 1 out -> VCA in; VCF EG out -> RHYTHM 1 in; SEQ 2 out -> RHYTHM 3 in

# Manual patch sheets (black = lit; PLAY/EG never drawn lit -> assume EG ON + PLAY on, needed for sound). TEMPO linear CONFIRMED: TE Gate Patterns maps stock bpm linearly with 140 at centre => stock centre = 1510 BPM.
## M p.48 (PDF 47) "SPIRAL WAYS" (notes: tune seqs; VCO1 SUB1 to a fifth; VCO2 SUB2 to a major third; VCF ATTACK = crescendo depth)
SEQ1 steps: 1, 1, 11, 11           -> +20, +20, -20, -20 %
SEQ2 steps: 7, 10, ~7:10, 10       -> -100, -41, -97, -40 %
RHYTHM: R1 ~2:30 (div 5, boundary 4/5) SEQ1; R2 10 (div 12) SEQ2; R3 5 (div 1) none; R4 5 (div 1) none
TEMPO 12 (p .5 = 1510 BPM); SEQ OCT +-1; QUANTIZE 8-ET
VCO1: WAVE MIDDLE; FREQ 5 (fully CW = 4186); SUB1 ~1:10 (div 7, boundary -> 'fifth' = div 6); SUB2 12:30 (div 8); ASSIGN OSC1
VCO2: WAVE DOWN; FREQ 12 (1046.5); SUB1 ~4:20 (div 2); SUB2 ~2:10 (div 5, perform toward div 3 'major third'); ASSIGN OSC2
LEVELS: VCO1 1 (60), SUB1 1 (60), SUB2 1 (60); VCO2 ~1:20 (64), SUB1 5 (100), SUB2 5 (100)
CUTOFF ~8 (p .11 = 41 Hz); RES 10:20 (34); EG AMT ~3:40 (+73); VOLUME 5 (100)
VCF A 12 (p .5); VCF D ~8 (p .10); VCA A 7 (p 0); VCA D ~4:30 (p .95)
CABLES: VCF EG out -> RHYTHM 1 in

## M p.48 (PDF 47) "STAR-GATE" (notes: hi-octave seq pitches; R2-R4 SEQ 2 rates for percolating clusters; VCA DECAY; reset+play; perform on mixer levels)
SEQ1 steps: 1, 10, 9:30, 11:30     -> +20, -40, -50, -11 %
SEQ2 steps: 12:30, 12:30, 11, 9:30 -> +10, +9, -20, -50 %
RHYTHM: R1 ~3:20 (div 3) SEQ1; R2 12:20 (div 8) SEQ2; R3 1 (div 7) SEQ2; R4 11 (div 10) SEQ2
TEMPO ~2:10 (p .72 = 2160 BPM); SEQ OCT +-1; QUANTIZE 8-JI
VCO1: WAVE DOWN (saw); FREQ 5 (4186); SUB1 ~2:30 (div 5, boundary 4/5); SUB2 ~3:40 (div 3); ASSIGN OSC1 + SUB1 + SUB2
VCO2: WAVE UP (square); FREQ ~4:20 (p .93 = 3470 Hz); SUB1 ~1:10 (div 7); SUB2 ~7:40 (div 15); ASSIGN OSC2
LEVELS: VCO1 ~5 (99); SUB1 0, SUB2 0, VCO2 0, VCO2 SUB1 0, VCO2 SUB2 0 (all with 'perform' arcs: bring in and out)
CUTOFF ~10 (p .29 = 150 Hz); RES 7 (0); EG AMT 2 (+40); VOLUME 5 (100)
VCF A ~7:20 (p .04); VCF D ~4:20 (p .94); VCA A 7 (0); VCA D 5 (p 1.0, perform arc)
CABLES: SEQ 2 out -> VCO 1 PWM in; SEQ 1 out -> CUTOFF in

## M p.49 (PDF 48) "POLY ROCK" (EG + PLAY drawn lit; notes: tune seqs; subs to chord shapes; optional CLOCK OUT -> VCA IN for 'drums')
SEQ1 steps: ~7:10, 8:10, 8:10, ~7:10 -> -97, -79, -79, -100 %
SEQ2 steps: 1, 7:30, 11:30, 7:30     -> +21, -90, -11, -90 %
RHYTHM: R1 ~10:50 (div 10, boundary 10/11) SEQ1; R2 10 (div 12) SEQ2; R3 ~2:30 (div 5, boundary) SEQ1; R4 5 (div 1) none
TEMPO ~8:15 (p .12 = 387 BPM); SEQ OCT +-1; QUANTIZE 8-ET
VCO1: WAVE UP; FREQ ~1:40 (p .66 = 1650 Hz); SUB1 12:30 (div 8); SUB2 ~3:40 (div 3); ASSIGN OSC1
VCO2: WAVE UP; FREQ ~3:30 (p .85 = 2730 Hz); SUB1 ~1:10 (div 7, boundary 6/7); SUB2 ~10:50 (div 10); ASSIGN OSC2
LEVELS: VCO1 1 (60), SUB1 1 (60), SUB2 5 (100); VCO2 7 (0), SUB1 5 (100), SUB2 12:30 (55)
CUTOFF ~8 (p .11 = 41 Hz); RES 12 (50); EG AMT 10 (-41); VOLUME 5 (100)
VCF A 11:30 (p .45); VCF D 8:15 (p .12); VCA A 7 (0); VCA D 10:30 (p .34)
CABLES: VCA EG out -> CUTOFF in

## M p.49 (PDF 48) "CLOUD PATH" (notes: open VCO 1 LEVEL, tune SEQ 1, open VCO 2, tune SEQ 2, tune subs, volume 0, reset+play, slowly raise VCO 2 then subs; R3 SEQ 1 dotted = double time option)
SEQ1 steps: ~7:10, 9, 9, 8:10      -> -97, -60, -60, -78 %
SEQ2 steps: 10, 8, 8:40, 10        -> -41, -79, -68, -41 %
RHYTHM: R1 10 (div 12) SEQ1+SEQ2; R2 5 (div 1) none; R3 ~11:20 (div 10, boundary 9/10) [SEQ 1 optional, dotted]; R4 5 (div 1) none
TEMPO 12 (1510 BPM); SEQ OCT +-1; QUANTIZE 12-ET
VCO1: WAVE UP; FREQ ~2:30 (p .75 = 2104 -> C7); SUB1 ~2:30 (div 5, boundary 4/5); SUB2 ~4 (div 2); ASSIGN OSC1
VCO2: WAVE MIDDLE; FREQ ~1:15 (p .625 = 1480 = F#6); SUB1 ~4 (div 2); SUB2 ~1:10 (div 7); ASSIGN OSC2
LEVELS: VCO1 ~2:45 (78); VCO2 0, SUB levels all 0 (perform arcs: fade in)
CUTOFF 7 (0 = 20 Hz); RES ~11 (40); EG AMT ~11 (-21); VOLUME 5 (100)
VCF A ~3:10 (p .81 = 1.8 s); VCF D ~8:25 (p .14); VCA A ~2:05 (p .71 = 690 ms); VCA D ~12:50 (p .59 = 430 ms)
CABLES: VCA EG out -> CUTOFF in; VCF EG out -> RHYTHM 3 in

## M p.45 (PDF 44) "AQUATIC CHORDS" (EG drawn OFF, PLAY drawn ON; notes: seq pitches are suggestions)
SEQ1 steps: 10:20, 12:50, 9:40, 12   -> -33, +16, -48, 0 %
SEQ2 steps: 10:15, 7, 8:30, 9:50     -> -35, -100, -70, -44 %
RHYTHM: R1 ~2:45 (div 4) SEQ1; R2 ~2:15 (div 5) SEQ2; R3 5 (div 1) none; R4 5 (div 1) none
TEMPO ~8:30 (p .15 = 461 BPM); EG OFF (CLOCK -> TRIGGER fires the EGs every pulse); SEQ OCT +-1; QUANTIZE 8-ET
VCO1: WAVE DOWN (saw); FREQ 1:15 (p .63); SUB1 ~2:15 (div 5); SUB2 ~2:45 (div 4); ASSIGN OSC1
VCO2: WAVE UP (square); FREQ 12 (C6); SUB1 ~11:40 (div 9); SUB2 ~3 (div 4, boundary 3/4); ASSIGN OSC2
LEVELS: VCO1 11:35 (46), SUB1 12:25 (54), SUB2 12:25 (54); VCO2 12:35 (56), SUB1 11:40 (47), SUB2 12 (50)
CUTOFF 10 (p .29 = 152 Hz); RES 9:30 (25); EG AMT ~2:30 (+49); VOLUME 5 (100)
VCF A ~10:15 (p .32); VCF D ~8:50 (p .18); VCA A 7 (0); VCA D 10:25 (p .34)
CABLES: SEQ 1 out -> CUTOFF in; CLOCK out -> TRIGGER in

## M p.45 (PDF 44) "MELLOW HARMONIES" (EG drawn OFF, PLAY ON; SUB levels drawn with two-way 'perform' arcs, no pointer)
SEQ1 steps: 9:25, 12:10, 1:35, 9:55  -> -51, +4, +31, -42 %
SEQ2 steps: 9:15, 10:35, 8:15, 10:10 -> -54, -29, -75, -37 %
RHYTHM: R1 5 (div 1) SEQ1; R2 12:20 (div 8) SEQ2; R3 5 none; R4 5 none
TEMPO ~8:35 (p .155 = 482 BPM); EG OFF (SEQ 1 CLK -> TRIGGER: only seq 1 steps fire the EGs); SEQ OCT +-1; QUANTIZE 8-ET
VCO1: WAVE DOWN; FREQ 1:20 (p .63); SUB1 ~2:15 (div 5); SUB2 ~2:40 (div 4); ASSIGN OSC1
VCO2: WAVE UP; FREQ 12 (C6); SUB1 ~3:30 (div 3); SUB2 ~1:40 (div 6); ASSIGN OSC2
LEVELS: VCO1 12 (50), VCO2 12 (50); four SUB levels: perform (use ~50)
CUTOFF 9 (p .2 = 80 Hz); RES 7 (0); EG AMT ~2:30 (+50); VOLUME 5 (100)
VCF A ~9:10 (p .22); VCF D ~8:30 (p .15); VCA A 7 (0); VCA D ~9:50 (p .28)
CABLES: SEQ 1 out -> CUTOFF in; SEQ 1 CLK out -> TRIGGER in

## M p.46 (PDF 45) "SLIP & FALL" (EG drawn OFF, PLAY ON; FIVE cables)
SEQ1 steps: 1:35, 10:05, 11:30, 11   -> +31, -38, -11, -20 %
SEQ2 steps: 9:25, 11:05, 9, 1:30     -> -52, -19, -60, +29 %
RHYTHM: R1 12:40 (div 7, boundary 7/8) SEQ1; R2 11:25 (div 9, boundary 9/10) SEQ2; R3 5 none; R4 5 none
TEMPO 11:10 (p .42 = 1263 BPM); EG OFF (SEQ 1 CLK -> TRIGGER); SEQ OCT +-1; QUANTIZE 8-JI
VCO1: WAVE UP; FREQ 5 (4186); SUB1 1:30 (div 6); SUB2 12:35 (div 8); ASSIGN OSC1
VCO2: WAVE UP; FREQ 12 (C6); SUB1 ~3:20 (div 3); SUB2 ~3:05 (div 4, boundary 3/4); ASSIGN OSC2
LEVELS: VCO1 2 (70), SUB1 7 (0), SUB2 12:35 (56); VCO2 2 (70), SUB1 7 (0), SUB2 ~4 (90)
CUTOFF ~1:50 (p .69 = 2.3 kHz); RES ~8:45 (17); EG AMT ~2:40 (+53); VOLUME 5 (100)
VCF A ~2:10 (p .72 = 750 ms); VCF D 7 (5 ms); VCA A 11:40 (p .47 = 74 ms); VCA D 7 (5 ms)
CABLES: SEQ 2 out -> VCO 1 in; SEQ 1 out -> VCO 2 in; VCA EG out -> RHYTHM 2 in; VCF EG out -> RHYTHM 1 in; SEQ 1 CLK out -> TRIGGER in

## M p.46 (PDF 45) "POINT ZERO" (EG ON, PLAY ON drawn; notes: tune seqs; tune subs to an interval; VCF ATTACK = sweep length)
SEQ1 steps: 10, 10, 7, 7             -> -40, -40, -100, -100 %
SEQ2 steps: 10, 11, 7:30, 8:05       -> -40, -20, -90, -78 %
RHYTHM: R1 ~3:20 (div 3) SEQ1; R2 12:20 (div 8) SEQ2; R3 5 none; R4 5 none
TEMPO ~9:30 (p .25 = 759 BPM); EG ON; SEQ OCT +-2; QUANTIZE 8-ET
VCO1: WAVE UP; FREQ ~1:40 (p .66); SUB1 ~1:50 (div 6, boundary 5/6); SUB2 ~3:25 (div 3); ASSIGN OSC1
VCO2: WAVE DOWN; FREQ ~1:40 (p .66); SUB1 ~5 (div 1); SUB2 ~2:10 (div 5); ASSIGN OSC2
LEVELS: VCO1 5 (99), SUB1 5 (99), SUB2 11 (41); VCO2 5 (100), SUB1 5 (100), SUB2 5 (100)
CUTOFF 9 (80 Hz); RES 11 (40); EG AMT 3 (+60); VOLUME 5 (100)
VCF A 1:30 (p .65 = 410 ms); VCF D 9:25 (p .24); VCA A 7 (0); VCA D ~4:25 (p .94)
CABLES: SEQ 1 out -> VCO 1 PWM in; SEQ 2 out -> CUTOFF in

## M p.47 (PDF 46) "THREE HANDS ON THE WHEEL" (EG ON, PLAY ON drawn; notes: seq pitches are suggestions)
SEQ1 steps: 9:20, 12:20, 1:30, 11    -> -53, +8, +30, -20 %
SEQ2 steps: 9:30, 1:30, 10:25, 8:30  -> -50, +30, -31, -70 %
RHYTHM: R1 9:15 (div 13) SEQ1; R2 1:30 (div 6) SEQ2; R3 5 none; R4 5 none
TEMPO ~1:20 (p .63 = 1900 BPM); EG ON; SEQ OCT +-2; QUANTIZE 8-ET
VCO1: WAVE UP; FREQ 12 (C6); SUB1 5 (div 1); SUB2 5 (div 1); ASSIGN none (VCO 1 silent: levels 0)
VCO2: WAVE DOWN; FREQ 12 (C6); SUB1 ~3:45 (div 3, boundary 2/3); SUB2 ~2:45 (div 4); ASSIGN OSC2
LEVELS: VCO1 0, SUB1 0, SUB2 0; VCO2 ~4 (90), SUB1 ~2:10 (72), SUB2 perform (~50)
CUTOFF ~8:50 (p .18 = 70 Hz); RES 11:30 (45); EG AMT ~2:10 (+43, perform toward +); VOLUME 5 (100)
VCF A 7 (1 ms); VCF D 10:25 (p .34); VCA A 7 (1 ms); VCA D 9:25 (p .24)
CABLES: SEQ 1 out -> VCO 2 in (adds to SEQ 2 via OSC 2); SEQ 2 out -> CUTOFF in

## M p.47 (PDF 46) "BATERIA" (EG ON, PLAY ON drawn; notes: kick tuning = CUTOFF; VCF DECAY + EG AMT for flavours)
SEQ1 steps: 7, 11, 5, 12:30          -> -100, -20, +100, +10 %
SEQ2 steps: 5, 1:25, 9:40, 1         -> +100, +28, -47, +20 %
RHYTHM: R1 12:20 (div 8) SEQ1; R2 ~2:45 (div 4) SEQ2; R3 5 (div 1) none; R4 7 (div 16) SEQ1
TEMPO ~8:55 (p .19 = 583 BPM); EG ON; SEQ OCT +-1; QUANTIZE 12-ET
VCO1: WAVE MIDDLE; FREQ ~1:55 (p .69); SUB1 5 (div 1); SUB2 5 (div 1); ASSIGN none
VCO2: WAVE MIDDLE; FREQ 12 (C6); SUB1 5 (div 1); SUB2 5 (div 1); ASSIGN none
LEVELS: all six 0 (the sound is the self-oscillating filter)
CUTOFF 9 (80 Hz); RES 5 (100); EG AMT 1 (+20); VOLUME 5 (100)
VCF A 7 (1 ms); VCF D ~8:50 (p .18 = 20 ms); VCA A 7 (1 ms); VCA D 11:30 (p .45 = 150 ms)
CABLES: SEQ 1 out -> RHYTHM 1 in; SEQ 2 out -> RHYTHM 2 in; SEQ 1 CLK out -> CUTOFF in; SEQ 2 CLK out -> VCA in

## PWI p.3 "Initialized Patch" (orange = lit)
STEPS: all 8 at noon (0). RHYTHM 1-4 fully CW (div 1), no SEQ buttons lit. TEMPO noon (1510 BPM; exercises turn it to ~9 o'clock = 616 BPM).
EG ON, PLAY ON. SEQ OCT +-5. QUANTIZE off.
VCO1: WAVE UP; FREQ noon (C6); SUB1 + SUB2 fully CW (div 1); ASSIGN none.  VCO2 same (WAVE UP, FREQ noon, subs div 1, no assign).
LEVELS: VCO1 noon (50); all others 0.
CUTOFF 3 o'clock (p .8 = 5 kHz); RES ~7:20 (0-3); EG AMT 3 o'clock (+60); VOLUME noon (50)
VCF A ~7:20 (1 ms); VCF D ~9:20 (p .23 = 29 ms); VCA A ~7:20 (1 ms); VCA D ~9:20 (29 ms). No cables.
Panel facts from the drawings: 8 screws: top x ~ 5.8, 76, 217, 298 mm; bottom x ~ 5.8, 116.5, 217, 298 mm (3 mm from the edges); moog logo bottom centre ~x 151; nameplate SUBHARMONICON from x ~32 then a bar and the two-line subtitle SEMI-MODULAR ANALOG / POLYRHYTHMIC SYNTHESIZER to x ~110; MIDI LED left of the MIDI IN label; vertical divider at the panel centre broken by SEQ OCT and QUANTIZE groups; rhythm knobs joined to their SEQ 1/SEQ 2 buttons by short vertical lines.
