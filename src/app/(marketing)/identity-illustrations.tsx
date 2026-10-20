import type { CSSProperties } from "react";

// All three sculptures share one 2:1 isometric projection, so their linework, depth and perspective stay a single family.
// Boxes are [x0, x1, y0, y1, z0, z1] in plan units; +x runs down-right on screen, +y down-left, z straight up.
type Box = readonly [number, number, number, number, number, number];
type Point = (x: number, y: number, z: number) => string;

const projection = (cy: number): Point => (x, y, z) => `${240 + x - y} ${cy + (x + y) / 2 - z}`;
const polygon = (...points: string[]) => `M${points.join("L")}Z`;

function faces(pt: Point, [x0, x1, y0, y1, z0, z1]: Box) {
  return {
    top: polygon(pt(x0, y0, z1), pt(x1, y0, z1), pt(x1, y1, z1), pt(x0, y1, z1)),
    left: polygon(pt(x0, y1, z1), pt(x1, y1, z1), pt(x1, y1, z0), pt(x0, y1, z0)),
    right: polygon(pt(x1, y0, z1), pt(x1, y1, z1), pt(x1, y1, z0), pt(x1, y0, z0)),
  };
}

// Only the three faces a viewer can see; painter's order (back to front) handles the rest.
function Block({ pt, box }: { pt: Point; box: Box }) {
  const { top, left, right } = faces(pt, box);
  return (
    <>
      <path className="arch-side" d={left} />
      <path className="arch-side arch-shade" d={right} />
      <path className="arch-surface" d={top} />
    </>
  );
}

// A flat footprint dropped a few units below the ground plane: a calm, geometric contact shadow shared by every figure.
function Shadow({ pt, boxes }: { pt: Point; boxes: Box[] }) {
  return (
    <g className="arch-shadow">
      {boxes.map(([x0, x1, y0, y1]) => (
        <path key={`${x0} ${y0}`} d={polygon(pt(x0, y0, -7), pt(x1, y0, -7), pt(x1, y1, -7), pt(x0, y1, -7))} />
      ))}
    </g>
  );
}

export function TapKeyIllustration() {
  const pt = projection(203);
  const base: Box = [-90, 90, -90, 90, 0, 12];
  const top: Box = [-88, 88, -88, 88, 30, 48];
  const plate = faces(pt, top);
  const well = polygon(pt(-32, -32, 48), pt(32, -32, 48), pt(32, 32, 48), pt(-32, 32, 48));
  const core = faces(pt, [-21, 21, -21, 21, 39, 50]);
  return (
    <svg viewBox="0 0 480 360" aria-hidden="true" focusable="false" className="illo arch-tap">
      <Shadow pt={pt} boxes={[base]} />
      <g className="arch-enter">
        <Block pt={pt} box={base} />
      </g>
      <g className="arch-enter arch-enter-2">
        <g className="arch-hover arch-tap-layer-2">
          <Block pt={pt} box={[-83, 83, -83, 83, 12, 21]} />
        </g>
      </g>
      <g className="arch-enter arch-enter-3">
        <g className="arch-hover arch-tap-layer-3">
          <Block pt={pt} box={[-83, 83, -83, 83, 21, 30]} />
        </g>
      </g>
      <g className="arch-enter arch-enter-4">
        <g className="arch-hover arch-tap-plate">
          <path className="arch-side" d={plate.left} />
          <path className="arch-side arch-shade" d={plate.right} />
          {/* The well's floor and back walls, then the core's sides, all sit under the plate's top face, which masks them at the rim. */}
          <path className="arch-recess" d={well} />
          <path className="arch-recess-wall" d={polygon(pt(-32, -32, 48), pt(32, -32, 48), pt(32, -32, 39), pt(-32, -32, 39))} />
          <path className="arch-recess-wall arch-shade" d={polygon(pt(-32, -32, 48), pt(-32, 32, 48), pt(-32, 32, 39), pt(-32, -32, 39))} />
          <g className="arch-hover arch-tap-core">
            <path className="arch-side" d={core.left} />
            <path className="arch-side arch-shade" d={core.right} />
          </g>
          <path className="arch-surface" fillRule="evenodd" d={`${plate.top}${well}`} />
          <path className="arch-bevel" d={`M${pt(-80, 80, 48)}L${pt(-80, -80, 48)}L${pt(80, -80, 48)}`} />
          <g className="arch-hover arch-tap-core">
            <path className="arch-surface" d={core.top} />
            <path className="arch-accent-fill" d={polygon(pt(-7, -7, 50), pt(7, -7, 50), pt(7, 7, 50), pt(-7, 7, 50))} />
          </g>
        </g>
      </g>
    </svg>
  );
}

