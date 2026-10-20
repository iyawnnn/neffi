// Inline artwork keeps each structural layer independently animatable.

export function TapSignalIllustration() {
  const plane = "M240 48Q244 48 248 50L416 136Q428 142 416 148L248 234Q240 238 232 234L64 148Q52 142 64 136L232 50Q236 48 240 48Z";
  return (
    <svg viewBox="0 0 480 360" aria-hidden="true" focusable="false" className="illo signal-stack">
      <g className="stack-structure">
        <path d="M240 48V128M58 142V222M422 142V222M240 236V316" />
        <path d="M234 128H246M52 222H64M416 222H428M234 316H246" />
      </g>
      <g className="stack-layer stack-layer-5">
        <g transform="translate(0 80)"><path className="stack-outline" d={plane} /></g>
      </g>
      <g className="stack-layer stack-layer-4">
        <g transform="translate(0 60)"><path className="stack-outline" d={plane} /></g>
      </g>
      <g className="stack-layer stack-layer-3">
        <g transform="translate(0 40)"><path className="stack-outline" d={plane} /></g>
      </g>
      <g className="stack-layer stack-layer-2">
        <g transform="translate(0 20)"><path className="stack-outline" d={plane} /></g>
      </g>
      <g className="stack-layer top-surface">
        <path className="stack-outline" d={plane} />
        <g className="stack-registration">
          <path d="M240 64V73M240 211V220M83 142H99M381 142H397" />
          <path d="M146 100L154 104M326 180L334 184M146 184L154 180M326 104L334 100" />
          <path d="M219 142H228M252 142H261M240 130V135M240 149V154" />
        </g>
        <g className="stack-signal-field">
          <path className="stack-signal stack-signal-1" pathLength={100} d="M268 138C262 129 239 125 222 132C204 139 212 151 234 154C251 156 265 150 269 146" />
          <path className="stack-signal stack-signal-2" pathLength={100} d="M201 164C173 154 175 136 205 125C235 114 277 120 295 135C307 146 293 160 270 165" />
          <path className="stack-signal stack-signal-3" pathLength={100} d="M321 135C310 115 263 104 222 109C176 114 148 135 160 154C171 173 214 183 252 178C276 176 297 170 309 161" />
          <path className="stack-signal stack-signal-4" pathLength={100} d="M182 187C145 176 125 159 132 142C140 118 184 99 230 96C275 93 320 105 342 123C362 140 349 162 321 174" />
        </g>
        <g className="stack-tap-point">
          <circle cx="240" cy="142" r="4" />
          <path d="M369 160L378 155" />
        </g>
      </g>
    </svg>
  );
}

export function IdentityStructureIllustration() {
  return (
    <svg viewBox="0 0 480 360" aria-hidden="true" focusable="false" className="illo identity-assembly">
      <g className="assembly-structural-lines">
        <path d="M240 63V81M48 166H72M408 166H432M240 247V271" />
        <path d="M164 161L184 171M296 171L316 161M230 195L250 205" />
      </g>
      <g className="assembly-part assembly-part-upper-left">
        <path className="assembly-outline" d="M240 72L58 166H174L194 156L200 159L212 153L206 150L240 132Z" />
        <path className="assembly-recess" d="M228 89L83 164M99 156L114 156M240 84V117" />
        <path className="assembly-registration" d="M160 120L167 124M149 126L156 130M138 132L145 136" />
      </g>
      <g className="assembly-part assembly-part-upper-right">
        <path className="assembly-outline" d="M240 72L422 166H306L240 132Z" />
        <path className="assembly-recess" d="M252 89L397 164M366 156H381M252 100V127" />
        <path className="assembly-registration" d="M313 124L320 120M324 130L331 126M335 136L342 132" />
      </g>
      <g className="assembly-part assembly-part-front">
        <path className="assembly-outline" d="M58 166L240 260L422 166H306L240 200L174 166Z" />
        <path className="assembly-depth" d="M58 166V194L240 288L422 194V166M240 260V288" />
        <path className="assembly-recess" d="M83 176L240 248L397 176M174 179L240 213L306 179" />
        <path className="assembly-registration" d="M117 211V218M126 216V223M354 216V223M363 211V218M231 273L240 278L249 273" />
      </g>
      <g className="assembly-part identity-core">
        <path className="assembly-outline" d="M240 132L306 166L240 200L174 166L194 156L200 159L212 153L206 150Z" />
        <path className="assembly-recess" d="M240 143L284 166L240 189L196 166Z" />
        <path className="assembly-depth" d="M196 166V172L240 195L284 172V166M240 189V195" />
        <g className="assembly-registration">
          <path d="M240 150V156M240 177V183M207 166H217M263 166H273" />
          <path d="M225 161L240 153L255 161M225 171L240 179L255 171" />
        </g>
        <path className="assembly-accent" d="M200 159L212 153" />
      </g>
    </svg>
  );
}

export function StayCurrentIllustration() {
  return (
    <svg viewBox="8 21 432 324" aria-hidden="true" focusable="false" className="illo update-progression">
      <g className="progression-rail">
        <path d="M26 200L82 184L138 178L194 154L250 148L306 124L362 118" />
        <path d="M86 248L142 232L198 226L254 202L310 196L366 172L422 166" />
        <path className="progression-spine" d="M56 215L112 199L168 193L224 169L280 163L336 139L392 133" />
      </g>
      <g className="progression-state update-state-1">
        <path className="progression-surface" d="M26 200L82 184L142 214L86 230Z" />
        <path className="progression-depth" d="M86 230V248L142 232V214" />
        <path className="progression-registration" d="M42 208L48 211M95 238L102 236" />
      </g>
      <g className="progression-state update-state-2">
        <path className="progression-surface" d="M82 184L138 178L198 208L142 214Z" />
        <path className="progression-depth" d="M142 214V232L198 226V208" />
        <path className="progression-registration" d="M98 192L104 195M151 222L158 221" />
      </g>
      <g className="progression-state update-state-3">
        <path className="progression-surface" d="M138 178L194 154L254 184L198 208Z" />
        <path className="progression-depth" d="M198 208V226L254 202V184" />
        <path className="progression-registration" d="M154 186L160 189M207 214L214 211" />
      </g>
      <g className="progression-state update-state-4">
        <path className="progression-surface" d="M194 154L250 148L310 178L254 184Z" />
        <path className="progression-depth" d="M254 184V202L310 196V178" />
        <path className="progression-registration" d="M210 162L216 165M263 192L270 191M222 160L228 163" />
      </g>
      <g className="progression-state update-state-5">
        <path className="progression-surface" d="M250 148L306 124L366 154L310 178Z" />
        <path className="progression-depth" d="M310 178V196L366 172V154" />
        <path className="progression-registration" d="M266 156L272 159M319 184L326 181M278 151L284 154" />
      </g>
      <g className="progression-state current-state">
        <path className="progression-surface" d="M306 124L362 118L422 148L366 154Z" />
        <path className="progression-depth" d="M366 154V172L422 166V148" />
        <g className="progression-registration">
          <path d="M322 132L328 135M334 130L340 133M375 162L382 161M386 161L393 160" />
          <path d="M348 128L358 127L394 145M400 153V160M408 152V159" />
        </g>
        <path className="current-accent" d="M410 142L422 148" />
      </g>
    </svg>
  );
}
