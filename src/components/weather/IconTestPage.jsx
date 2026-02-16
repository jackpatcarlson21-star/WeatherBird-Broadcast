import React from 'react';
import AnimatedWeatherIcon from './AnimatedWeatherIcon';

// Every WMO code grouped by icon type
const CODE_GROUPS = [
  { label: 'Clear (sun/moon)', codes: [0] },
  { label: 'Partly Cloudy (cloudSun/cloudMoon)', codes: [1, 2] },
  { label: 'Overcast (cloud)', codes: [3] },
  { label: 'Fog', codes: [45, 48] },
  { label: 'Drizzle', codes: [51, 53, 55] },
  { label: 'Freezing Drizzle (cyan drops)', codes: [56, 57] },
  { label: 'Rain', codes: [58, 59, 61, 63, 80, 81] },
  { label: 'Heavy Rain', codes: [65, 82] },
  { label: 'Freezing Rain (cyan drops)', codes: [66, 67] },
  { label: 'Snow', codes: [71, 73, 77, 85] },
  { label: 'Heavy Snow', codes: [75, 86] },
  { label: 'Thunderstorm', codes: [95, 96, 99] },
];

const SIZES = [28, 40, 64, 80, 150];

const IconTestPage = () => (
  <div style={{ backgroundColor: '#0a1628', color: '#fff', minHeight: '100vh', padding: 24, fontFamily: 'VT323, monospace' }}>
    <h1 style={{ color: '#00FFFF', fontSize: 32, marginBottom: 8 }}>AnimatedWeatherIcon — Visual Test</h1>
    <p style={{ color: '#67e8f9', marginBottom: 24 }}>All WMO codes × day/night × sizes. Scroll to inspect.</p>

    {/* Size reference row */}
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ color: '#facc15', fontSize: 22, marginBottom: 12 }}>Size Reference (code 0, day)</h2>
      <div style={{ display: 'flex', alignItems: 'end', gap: 24, flexWrap: 'wrap' }}>
        {SIZES.map(s => (
          <div key={s} style={{ textAlign: 'center' }}>
            <AnimatedWeatherIcon code={0} night={false} size={s} />
            <div style={{ color: '#67e8f9', fontSize: 14, marginTop: 4 }}>{s}px</div>
          </div>
        ))}
      </div>
    </section>

    {/* Code groups */}
    {CODE_GROUPS.map(group => (
      <section key={group.label} style={{ marginBottom: 32, borderTop: '1px solid #164e63', paddingTop: 16 }}>
        <h2 style={{ color: '#facc15', fontSize: 22, marginBottom: 12 }}>{group.label}</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Code</th>
              <th style={th}>Day (64px)</th>
              <th style={th}>Night (64px)</th>
              <th style={th}>Small (28px)</th>
              <th style={th}>Large (150px)</th>
            </tr>
          </thead>
          <tbody>
            {group.codes.map(code => (
              <tr key={code} style={{ borderBottom: '1px solid #1e3a5f' }}>
                <td style={td}>{code}</td>
                <td style={td}><AnimatedWeatherIcon code={code} night={false} size={64} /></td>
                <td style={td}><AnimatedWeatherIcon code={code} night={true} size={64} /></td>
                <td style={td}><AnimatedWeatherIcon code={code} night={false} size={28} /></td>
                <td style={td}><AnimatedWeatherIcon code={code} night={false} size={150} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ))}

    {/* Duplicate icon stress test — verifies no duplicate <style> tags */}
    <section style={{ marginBottom: 32, borderTop: '1px solid #164e63', paddingTop: 16 }}>
      <h2 style={{ color: '#facc15', fontSize: 22, marginBottom: 12 }}>Duplicate Render Test (20 icons — check DOM for single style tag)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Array.from({ length: 20 }, (_, i) => (
          <AnimatedWeatherIcon key={i} code={[0, 2, 3, 45, 53, 63, 73, 95][i % 8]} night={i % 2 === 1} size={40} />
        ))}
      </div>
      <p style={{ color: '#67e8f9', fontSize: 14, marginTop: 8 }}>
        Open DevTools → Elements → search for id="wx-icon-styles". Should appear exactly once.
      </p>
    </section>
  </div>
);

const th = { textAlign: 'left', padding: '8px 12px', color: '#00FFFF', fontSize: 16, borderBottom: '2px solid #164e63' };
const td = { padding: '8px 12px', verticalAlign: 'middle' };

export default IconTestPage;
