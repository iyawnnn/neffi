type Positioned = { x: number; y: number; rotate?: number };

function Card({ x, y, rotate = 0 }: Positioned) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotate} 36 22)`}
      stroke="#20201e"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    >
      <rect width="72" height="44" rx="5" fill="#fffdf9" />
      <path d="M12 15h27M12 24h38" stroke="#aaa69d" strokeWidth="1.25" />
      <path d="M56 13v18" stroke="var(--brand)" strokeWidth="2" />
    </g>
  );
}

function Phone({ x, y, rotate = 0 }: Positioned) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotate} 35 64)`}
      stroke="#20201e"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    >
      <rect width="70" height="128" rx="11" fill="#f5f2ec" />
      <rect x="5" y="7" width="60" height="112" rx="7" fill="#fffdf9" stroke="#d0cbc2" />
      <path d="M26 14h18M28 111h14" stroke="#aaa69d" strokeWidth="1.25" />
    </g>
  );
}

function DocumentLines({ x, y, width, count = 3 }: { x: number; y: number; width: number; count?: number }) {
  return (
    <g fill="none" stroke="#aaa69d" strokeLinecap="round" strokeWidth="1.25">
      {Array.from({ length: count }, (_, index) => (
        <path key={index} d={`M${x} ${y + index * 13}h${width - (index % 2 ? 18 : 0)}`} />
      ))}
    </g>
  );
}

export function ClientMeetingIllustration() {
  return (
    <svg viewBox="0 0 560 460" aria-hidden="true" focusable="false" className="uc-illustration">
      <g
        stroke="#20201e"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <rect x="72" y="100" width="416" height="260" rx="126" fill="#e6e1d8" stroke="#d0cbc2" />
        <rect x="82" y="91" width="396" height="252" rx="122" fill="#fffdf9" />
        <rect x="54" y="171" width="50" height="118" rx="23" fill="#f2efe9" />
        <rect x="456" y="171" width="50" height="118" rx="23" fill="#f2efe9" />
        <path d="M179 163h121a8 8 0 0 1 8 8v90a8 8 0 0 1-8 8H179z" fill="#f4f1eb" />
        <path d="M179 163v98h121" fill="none" stroke="#d0cbc2" />
        <DocumentLines x={198} y={191} width={75} count={3} />
        <path
          d="M350 154h54a7 7 0 0 1 7 7v105a7 7 0 0 1-7 7h-54a7 7 0 0 1-7-7V161a7 7 0 0 1 7-7Z"
          fill="#f5f2ec"
        />
        <path d="M361 167h32M363 251h28" stroke="#aaa69d" strokeWidth="1.25" />
        <Card x={211} y={283} rotate={-5} />
      </g>
    </svg>
  );
}

export function NetworkingEventIllustration() {
  return (
    <svg viewBox="0 0 640 320" aria-hidden="true" focusable="false" className="uc-illustration">
      <g
        stroke="#20201e"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <g>
          <path
            d="M218 120C191 98 148 72 111 80C75 88 74 124 98 141C122 159 165 153 211 137"
            fill="none"
            stroke="#d0cbc2"
            strokeWidth="10"
          />
          <path d="M218 120C191 98 148 72 111 80C75 88 74 124 98 141C122 159 165 153 211 137" fill="none" stroke="#f5f2ec" strokeWidth="7" />
          <rect x="211" y="110" width="24" height="34" rx="5" fill="#e6e1d8" stroke="#b7b3ab" />
          <rect x="162" y="136" width="188" height="126" rx="9" fill="#e6e1d8" stroke="#d0cbc2" />
          <rect x="158" y="131" width="188" height="126" rx="9" fill="#fffdf9" />
          <rect x="211" y="141" width="24" height="5" rx="2.5" fill="#d0cbc2" stroke="none" />
          <rect x="180" y="167" width="50" height="58" rx="4" fill="#ece8e0" stroke="#d0cbc2" />
          <path d="M193 183h24v26h-24z" fill="#f9f7f2" stroke="#b7b3ab" />
          <path d="M250 177h71M250 192h51M250 223h36" stroke="#aaa69d" strokeWidth="1.25" />
        </g>
        <Phone x={438} y={77} rotate={5} />
        <Card x={379} y={187} rotate={-8} />
      </g>
    </svg>
  );
}

