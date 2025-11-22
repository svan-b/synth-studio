# Synth Studio

**Digital Twin Learning System for Hardware Synthesizers**

Pixel-perfect digital replicas of hardware synthesizers with real-time teaching indicators and step-by-step lessons.

## 🎯 Features

### Exact Hardware Replicas
- Every knob, slider, and button positioned exactly as on real hardware
- Real hardware units: Hz, ms, octaves, semitones, cents, dB, steps
- LED-style value displays showing current settings
- 3D knobs with realistic shadows and indicators
- All specifications verified from official manufacturer manuals

### Teaching System
- **Green outline with pulse** = Adjust this control now
- **Target indicators** = Shows where to turn the knob
- **Auto-step advance** = Automatically moves to next step when correct
- **Progress tracking** = Visual progress bar and step completion
- **Manual references** = Direct links to official documentation

### Currently Implemented
- **Moog DFAM** (fully implemented)
  - 20+ controls with exact specifications
  - 3 complete lessons: Classic 909 Kick, 808 Sub Kick, Snappy Snare
  - All specs from [official DFAM manual](https://api.moogmusic.com/sites/default/files/2018-04/DFAM_Manual.pdf)

### Coming Soon
- Moog Mother-32
- Moog Subharmonicon
- Elektron Analog Four MKII
- Elektron Analog Rytm MKII
- Moog Sub 37
- Allen & Heath Xone:96

## 🚀 Tech Stack

- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand with persistence
- **UI Components:** Radix UI for accessibility
- **Deployment:** Vercel

## 📦 Installation

```bash
npm install
```

## 🛠️ Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗️ Build

```bash
npm run build
npm run start
```

## 📖 Usage

1. **Select a device** from the dropdown (currently only DFAM available)
2. **Click "Start Lesson"** to choose from available lessons
3. **Follow the instructions** in the sidebar
4. **Adjust controls** to match target values (green indicators show which control)
5. **System auto-advances** when you get close enough (5% tolerance)
6. **Complete all steps** to finish the lesson

### Laptop-Beside-Hardware Workflow
- Open the app on your laptop next to your physical hardware
- Match the digital twin controls to your hardware settings
- Learn exact values instead of guessing knob positions
- Build muscle memory for classic sounds

## 🎛️ Component Architecture

```
/components
  /controls
    - Knob.tsx         # Rotary controls with teaching indicators
    - Button.tsx       # Buttons with LED indicators
    - Switch.tsx       # Multi-position switches
  /devices
    - DFAM.tsx         # Complete DFAM digital twin
  /teaching
    - Indicator.tsx    # Visual teaching hints
    - Instructions.tsx # Step-by-step sidebar
```

## 📊 Data Structure

All device specifications stored in `/data`:
- Hardware-accurate control ranges
- Real units (Hz, ms, octaves, etc.)
- Preset patches from official manuals
- Lesson steps with target values

## 🎨 Design Principles

### Hardware Accuracy
- Exact control positions from panel layouts
- Real value ranges from official specifications
- Authentic LED colors and panel aesthetics
- 3D knobs with realistic shadows

### Teaching Clarity
- Subtle indicators (outlines, not animations)
- Clear target values shown
- Progress tracking
- Source attribution for all lessons

### Pixel-Perfect Layout
- CSS Grid and absolute positioning for exact placement
- Responsive scaling maintains aspect ratio
- Touch-friendly on tablets
- Minimum 1024px width for usability

## 🔗 References

### Moog DFAM
- [Official Manual PDF](https://api.moogmusic.com/sites/default/files/2018-04/DFAM_Manual.pdf)
- Tempo Range: 10-300 BPM (0.7Hz - 700Hz capable)
- VCO Range: ±5 octaves (10 octave range total)
- Filter: 4-pole Moog Ladder (LP/HP switchable)

### Specifications Sources
- [Moog Music Official Site](https://www.moogmusic.com)
- [Elektron Official Site](https://www.elektron.se)
- [ManualsLib](https://www.manualslib.com)

## 📝 License

For educational and learning purposes.

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Additional device implementations
- More lessons for existing devices
- Audio synthesis capabilities
- Mobile responsive optimizations

---

**Built with precision • Verified from official manuals • Optimized for learning**
