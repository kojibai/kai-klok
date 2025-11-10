// src/components/KaiRealms/Inventory.tsx

import React from 'react';

type Props = {
  phiCollected: number;
  upgrades?: string[];
};

const Inventory: React.FC<Props> = ({ phiCollected, upgrades = [] }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        backgroundColor: '#000022',
        padding: '1rem',
        borderRadius: '12px',
        boxShadow: '0 0 10px #00ffff88',
        width: '220px',
        color: '#ffffff',
        fontFamily: 'monospace',
      }}
    >
      <h3 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.1rem', color: '#66ffff' }}>
        🧿 Inventory
      </h3>

      <div style={{ marginBottom: '0.5rem' }}>
        <strong>Φ Collected:</strong> {phiCollected}
      </div>

      {upgrades.length > 0 && (
        <div>
          <strong>Upgrades:</strong>
          <ul style={{ paddingLeft: '1.2rem', marginTop: '0.25rem' }}>
            {upgrades.map((item, i) => (
              <li key={i} style={{ fontSize: '0.95rem' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Inventory;
