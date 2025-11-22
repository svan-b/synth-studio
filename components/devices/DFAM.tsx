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

        {/* TOP ROW: Oscillators (y=60px) */}
        {/* VCO 1 GROUP */}
        <div style={{ position: 'absolute', left: '40px', top: '40px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>VCO 1</label>
          <KnobNoValue {...getControlProps('vco1_frequency')} size={45} />
        </div>
        <div style={{ position: 'absolute', left: '40px', top: '100px' }}>
          <SwitchCompact {...getControlProps('vco1_wave')} />
        </div>
        <div style={{ position: 'absolute', left: '100px', top: '50px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>EG AMT</label>
          <KnobNoValue {...getControlProps('vco1_eg')} size={35} bipolar />
        </div>

        {/* 1→2 FM */}
        <div style={{ position: 'absolute', left: '150px', top: '60px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>1→2 FM</label>
          <KnobNoValue {...getControlProps('fm_amount')} size={35} />
        </div>

        {/* VCO 2 GROUP */}
        <div style={{ position: 'absolute', left: '200px', top: '40px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>VCO 2</label>
          <KnobNoValue {...getControlProps('vco2_frequency')} size={45} />
        </div>
        <div style={{ position: 'absolute', left: '200px', top: '100px' }}>
          <SwitchCompact {...getControlProps('vco2_wave')} />
        </div>
        <div style={{ position: 'absolute', left: '260px', top: '50px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>EG AMT</label>
          <KnobNoValue {...getControlProps('vco2_eg')} size={35} bipolar />
        </div>

        {/* HARD SYNC */}
        <div style={{ position: 'absolute', left: '310px', top: '70px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>SYNC</label>
          <SwitchCompact {...getControlProps('hard_sync')} />
        </div>

        {/* FILTER SECTION (center) */}
        <div style={{ position: 'absolute', left: '380px', top: '35px' }}>
          <label style={{ fontSize: '7px', color: '#888', position: 'absolute', top: '-15px' }}>FILTER</label>
          <KnobNoValue {...getControlProps('vcf_cutoff')} size={55} />
        </div>
        <div style={{ position: 'absolute', left: '450px', top: '45px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>RES</label>
          <KnobNoValue {...getControlProps('vcf_resonance')} size={40} />
        </div>
        <div style={{ position: 'absolute', left: '500px', top: '45px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>EG AMT</label>
          <KnobNoValue {...getControlProps('vcf_eg')} size={40} bipolar />
        </div>
        <div style={{ position: 'absolute', left: '450px', top: '100px' }}>
          <SwitchCompact {...getControlProps('vcf_mode')} />
        </div>
        <div style={{ position: 'absolute', left: '500px', top: '95px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>MOD</label>
          <KnobNoValue {...getControlProps('noise_vcf_mod')} size={30} />
        </div>

        {/* VCA SECTION */}
        <div style={{ position: 'absolute', left: '580px', top: '45px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>VCA DEC</label>
          <KnobNoValue {...getControlProps('vca_decay')} size={40} />
        </div>
        <div style={{ position: 'absolute', left: '630px', top: '45px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>VCA EG</label>
          <KnobNoValue {...getControlProps('vca_eg')} size={40} />
        </div>
        <div style={{ position: 'absolute', left: '680px', top: '45px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>LEVEL</label>
          <KnobNoValue {...getControlProps('vca_level')} size={40} />
        </div>

        {/* MIDDLE ROW: Mixer & Decay (y=150px) */}
        <div style={{ position: 'absolute', left: '40px', top: '150px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>VCO 1</label>
          <KnobNoValue {...getControlProps('vco1_level')} size={40} />
        </div>
        <div style={{ position: 'absolute', left: '90px', top: '150px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>NOISE</label>
          <KnobNoValue {...getControlProps('noise')} size={40} />
        </div>
        <div style={{ position: 'absolute', left: '140px', top: '150px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>VCO 2</label>
          <KnobNoValue {...getControlProps('vco2_level')} size={40} />
        </div>

        {/* TEMPO */}
        <div style={{ position: 'absolute', left: '220px', top: '145px' }}>
          <label style={{ fontSize: '7px', color: '#888', position: 'absolute', top: '-15px' }}>TEMPO</label>
          <KnobNoValue {...getControlProps('tempo')} size={55} />
        </div>

        {/* Decay knobs */}
        <div style={{ position: 'absolute', left: '40px', top: '210px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>VCO DEC</label>
          <KnobNoValue {...getControlProps('vco_decay')} size={35} />
        </div>
        <div style={{ position: 'absolute', left: '90px', top: '210px' }}>
          <label style={{ fontSize: '6px', color: '#666', position: 'absolute', top: '-12px' }}>VCF DEC</label>
          <KnobNoValue {...getControlProps('vcf_decay')} size={35} />
        </div>

        {/* SEQUENCER - Tight grid! */}
        <div style={{ position: 'absolute', left: '320px', top: '160px' }}>
          <div style={{ fontSize: '7px', color: '#888', marginBottom: '8px' }}>SEQUENCER</div>

          {/* Step numbers */}
          <div style={{ display: 'flex', gap: '22px', marginBottom: '4px', paddingLeft: '11px' }}>
            {[1,2,3,4,5,6,7,8].map(n => (
              <div key={n} style={{ fontSize: '6px', color: '#666', width: '20px', textAlign: 'center' }}>{n}</div>
            ))}
          </div>

          {/* PITCH row - TIGHT spacing! */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
            {[1,2,3,4,5,6,7,8].map(i => (
              <KnobNoValue key={`p${i}`} {...getControlProps(`pitch${i}`)} size={20} />
            ))}
          </div>

          {/* VELOCITY row - TIGHT spacing! */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {[1,2,3,4,5,6,7,8].map(i => (
              <KnobNoValue key={`v${i}`} {...getControlProps(`velocity${i}`)} size={20} />
            ))}
          </div>
        </div>

        {/* Transport buttons */}
        <div style={{ position: 'absolute', left: '220px', top: '250px' }}>
          <ButtonCompact {...getControlProps('run_stop')} red />
        </div>
        <div style={{ position: 'absolute', left: '220px', top: '290px' }}>
          <ButtonCompact {...getControlProps('advance')} />
        </div>

        {/* PATCH BAY - 3×8 grid on right */}
        <div style={{
          position: 'absolute',
          right: '20px',
          top: '30px',
          width: '150px',
          height: '290px',
          background: '#0d0d0d',
          borderRadius: '4px',
          padding: '10px',
        }}>
          <div style={{ fontSize: '6px', color: '#888', marginBottom: '8px', textAlign: 'center' }}>PATCH BAY</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(8, 1fr)',
            gap: '8px',
          }}>
            {/* All 24 jacks in tight 3×8 grid */}
            {[...Array(24)].map((_, i) => (
              <JackCompact key={i} />
            ))}
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
        transform: `translateX(-50%) rotate(${-135 + (value * 270)}deg)`,
      }} />
    </div>
  );
}

// Compact button
function ButtonCompact({ value, onChange, red = false }: any) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        background: red ? (value ? '#ff0000' : '#400000') : (value ? '#00ff00' : '#004000'),
        border: '2px solid #333',
        cursor: 'pointer',
      }}
    />
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

// Compact jack
function JackCompact() {
  return (
    <div style={{
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      background: '#000',
      border: '2px solid #444',
      margin: '0 auto',
    }} />
  );
}