const rails = [
  { id: "west", box: [-206, -46, -12, 12, 0, 11], groove: [[-198, 0], [-54, 0]] },
  { id: "north", box: [-12, 12, -206, -46, 0, 11], groove: [[0, -198], [0, -54]] },
  { id: "east", box: [46, 206, -12, 12, 0, 11], groove: [[54, 0], [198, 0]] },
  { id: "south", box: [-12, 12, 46, 206, 0, 11], groove: [[0, 54], [0, 198]] },
] as const;

function Rail({ pt, id, box, groove: [[ax, ay], [bx, by]] }: { pt: Point } & (typeof rails)[number]) {
  return (
    <g className={`arch-enter arch-enter-${id}`}>
      <g className={`arch-hover arch-rail-${id}`}>
        <Block pt={pt} box={box} />
        <path className="arch-joint" d={`M${pt(ax, ay, 11)}L${pt(bx, by, 11)}`} />
      </g>
    </g>
  );
}

export function ConvergenceIllustration() {
  const pt = projection(186);
  const hub: Box = [-36, 36, -36, 36, 0, 44];
  return (
    <svg viewBox="0 0 480 360" aria-hidden="true" focusable="false" className="illo arch-converge">
      <Shadow pt={pt} boxes={[hub, ...rails.map((rail) => rail.box)]} />
      {/* The two rails behind the hub, the hub, then the two in front of it. */}
      <Rail pt={pt} {...rails[0]} />
      <Rail pt={pt} {...rails[1]} />
      <g className="arch-enter">
        <Block pt={pt} box={hub} />
        <path className="arch-bevel" d={`M${pt(-29, 29, 44)}L${pt(-29, -29, 44)}L${pt(29, -29, 44)}`} />
        <path className="arch-inset" d={polygon(pt(-15, -15, 44), pt(15, -15, 44), pt(15, 15, 44), pt(-15, 15, 44))} />
        {/* The seam where every rail meets the core, at rail height. */}
        <path className="arch-accent" d={`M${pt(-36, 36, 11)}L${pt(36, 36, 11)}L${pt(36, -36, 11)}`} />
      </g>
      <Rail pt={pt} {...rails[2]} />
      <Rail pt={pt} {...rails[3]} />
    </svg>
  );
}

// Six segments of one continuous spine, earliest (front, left) to newest (back, right). Ink is how resolved each state is.
const segments = [
  { ink: 0.24, draft: true },
  { ink: 0.34, draft: true },
  { ink: 0.46 },
  { ink: 0.56 },
  { ink: 0.64 },
  { ink: 0.72 },
];

export function LivingSpineIllustration() {
  const pt = projection(194);
  const box = (i: number): Box => [-24, 24, 180 - 60 * (i + 1), 180 - 60 * i, 0, 26];
  const last = segments.length - 1;
  return (
    <svg viewBox="0 0 480 360" aria-hidden="true" focusable="false" className="illo arch-spine">
      <Shadow pt={pt} boxes={[[-24, 24, -180, 180, 0, 26]]} />
      {segments
        .map(({ ink, draft }, i) => (
          <g key={i} className={`arch-enter${draft ? " arch-draft" : ""}`} style={{ "--arch-delay": `${i * 70}ms` } as CSSProperties}>
            <g className="arch-hover arch-segment" style={{ "--seg-ink": ink, "--seg-step": i } as CSSProperties}>
              <Block pt={pt} box={box(i)} />
              {i === last && (
                <>
                  <path className="arch-bevel" d={`M${pt(-18, -126, 26)}L${pt(-18, -174, 26)}L${pt(18, -174, 26)}`} />
                  <path className="arch-accent" d={`M${pt(-14, -164, 26)}L${pt(14, -164, 26)}`} />
                </>
              )}
            </g>
          </g>
        ))
        .reverse()}
    </svg>
  );
}
