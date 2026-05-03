const SHAPES = {
  p: 'M50 20c-10 0-18 8-18 18 0 6 3 11 7 14-8 5-13 14-13 24v12h48V76c0-10-5-19-13-24 4-3 7-8 7-14 0-10-8-18-18-18Z',
  r: 'M28 18h8v9h8v-9h12v9h8v-9h8v18H28V18Zm4 25h40l4 45H24l8-45Z',
  n: 'M30 82h44c-2-9-7-17-14-22 5-4 8-10 8-17 0-13-10-23-23-23-9 0-17 5-21 13l12 5c2-4 5-6 9-6 6 0 11 5 11 11 0 5-3 9-8 11l-9 3 7 11c3 5 5 10 5 14H30Z',
  b: 'M50 18c-7 0-12 5-12 12 0 5 3 9 7 11l-9 9c-5 5-8 12-8 19v17h44V69c0-7-3-14-8-19l-9-9c4-2 7-6 7-11 0-7-5-12-12-12Zm-4 14h8v6h-8v-6Z',
  q: 'M24 32l8 10 10-16 8 14 8-14 10 16 8-10 6 50H18l6-50Z',
  k: 'M46 16h8v12h12v8H54v10c11 4 18 15 18 27v13H28V73c0-12 7-23 18-27V36H34v-8h12V16Z',
}

export function PieceIcon({ type, color }) {
  return (
    <svg viewBox="0 0 100 100" className={`piece-svg ${color === 'w' ? 'is-white' : 'is-black'}`} aria-hidden="true">
      <defs>
        <linearGradient id="whitePieceGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cfcfcf" />
        </linearGradient>
        <linearGradient id="blackPieceGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#555555" />
          <stop offset="100%" stopColor="#111111" />
        </linearGradient>
      </defs>
      <path d={SHAPES[type]} />
    </svg>
  )
}
