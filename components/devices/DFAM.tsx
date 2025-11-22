'use client';

import { useStudioStore } from '@/store/studio';
import { DFAM_SPEC } from '@/data/dfam';
import PatchBay from '@/components/controls/PatchBay';

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
      position: 'relative',
    }}>
      {/* Wooden Side Cheeks */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[30px] rounded-l-lg"
        style={{
          background: 'linear-gradient(90deg, #5C4033 0%, #6F5645 50%, #5C4033 100%)',
          boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.3), inset 2px 0 4px rgba(255,255,255,0.1)',
          height: '390px',
          marginTop: '20px',
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-[30px] rounded-r-lg"
        style={{
          background: 'linear-gradient(90deg, #5C4033 0%, #6F5645 50%, #5C4033 100%)',
          boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.3), inset -2px 0 4px rgba(255,255,255,0.1)',
          height: '390px',
          marginTop: '20px',
        }}
      />

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

        {/* TOP ROW - OSCILLATORS - PROPERLY GROUPED */}

        {/* VCO DECAY - Standalone */}
        <div style={{ position: 'absolute', left: '60px', top: '60px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCO DECAY</label>
          <KnobNoValue {...getControlProps('vco_decay')} size={35} />
        </div>

        {/* VCO 1 GROUP */}
        <div style={{ position: 'absolute', left: '130px', top: '60px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCO 1 EG AMT</label>
          <KnobNoValue {...getControlProps('vco1_eg')} size={35} bipolar />
        </div>
        <div style={{ position: 'absolute', left: '180px', top: '60px' }}>
          <label style={{ fontSize: '6px', color: '#888', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>VCO 1 FREQ</label>
          <KnobNoValue {...getControlProps('vco1_frequency')} size={45} bipolar />
        </div>
        <div style={{ position: 'absolute', left: '180px', top: '120px' }}>
          <label style={{ fontSize: '4px', color: '#666', position: 'absolute', top: '-8px', whiteSpace: 'nowrap' }}>WAVE</label>
          <SwitchCompact {...getControlProps('vco1_wave')} />
        </div>
        <div style={{ position: 'absolute', left: '130px', top: '120px' }}>
          <label style={{ fontSize: '4px', color: '#666', position: 'absolute', top: '-8px', whiteSpace: 'nowrap' }}>SEQ PITCH</label>
          <Switch3Way {...getControlProps('seq_pitch_mod')} />
        </div>

        {/* 1→2 FM */}
        <div style={{ position: 'absolute', left: '250px', top: '70px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>1→2 FM</label>
          <KnobNoValue {...getControlProps('fm_amount')} size={30} />
        </div>

        {/* VCO 2 GROUP */}
        <div style={{ position: 'absolute', left: '320px', top: '60px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCO 2 EG AMT</label>
          <KnobNoValue {...getControlProps('vco2_eg')} size={35} bipolar />
        </div>
        <div style={{ position: 'absolute', left: '370px', top: '60px' }}>
          <label style={{ fontSize: '6px', color: '#888', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>VCO 2 FREQ</label>
          <KnobNoValue {...getControlProps('vco2_frequency')} size={45} bipolar />
        </div>
        <div style={{ position: 'absolute', left: '370px', top: '120px' }}>
          <label style={{ fontSize: '4px', color: '#666', position: 'absolute', top: '-8px', whiteSpace: 'nowrap' }}>WAVE</label>
          <SwitchCompact {...getControlProps('vco2_wave')} />
        </div>
        <div style={{ position: 'absolute', left: '320px', top: '120px' }}>
          <label style={{ fontSize: '4px', color: '#666', position: 'absolute', top: '-8px', whiteSpace: 'nowrap' }}>SYNC</label>
          <SwitchCompact {...getControlProps('hard_sync')} />
        </div>

        {/* MIXER SECTION - Below oscillators */}
        <div style={{ position: 'absolute', left: '130px', top: '170px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCO 1</label>
          <KnobNoValue {...getControlProps('vco1_level')} size={30} />
        </div>
        <div style={{ position: 'absolute', left: '180px', top: '170px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>NOISE</label>
          <KnobNoValue {...getControlProps('noise')} size={30} />
        </div>
        <div style={{ position: 'absolute', left: '230px', top: '170px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCO 2</label>
          <KnobNoValue {...getControlProps('vco2_level')} size={30} />
        </div>

        {/* FILTER SECTION - Tight grouping */}
        <div style={{ position: 'absolute', left: '450px', top: '60px' }}>
          <label style={{ fontSize: '7px', color: '#888', position: 'absolute', top: '-14px', whiteSpace: 'nowrap' }}>CUTOFF</label>
          <KnobNoValue {...getControlProps('vcf_cutoff')} size={55} />
        </div>
        <div style={{ position: 'absolute', left: '520px', top: '70px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>RES</label>
          <KnobNoValue {...getControlProps('vcf_resonance')} size={35} />
        </div>
        <div style={{ position: 'absolute', left: '580px', top: '70px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCF EG AMT</label>
          <KnobNoValue {...getControlProps('vcf_eg')} size={35} bipolar />
        </div>
        <div style={{ position: 'absolute', left: '520px', top: '120px' }}>
          <label style={{ fontSize: '4px', color: '#666', position: 'absolute', top: '-8px', whiteSpace: 'nowrap' }}>MODE</label>
          <SwitchCompact {...getControlProps('vcf_mode')} />
        </div>
        <div style={{ position: 'absolute', left: '450px', top: '140px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCF DECAY</label>
          <KnobNoValue {...getControlProps('vcf_decay')} size={30} />
        </div>
        <div style={{ position: 'absolute', left: '520px', top: '140px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCF EG</label>
          <KnobNoValue {...getControlProps('vcf_eg')} size={30} />
        </div>
        <div style={{ position: 'absolute', left: '580px', top: '140px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>NOISE MOD</label>
          <KnobNoValue {...getControlProps('noise_vcf_mod')} size={30} />
        </div>

        {/* VCA SECTION - Far right of filter */}
        <div style={{ position: 'absolute', left: '650px', top: '70px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCA EG</label>
          <SwitchCompact {...getControlProps('vca_eg')} />
        </div>
        <div style={{ position: 'absolute', left: '700px', top: '70px' }}>
          <label style={{ fontSize: '5px', color: '#666', position: 'absolute', top: '-10px', whiteSpace: 'nowrap' }}>VCA DECAY</label>
          <KnobNoValue {...getControlProps('vca_decay')} size={30} />
        </div>
        <div style={{ position: 'absolute', left: '750px', top: '70px' }}>
          <label style={{ fontSize: '6px', color: '#888', position: 'absolute', top: '-12px', whiteSpace: 'nowrap' }}>VOLUME</label>
          <KnobNoValue {...getControlProps('vca_level')} size={40} />
        </div>

        {/* TEMPO & TRANSPORT - Far left */}
        <div style={{ position: 'absolute', left: '60px', top: '220px' }}>
          <label style={{ fontSize: '7px', color: '#888', position: 'absolute', top: '-14px', whiteSpace: 'nowrap' }}>TEMPO</label>
          <KnobNoValue {...getControlProps('tempo')} size={55} />
        </div>
        <div style={{ position: 'absolute', left: '60px', top: '300px' }}>
          <label style={{ fontSize: '4px', color: '#666', position: 'absolute', top: '-8px', whiteSpace: 'nowrap' }}>TRIGGER</label>
          <ButtonCompact {...getControlProps('trigger')} momentary gray />
        </div>
        <div style={{ position: 'absolute', left: '60px', top: '310px' }}>
          <label style={{ fontSize: '4px', color: '#666', position: 'absolute', top: '32px', whiteSpace: 'nowrap' }}>RUN/STOP</label>
          <ButtonCompact {...getControlProps('run_stop')} red />
        </div>
        <div style={{ position: 'absolute', left: '120px', top: '310px' }}>
          <label style={{ fontSize: '4px', color: '#666', position: 'absolute', top: '32px', whiteSpace: 'nowrap' }}>ADVANCE</label>
          <ButtonCompact {...getControlProps('advance')} momentary />
        </div>

        {/* SEQUENCER - More compact (240px width) */}
        <div style={{ position: 'absolute', left: '280px', top: '220px' }}>
          <div style={{ fontSize: '6px', color: '#888', marginBottom: '8px' }}>SEQUENCER</div>

          {/* Step numbers */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
            {[1,2,3,4,5,6,7,8].map(n => (
              <div key={n} style={{ fontSize: '5px', color: '#666', width: '25px', textAlign: 'center' }}>{n}</div>
            ))}
          </div>

          {/* PITCH row - 30px spacing */}
          <div style={{ display: 'flex', gap: '5px', marginBottom: '6px' }}>
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={`p${i}`} style={{ textAlign: 'center' }}>
                <KnobNoValue {...getControlProps(`pitch${i}`)} size={25} bipolar />
              </div>
            ))}
          </div>

          {/* VELOCITY row - 30px spacing */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={`v${i}`} style={{ textAlign: 'center' }}>
                <KnobNoValue {...getControlProps(`velocity${i}`)} size={25} />
              </div>
            ))}
          </div>

          {/* Row labels */}
          <div style={{ position: 'absolute', left: '-30px', top: '24px', fontSize: '5px', color: '#666', transform: 'rotate(-90deg)' }}>PITCH</div>
          <div style={{ position: 'absolute', left: '-30px', top: '60px', fontSize: '5px', color: '#666', transform: 'rotate(-90deg)' }}>VEL</div>
        </div>

        {/* PATCH BAY - Interactive with cables */}
        <div style={{
          position: 'absolute',
          right: '10px',
          top: '30px',
          width: '120px',
          height: '290px',
          background: '#0d0d0d',
          borderRadius: '4px',
          padding: '8px',
        }}>
          <div style={{ fontSize: '6px', color: '#888', marginBottom: '10px', textAlign: 'center' }}>PATCH BAY</div>
          <PatchBay
            jacks={[
              // LEFT COLUMN - IN/OUT
              { id: 'trigger_in', label: 'TRIGGER', x: 20, y: 30, type: 'input' },
              { id: 'velocity_in', label: 'VELOCITY', x: 20, y: 60, type: 'input' },
              { id: 'ext_audio', label: 'EXT AUDIO', x: 20, y: 90, type: 'input' },
              { id: 'noise_level', label: 'NOISE LEVEL', x: 20, y: 120, type: 'input' },
              { id: 'vcf_mod', label: 'VCF MOD', x: 20, y: 150, type: 'input' },
              { id: 'fm_amt', label: '1→2 FM AMT', x: 20, y: 180, type: 'input' },
              { id: 'tempo_in', label: 'TEMPO', x: 20, y: 210, type: 'input' },
              { id: 'trigger_out', label: 'TRIGGER', x: 20, y: 240, type: 'output' },

              // MIDDLE COLUMN - VCA
              { id: 'vca_cv', label: 'VCA CV', x: 55, y: 30, type: 'input' },
              { id: 'vca_decay_in', label: 'VCA DECAY', x: 55, y: 60, type: 'input' },
              { id: 'vcf_decay_in', label: 'VCF DECAY', x: 55, y: 90, type: 'input' },
              { id: 'vco_decay_in', label: 'VCO DECAY', x: 55, y: 120, type: 'input' },
              { id: 'vco1_cv', label: 'VCO 1 CV', x: 55, y: 150, type: 'input' },
              { id: 'vco2_cv', label: 'VCO 2 CV', x: 55, y: 180, type: 'input' },
              { id: 'run_stop_in', label: 'RUN/STOP', x: 55, y: 210, type: 'input' },
              { id: 'velocity_out', label: 'VELOCITY', x: 55, y: 240, type: 'output' },

              // RIGHT COLUMN - Outputs (mostly)
              { id: 'vca_out', label: 'VCA', x: 90, y: 30, type: 'output' },
              { id: 'vca_eg_out', label: 'VCA EG', x: 90, y: 60, type: 'output' },
              { id: 'vcf_eg_out', label: 'VCF EG', x: 90, y: 90, type: 'output' },
              { id: 'vco_eg_out', label: 'VCO EG', x: 90, y: 120, type: 'output' },
              { id: 'vco1_out', label: 'VCO 1', x: 90, y: 150, type: 'output' },
              { id: 'vco2_out', label: 'VCO 2', x: 90, y: 180, type: 'output' },
              { id: 'adv_clock', label: 'ADV/CLOCK', x: 90, y: 210, type: 'input' },
              { id: 'pitch_out', label: 'PITCH', x: 90, y: 240, type: 'output' },
            ]}
            onConnection={(from, to, color) => {
              console.log(`Connected ${from} → ${to} (${color} cable)`);
              // You can trigger lessons based on specific connections!
            }}
          />
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
        width: '25px',
        height: '25px',
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
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: red ? '#ff6666' : '#66ff66',
          boxShadow: `0 0 4px ${red ? '#ff0000' : '#00ff00'}`,
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
        width: '18px',
        height: '26px',
        background: '#1a1a1a',
        border: '2px solid #333',
        borderRadius: '4px',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: '10px',
        height: '5px',
        background: value ? '#0f0' : '#333',
        position: 'absolute',
        left: '50%',
        top: value ? '3px' : '16px',
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
        width: '18px',
        height: '32px',
        background: '#1a1a1a',
        border: '2px solid #333',
        borderRadius: '4px',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: '10px',
        height: '5px',
        background: '#0f0',
        position: 'absolute',
        left: '50%',
        top: position === 0 ? '3px' : position === 1 ? '13px' : '23px',
        transform: 'translateX(-50%)',
        borderRadius: '2px',
        transition: 'all 0.2s',
      }} />
    </button>
  );
}

