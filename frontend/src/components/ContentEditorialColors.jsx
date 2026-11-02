import React from 'react';
import { Check } from 'lucide-react';

function ColorChoice({ label, value = 'white', onChange }) {
  return <fieldset className="min-w-0"><legend className="mb-2 text-sm font-medium">{label}</legend><div className="flex gap-5">
    {[['blue', 'Azul', '#051d40'], ['white', 'Branco', '#ffffff']].map(([key, name, color]) => <label key={key} className="relative flex cursor-pointer items-center gap-2 text-sm">
      <input type="radio" name={label} aria-label={`${label}: ${name}`} checked={value === key} onChange={() => onChange(key)} className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
      <span style={{ backgroundColor: color }} className={`grid h-8 w-8 place-items-center rounded border peer-focus-visible:outline peer-focus-visible:outline-2 ${value === key ? 'border-[#16829b] ring-2 ring-[#16829b]/30' : 'border-[#bdc8d1]'}`}>{value === key && <Check size={17} color={key === 'blue' ? '#ffffff' : '#051d40'} />}</span>
      {name}
    </label>)}
  </div></fieldset>;
}
export default function ContentEditorialColors({ settings, onChange }) {
  return <div className="space-y-4 border-y py-4">
    <ColorChoice label="Lateral da capa" value={settings.photoPanel} onChange={photoPanel => onChange({ photoPanel })} />
    <ColorChoice label="Demais páginas" value={settings.photoPages} onChange={photoPages => onChange({ photoPages })} />
  </div>;
}
