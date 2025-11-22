'use client';

import { useStudioStore } from '@/store/studio';
import { DFAM_SPEC } from '@/data/dfam';

export default function DFAM() {
  const { setControlValue, getControlValue } = useStudioStore();
  const device = 'DFAM';

  const handleControlChange = (controlId: string, value: any) => {
    setControlValue(device, controlId, value);
  };

  const getControlProps = (controlId: string) => {
    const value = getControlValue(device, controlId) ?? 0;
    return {
      id: controlId,
      value,
      onChange: (v: any) => handleControlChange(controlId, v),
    };
  };

  return (
    <div style={{
      width: '1080px',
      margin: '0 auto',
      background: '#0a0a0a',
      padding: '20px',
    }}>
      {/* Fixed size panel */}
      <div style={{
        width: '980px',
        height: '350px',
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)',
        border: '2px solid #2a2a2a',
        borderRadius: '4px',
        position: 'relative',
        margin: '0 auto',
      }}>

        {/* TOP ROW - OSCILLATORS */}

        {/* 1. VCO DECAY */}
        <div style={{ position: 'absolute', left: '40px', top: '50px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>VCO DECAY</label>
          <KnobNoValue {...getControlProps('vco_decay')} size={40} />
        </div>

        {/* 2. VCO 1 EG AMOUNT */}
        <div style={{ position: 'absolute', left: '90px', top: '50px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>VCO 1 EG AMT</label>
          <KnobNoValue {...getControlProps('vco1_eg')} size={40} bipolar />
        </div>

        {/* 3. SEQ PITCH MOD selector */}
        <div style={{ position: 'absolute', left: '90px', top: '105px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>SEQ PITCH MOD</label>
          <Switch3Way {...getControlProps('seq_pitch_mod')} />
        </div>

        {/* 4. VCO 1 FREQUENCY */}
        <div style={{ position: 'absolute', left: '140px', top: '50px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>VCO 1 FREQ</label>
          <KnobNoValue {...getControlProps('vco1_frequency')} size={40} bipolar />
        </div>

        {/* 5. VCO 1 WAVE */}
        <div style={{ position: 'absolute', left: '140px', top: '105px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>WAVE</label>
          <SwitchCompact {...getControlProps('vco1_wave')} />
        </div>

        {/* 6. 1→2 FM AMOUNT */}
        <div style={{ position: 'absolute', left: '190px', top: '50px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>1→2 FM AMT</label>
          <KnobNoValue {...getControlProps('fm_amount')} size={40} />
        </div>

        {/* 7. VCO 2 EG AMOUNT */}
        <div style={{ position: 'absolute', left: '240px', top: '50px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>VCO 2 EG AMT</label>
          <KnobNoValue {...getControlProps('vco2_eg')} size={40} bipolar />
        </div>

        {/* 8. VCO 2 FREQUENCY */}
        <div style={{ position: 'absolute', left: '290px', top: '50px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>VCO 2 FREQ</label>
          <KnobNoValue {...getControlProps('vco2_frequency')} size={40} bipolar />
        </div>

        {/* 9. VCO 2 WAVE */}
        <div style={{ position: 'absolute', left: '290px', top: '105px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>WAVE</label>
          <SwitchCompact {...getControlProps('vco2_wave')} />
        </div>

        {/* 10. HARD SYNC */}
        <div style={{ position: 'absolute', left: '340px', top: '70px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>HARD SYNC</label>
          <SwitchCompact {...getControlProps('hard_sync')} />
        </div>

        {/* MIDDLE SECTION - MIXER, FILTER & VCA */}

        {/* 11. VCO 1 LEVEL */}
        <div style={{ position: 'absolute', left: '380px', top: '70px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCO 1</label>
          <KnobNoValue {...getControlProps('vco1_level')} size={30} />
        </div>

        {/* 12. NOISE/EXT LEVEL */}
        <div style={{ position: 'absolute', left: '420px', top: '70px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>NOISE</label>
          <KnobNoValue {...getControlProps('noise')} size={30} />
        </div>

        {/* 13. VCO 2 LEVEL */}
        <div style={{ position: 'absolute', left: '460px', top: '70px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCO 2</label>
          <KnobNoValue {...getControlProps('vco2_level')} size={30} />
        </div>

        {/* 14. VCF (FILTER) SECTION */}
        <div style={{ position: 'absolute', left: '520px', top: '50px' }}>
          <label style={{ fontSize: '7px', color: '#888', position: 'absolute', top: '-15px', whiteSpace: 'nowrap' }}>CUTOFF</label>
          <KnobNoValue {...getControlProps('vcf_cutoff')} size={55} />
        </div>
        <div style={{ position: 'absolute', left: '590px', top: '50px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>RESONANCE</label>
          <KnobNoValue {...getControlProps('vcf_resonance')} size={40} />
        </div>
        <div style={{ position: 'absolute', left: '640px', top: '50px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>VCF EG AMT</label>
          <KnobNoValue {...getControlProps('vcf_eg')} size={40} bipolar />
        </div>
        <div style={{ position: 'absolute', left: '590px', top: '115px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCF MODE</label>
          <SwitchCompact {...getControlProps('vcf_mode')} />
        </div>
        <div style={{ position: 'absolute', left: '520px', top: '125px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCF DECAY</label>
          <KnobNoValue {...getControlProps('vcf_decay')} size={30} />
        </div>
        <div style={{ position: 'absolute', left: '640px', top: '125px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>NOISE MOD</label>
          <KnobNoValue {...getControlProps('noise_vcf_mod')} size={30} />
        </div>

        {/* 15. VCA SECTION */}
        <div style={{ position: 'absolute', left: '700px', top: '50px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCA EG</label>
          <SwitchCompact {...getControlProps('vca_eg')} />
        </div>
        <div style={{ position: 'absolute', left: '700px', top: '105px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCA DECAY</label>
          <KnobNoValue {...getControlProps('vca_decay')} size={30} />
        </div>
        <div style={{ position: 'absolute', left: '750px', top: '70px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>VOLUME</label>
          <KnobNoValue {...getControlProps('vca_level')} size={40} />
        </div>

        {/* BOTTOM LEFT - TEMPO & TRANSPORT */}

        {/* 16. TEMPO */}
        <div style={{ position: 'absolute', left: '100px', top: '180px' }}>
          <label style={{ fontSize: '7px', color: '#888', position: 'absolute', top: '-15px', whiteSpace: 'nowrap' }}>TEMPO</label>
          <KnobNoValue {...getControlProps('tempo')} size={55} />
        </div>

        {/* 17. TRIGGER button */}
        <div style={{ position: 'absolute', left: '40px', top: '180px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>TRIGGER</label>
          <ButtonCompact {...getControlProps('trigger')} momentary gray />
        </div>

        {/* 18. RUN/STOP */}
        <div style={{ position: 'absolute', left: '40px', top: '230px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>RUN/STOP</label>
          <ButtonCompact {...getControlProps('run_stop')} red />
        </div>

        {/* 19. ADVANCE */}
        <div style={{ position: 'absolute', left: '100px', top: '230px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>ADVANCE</label>
          <ButtonCompact {...getControlProps('advance')} momentary />
        </div>

        {/* SEQUENCER SECTION */}
        <div style={{ position: 'absolute', left: '250px', top: '180px' }}>
          <div style={{ fontSize: '7px', color: '#888', marginBottom: '12px' }}>SEQUENCER</div>

          {/* Step numbers */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
            {[1,2,3,4,5,6,7,8].map(n => (
              <div key={n} style={{ fontSize: '6px', color: '#666', width: '25px', textAlign: 'center' }}>{n}</div>
            ))}
          </div>

          {/* PITCH row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={`p${i}`} style={{ textAlign: 'center' }}>
                <KnobNoValue {...getControlProps(`pitch${i}`)} size={25} bipolar />
              </div>
            ))}
          </div>

          {/* VELOCITY row */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={`v${i}`} style={{ textAlign: 'center' }}>
                <KnobNoValue {...getControlProps(`velocity${i}`)} size={25} />
              </div>
            ))}
          </div>

          {/* Row labels */}
          <div style={{ position: 'absolute', left: '-35px', top: '20px', fontSize: '5px', color: '#666' }}>PITCH</div>
          <div style={{ position: 'absolute', left: '-35px', top: '60px', fontSize: '5px', color: '#666' }}>VEL</div>
        </div>

        {/* PATCH BAY - 3 columns × 8 rows */}
        <div style={{
          position: 'absolute',
          right: '15px',
          top: '30px',
          width: '170px',
          height: '300px',
          background: '#0d0d0d',
          borderRadius: '4px',
          padding: '10px',
        }}>
          <div style={{ fontSize: '6px', color: '#888', marginBottom: '10px', textAlign: 'center' }}>PATCH BAY</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(8, 1fr)',
            gap: '6px 4px',
          }}>
            {/* Column 1 - Inputs */}
            <JackLabeled label="TRIG" />
            <JackLabeled label="VCA CV" />
            <JackLabeled label="VEL" />
            <JackLabeled label="VCA DEC" />
            <JackLabeled label="EXT IN" />
            <JackLabeled label="VCF DEC" />
            <JackLabeled label="NOISE" />
            <JackLabeled label="VCO DEC" />

            {/* Column 2 - More Inputs */}
            <JackLabeled label="VCF MOD" />
            <JackLabeled label="VCO 1 CV" />
            <JackLabeled label="VCO 2 CV" />
            <JackLabeled label="TEMPO" />
            <JackLabeled label="RUN/STP" />
            <JackLabeled label="ADV/CLK" />
            <JackLabeled label="VCA" />
            <JackLabeled label="VCO 1" />

            {/* Column 3 - Outputs */}
            <JackLabeled label="VCO 2" />
            <JackLabeled label="PITCH" />
            <JackLabeled label="VCA EG" />
            <JackLabeled label="VCF EG" />
            <JackLabeled label="VCO EG" />
            <JackLabeled label="" />
            <JackLabeled label="" />
            <JackLabeled label="" />
          </div>
        </div>

        {/* Logo */}
        <div style={{ position: 'absolute', bottom: '10px', left: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ccc' }}>DFAM</div>
          <div style={{ fontSize: '5px', color: '#666' }}>DRUMMER FROM ANOTHER MOTHER</div>
        </div>
      </div>
    </div>
  );
}

// Simplified Knob without value display
function KnobNoValue({ value, onChange, size = 40, bipolar = false }: any) {
  const handleMouseDown = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startValue = value;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = (startY - e.clientY) / 100;
      const newValue = Math.max(0, Math.min(1, startValue + delta));
      onChange(newValue);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Bipolar knobs center at 0.5
  const rotation = bipolar
    ? -135 + ((value - 0.5) * 2 * 135) // -135° to +135° centered at 0.5
    : -135 + (value * 270); // -135° to +135° from 0 to 1

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
        border: '2px solid #333',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {/* Pointer */}
      <div style={{
        position: 'absolute',
        top: '3px',
        left: '50%',
        width: '2px',
        height: `${size * 0.3}px`,
        background: '#0f0',
        transformOrigin: `center ${size/2 - 3}px`,
        transform: `translateX(-50%) rotate(${rotation}deg)`,
      }} />

      {/* Center dot for bipolar */}
      {bipolar && (
        <div style={{
          position: 'absolute',
          bottom: '2px',
          left: '50%',
          width: '3px',
          height: '3px',
          background: '#666',
          borderRadius: '50%',
          transform: 'translateX(-50%)',
        }} />
      )}
    </div>
  );
}

// Compact button with variants
function ButtonCompact({ value, onChange, red = false, momentary = false, gray = false }: any) {
  const handleClick = () => {
    if (momentary) {
      onChange(true);
      setTimeout(() => onChange(false), 100);
    } else {
      onChange(!value);
    }
  };

  let bgColor;
  if (gray) {
    bgColor = value ? '#888' : '#333';
  } else if (red) {
    bgColor = value ? '#ff0000' : '#400000';
  } else {
    bgColor = value ? '#00ff00' : '#004000';
  }

  return (
    <button
      onClick={handleClick}
      style={{
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        background: bgColor,
        border: '2px solid #333',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* LED indicator for toggle buttons */}
      {!momentary && value && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: red ? '#ff6666' : '#66ff66',
          boxShadow: `0 0 6px ${red ? '#ff0000' : '#00ff00'}`,
        }} />
      )}
    </button>
  );
}

// Compact switch
function SwitchCompact({ value, onChange }: any) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: '20px',
        height: '30px',
        background: '#1a1a1a',
        border: '2px solid #333',
        borderRadius: '4px',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: '12px',
        height: '6px',
        background: value ? '#0f0' : '#333',
        position: 'absolute',
        left: '50%',
        top: value ? '4px' : '18px',
        transform: 'translateX(-50%)',
        borderRadius: '2px',
        transition: 'all 0.2s',
      }} />
    </button>
  );
}

// 3-way switch for SEQ PITCH MOD
function Switch3Way({ value, onChange }: any) {
  const position = value || 0; // 0, 1, or 2

  return (
    <button
      onClick={() => onChange((position + 1) % 3)}
      style={{
        width: '20px',
        height: '36px',
        background: '#1a1a1a',
        border: '2px solid #333',
        borderRadius: '4px',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: '12px',
        height: '6px',
        background: '#0f0',
        position: 'absolute',
        left: '50%',
        top: position === 0 ? '4px' : position === 1 ? '14px' : '24px',
        transform: 'translateX(-50%)',
        borderRadius: '2px',
        transition: 'all 0.2s',
      }} />
    </button>
  );
}

// Jack with label
function JackLabeled({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <div style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: '#000',
        border: '2px solid #444',
      }} />
      <div style={{
        fontSize: '4px',
        color: '#666',
        textAlign: 'center',
        lineHeight: '1',
        maxWidth: '40px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
    </div>
  );
}
