import React, { useEffect, useState } from 'react';
import { getFirm } from '../api/firm';

export default function FirmHeader({ className = '' }) {
  const [firmName, setFirmName] = useState('Escritório');

  useEffect(() => {
    getFirm()
      .then((firm) => setFirmName(firm.name || 'Escritório'))
      .catch(() => setFirmName('Escritório'));
  }, []);

  return (
    <header className={`flex h-[58px] items-center justify-between border-b border-[#dfe5e8] px-5 ${className}`}>
      <div className="text-base text-[#60666b]">{firmName}</div>
    </header>
  );
}