export function CreativeWorkIllustration() {
  return (
    <svg viewBox="0 0 560 460" aria-hidden="true" focusable="false" className="uc-illustration">
      <g
        stroke="#20201e"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <g transform="rotate(-5 245 220)">
          <rect x="109" y="95" width="235" height="267" rx="6" fill="#e5e0d7" stroke="#d0cbc2" />
          <rect x="103" y="88" width="235" height="267" rx="6" fill="#fffdf9" />
          <rect x="123" y="110" width="195" height="165" rx="2" fill="#eeebe4" stroke="#d0cbc2" />
          <path d="M150 242V139h53a51.5 51.5 0 0 1 0 103z" fill="#d4cfc5" stroke="none" />
          <circle cx="263" cy="174" r="30" fill="#fffdf9" stroke="#aaa69d" />
          <path d="M244 242h46" stroke="#aaa69d" />
          <path d="M124 302h92M124 317h60" stroke="#aaa69d" strokeWidth="1.25" />
        </g>
        <g transform="rotate(5 366 268)">
          <rect x="296" y="196" width="136" height="136" rx="10" fill="#e8e3da" stroke="#aaa69d" />
          <rect x="304" y="204" width="120" height="118" rx="4" fill="#fffdf9" stroke="#d0cbc2" />
          <path d="M325 301v-75h38a37.5 37.5 0 0 1 0 75z" fill="#e5e0d7" stroke="none" />
          <path d="M359 326h11" stroke="#aaa69d" />
          <rect x="444" y="211" width="7" height="106" rx="3.5" fill="#f5f2ec" stroke="#aaa69d" />
          <path d="M444 305h7M445 318l2.5 7 2.5-7" fill="#aaa69d" stroke="#aaa69d" />
        </g>
        <Card x={227} y={330} rotate={-5} />
      </g>
    </svg>
  );
}

export function SalesConversationIllustration() {
  return (
    <svg viewBox="0 0 640 320" aria-hidden="true" focusable="false" className="uc-illustration">
      <g
        stroke="#20201e"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <rect x="75" y="79" width="294" height="190" rx="5" fill="#e6e1d8" stroke="#d0cbc2" />
        <rect x="67" y="70" width="294" height="190" rx="5" fill="#fffdf9" />
        <path d="M95 102h106M95 115h72" stroke="#20201e" />
        <path d="M95 151h228M95 165h198M95 179h211" stroke="#aaa69d" strokeWidth="1.25" />
        <path d="M95 225h83M233 225h67" stroke="#b7b3ab" strokeWidth="1.25" />
        <Phone x={455} y={77} rotate={5} />
        <Card x={393} y={182} rotate={-6} />
      </g>
    </svg>
  );
}

export function CareerOpportunityIllustration() {
  return (
    <svg viewBox="0 0 560 460" aria-hidden="true" focusable="false" className="uc-illustration">
      <g
        stroke="#20201e"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <path d="M142 76h188v283H142z" fill="#e7e2d9" stroke="#d0cbc2" />
        <path d="M130 88h188v283H130z" fill="#fffdf9" />
        <path d="M158 122h67M158 139h45" stroke="#20201e" />
        <path
          d="M158 178h131M158 194h102M158 210h119M158 250h131M158 266h90M158 282h112"
          stroke="#aaa69d"
          strokeWidth="1.25"
        />
        <path d="M158 322h74" stroke="#d0cbc2" />
        <path d="M319 218l89-38 47 111-89 38z" fill="#f2efe9" stroke="#d0cbc2" />
        <path d="M344 222l47-20 19 44-47 20z" fill="#e2ddd3" />
        <path d="M376 282l38-16" stroke="#aaa69d" strokeWidth="1.25" />
        <Card x={350} y={107} rotate={7} />
      </g>
    </svg>
  );
}

export function EverydayConnectionIllustration() {
  return (
    <svg viewBox="0 0 640 320" aria-hidden="true" focusable="false" className="uc-illustration">
      <g
        stroke="#20201e"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      >
        <g transform="rotate(-4 257 211)">
          <path d="M143 157q52-11 110 0 58-11 110 0v105q-52-11-110 0-58-11-110 0z" fill="#e6e1d8" stroke="#d0cbc2" />
          <path d="M139 151q52-11 114 0 58-11 110 0v103q-52-11-110 0-62-11-114 0z" fill="#fffdf9" />
          <path d="M253 152v98" stroke="#d0cbc2" />
          <path d="M160 177h59M160 191h47M160 205h55M278 177h57M278 191h42" stroke="#b7b3ab" strokeWidth="1.25" />
          <path d="M323 151v55l5-5 5 5v-55" fill="#e8e3da" stroke="#d0cbc2" />
        </g>
        <g>
          <circle cx="119" cy="91" r="47" fill="#e9e5dd" stroke="#d0cbc2" />
          <circle cx="119" cy="89" r="42" fill="#fffdf9" stroke="#b7b3ab" />
          <path d="M148 78h12a12 12 0 0 1 0 24h-12v-6h11a6 6 0 0 0 0-12h-11z" fill="#fffdf9" />
          <circle cx="119" cy="89" r="32" fill="#fffdf9" />
          <circle cx="119" cy="89" r="25" fill="#d9d3c9" stroke="#aaa69d" />
        </g>
        <Phone x={435} y={77} rotate={5} />
        <Card x={375} y={188} rotate={-6} />
      </g>
    </svg>
  );
}
