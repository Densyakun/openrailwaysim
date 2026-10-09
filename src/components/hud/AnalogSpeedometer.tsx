// アナログ式速度計 (#42)
import { Paper } from '@mui/material';
import { useSnapshot } from 'valtio';
import { trainsState } from '@/lib/client/trains';
import { store } from '@/lib/game';

const SIZE = 120;
const CENTER = SIZE / 2;
const RADIUS = 50;
const START_ANGLE = 135; // 度。左下的向き
const SWEEP = 270;       // 針が動く角度

function polar(angleDeg: number, radius: number) {
  const angle = angleDeg * Math.PI / 180;
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

export default function AnalogSpeedometer() {
  const { trains } = useSnapshot(store.data);
  const train = trains[trainsState.activeTrainId];

  if (!train) return null;

  const speedKmh = Math.abs(train.speed * 3.6);
  const maxKmh = Math.max(120, Math.ceil(speedKmh * 1.2 / 20) * 20);
  const angle = START_ANGLE + Math.min(speedKmh, maxKmh) / maxKmh * SWEEP;

  const tickCount = 12;
  const ticks = [];
  for (let i = 0; i <= tickCount; i++) {
    const value = maxKmh * i / tickCount;
    const tickAngle = START_ANGLE + i / tickCount * SWEEP;
    const isMajor = i % 2 === 0;
    const outer = polar(tickAngle, RADIUS);
    const inner = polar(tickAngle, RADIUS - (isMajor ? 10 : 5));
    const label = isMajor ? polar(tickAngle, RADIUS - 20) : undefined;
    ticks.push(
      <g key={i}>
        <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#ffffff" strokeWidth={isMajor ? 2 : 1} />
        {label && <text x={label.x} y={label.y} fill="#ffffff" fontSize={9} textAnchor="middle" dominantBaseline="middle">{value}</text>}
      </g>
    );
  }

  const needleTip = polar(angle, RADIUS - 8);

  return (
    <Paper sx={{ p: 0.5, bgcolor: '#000c' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#ffffff55" strokeWidth={2} />
        {ticks}
        <line x1={CENTER} y1={CENTER} x2={needleTip.x} y2={needleTip.y} stroke="#f44336" strokeWidth={3} strokeLinecap="round" />
        <circle cx={CENTER} cy={CENTER} r={4} fill="#f44336" />
      </svg>
    </Paper>
  );
}
