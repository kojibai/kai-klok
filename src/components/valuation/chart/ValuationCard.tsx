// ValuationCard.tsx
import ValueDonut from "./ValueDonut";

type ValuationCardProps = {
  live: number;
  pv: number;
  premiumX: number;
  momentX: number;
  colors: string[];
};

export default function ValuationCard({
  live, pv, premiumX, momentX, colors,
}: ValuationCardProps) {
  return (
    <ValueDonut
      price={live}
      pv={pv}
      premiumX={premiumX}
      momentX={momentX}
      colors={colors}
      size={128}
    />
  );
}
