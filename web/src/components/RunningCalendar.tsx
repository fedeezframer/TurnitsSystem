// Articulated SVG: every limb follows one continuous stride, without sprites.
export default function RunningCalendar() {
  return (
    <svg
      className="turnits-runner-animation"
      viewBox="0 0 240 240"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="#17251c"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse
        className="calendar-shadow"
        cx="122"
        cy="215"
        rx="48"
        ry="5"
        fill="#17251c"
        stroke="none"
        opacity=".12"
      />
      <g className="calendar-body">
        <g transform="translate(114 154)">
          <g className="calendar-leg calendar-leg-back">
            <path d="M-5 0 Q-9 12 -5 26 L5 26 Q9 13 5 0" fill="#f5f7f2" />
            <g transform="translate(0 25)">
              <g className="calendar-shin calendar-shin-back">
                <path d="M-5 0 L-5 22 Q0 28 5 22 L5 0" fill="#fff" />
                <path
                  d="M-5 15 H5 M-5 19 H5"
                  stroke="#28833c"
                  strokeWidth="2.5"
                />
                <g transform="translate(0 24)">
                  <path
                    d="M-7-3 Q0-7 6-2 L13 4 Q25 2 27 9 Q27 16 17 17 H-9 Q-13 8-7-3Z"
                    fill="#278d42"
                  />
                  <path
                    d="M-11 11 Q7 15 26 9 L26 14 Q10 21-10 16Z"
                    fill="#fff"
                  />
                  <path
                    d="M8 3 L4 7 M13 5 L9 9"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                </g>
              </g>
            </g>
          </g>
        </g>
        <g transform="translate(165 110)">
          <g className="calendar-arm calendar-arm-back">
            <path
              d="M0-5 Q17-8 23 5 L27 16 L18 21 L14 10 Q9 3 0 5"
              fill="#f5f7f2"
            />
            <path d="M17 17 L27 13 L31 22 L21 27Z" fill="#288c40" />
            <path
              d="M22 25 Q18 32 22 36 Q28 40 31 34 Q37 37 39 31 Q43 24 37 20 Q32 16 28 23"
              fill="#fff"
            />
            <path d="M30 24 L32 28" strokeWidth="2.5" />
          </g>
        </g>
        <path
          className="calendar-ribbon"
          d="M77 78 Q62 72 54 82 L60 88 L48 96 Q67 100 78 86"
          fill="#2f994a"
        />
        <path d="M77 72 L63 150 L80 162 L98 80Z" fill="#e5eadd" />
        <path d="M63 150 L80 149 L80 162" stroke="#506049" strokeWidth="2.5" />
        <g transform="translate(119 156)">
          <g className="calendar-leg calendar-leg-front">
            <path d="M-5 0 Q-9 12-5 26 L5 26 Q9 13 5 0" fill="#fff" />
            <g transform="translate(0 25)">
              <g className="calendar-shin calendar-shin-front">
                <path d="M-5 0 L-5 22 Q0 28 5 22 L5 0" fill="#fff" />
                <path
                  d="M-5 15 H5 M-5 19 H5"
                  stroke="#28833c"
                  strokeWidth="2.5"
                />
                <g transform="translate(0 24)">
                  <path
                    d="M-7-3 Q0-7 6-2 L13 4 Q25 2 27 9 Q27 16 17 17 H-9 Q-13 8-7-3Z"
                    fill="#2d9c48"
                  />
                  <path
                    d="M-11 11 Q7 15 26 9 L26 14 Q10 21-10 16Z"
                    fill="#fff"
                  />
                  <path
                    d="M8 3 L4 7 M13 5 L9 9"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                </g>
              </g>
            </g>
          </g>
        </g>
        <g transform="rotate(-5 120 116)">
          <path
            d="M82 63 Q80 58 88 58 H159 Q166 58 167 65 L175 158 Q176 164 168 164 H78 Q72 164 74 156Z"
            fill="#fffef9"
          />
          <path d="M81 68 H167 L169 91 H79Z" fill="#fff" />
          <path d="M81 75 H168 L169 84 H80Z" fill="#218439" strokeWidth="2.5" />
          <path d="M91 65 C84 48 92 44 96 51 Q100 58 97 65 M111 65 C104 48 112 44 116 51 Q120 58 117 65 M131 65 C124 48 132 44 136 51 Q140 58 137 65 M151 65 C144 48 152 44 156 51 Q160 58 157 65" />
          <ellipse
            cx="109"
            cy="108"
            rx="3.5"
            ry="5.5"
            fill="#17251c"
            stroke="none"
          />
          <ellipse
            cx="146"
            cy="108"
            rx="3.5"
            ry="5.5"
            fill="#17251c"
            stroke="none"
          />
          <path d="M120 112 Q127 122 135 112" strokeWidth="3" />
          <path d="M92 130 H160 L162 153 H90Z" fill="#fff" strokeWidth="2.5" />
          <path d="M107 141 H124 V153 H106Z" fill="#2d9846" stroke="none" />
          <path
            d="M91 141 H161 M109 130 L107 153 M126 130 L125 153 M143 130 L143 153"
            strokeWidth="2"
          />
        </g>
        <g transform="translate(79 111)">
          <g className="calendar-arm calendar-arm-front">
            <path
              d="M0-5 Q-19-7-25 7 L-28 17 L-19 21 L-15 11 Q-10 4 0 5"
              fill="#fff"
            />
            <path d="M-29 14 L-18 18 L-22 28 L-33 24Z" fill="#299443" />
            <path
              d="M-32 24 Q-40 24-41 32 Q-44 42-36 44 Q-31 45-30 38 Q-23 43-21 36 Q-17 29-25 27"
              fill="#fff"
            />
            <path d="M-31 30 L-33 34" strokeWidth="2.5" />
          </g>
        </g>
      </g>
    </svg>
  );
}
