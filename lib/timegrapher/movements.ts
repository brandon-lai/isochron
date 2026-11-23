/*
    Isochron — Movement Caliber Presets
    Lift angles sourced from manufacturer technical sheets (ETA, Sellita, Rolex,
    Omega, Seiko/TMI, Miyota, Unitas, Zenith) and vacaboja/tg defaults.
    Licensed under GPL-2.0-only.
*/

export interface MovementPreset {
  id: string;
  maker: string;
  caliber: string;
  bph: number | null; // null = auto-detect BPH
  liftAngle: number;
  notes?: string;
}

export const DEFAULT_LIFT_ANGLE = 52;
export const AUTO_MOVEMENT_ID = "auto-52";

export const STANDARD_BPH_OPTIONS = [
  { value: 0, label: "Auto BPH" },
  { value: 18000, label: "18,000 BPH (2.5 Hz)" },
  { value: 19800, label: "19,800 BPH (2.75 Hz)" },
  { value: 21600, label: "21,600 BPH (3.0 Hz)" },
  { value: 25200, label: "25,200 BPH (3.5 Hz)" },
  { value: 28800, label: "28,800 BPH (4.0 Hz)" },
  { value: 36000, label: "36,000 BPH (5.0 Hz)" },
] as const;

export const MOVEMENT_PRESETS: MovementPreset[] = [
  {
    id: "auto-52",
    maker: "Universal",
    caliber: "Auto-detect BPH (52° default)",
    bph: null,
    liftAngle: 52,
    notes: "Detects beat rate automatically; uses standard 52° lift angle unless adjusted.",
  },
  // Seiko / TMI
  { id: "seiko-nh35", maker: "Seiko / TMI", caliber: "NH35 / 4R35", bph: 21600, liftAngle: 53 },
  { id: "seiko-nh34", maker: "Seiko / TMI", caliber: "NH34 GMT / 4R34", bph: 21600, liftAngle: 53 },
  { id: "seiko-nh36", maker: "Seiko / TMI", caliber: "NH36 / 4R36", bph: 21600, liftAngle: 53 },
  { id: "seiko-6r15", maker: "Seiko", caliber: "6R15 / 6R35", bph: 21600, liftAngle: 53 },
  { id: "seiko-7s26", maker: "Seiko", caliber: "7S26", bph: 21600, liftAngle: 53 },
  { id: "gs-9s65", maker: "Grand Seiko", caliber: "9S65", bph: 28800, liftAngle: 53 },
  { id: "gs-9s85", maker: "Grand Seiko", caliber: "9S85 Hi-Beat", bph: 36000, liftAngle: 53 },

  // ETA / Valjoux / Unitas
  { id: "eta-2824-2", maker: "ETA", caliber: "2824-2", bph: 28800, liftAngle: 50 },
  { id: "eta-2892-a2", maker: "ETA", caliber: "2892-A2", bph: 28800, liftAngle: 51 },
  { id: "eta-7750", maker: "ETA / Valjoux", caliber: "7750", bph: 28800, liftAngle: 49 },
  { id: "eta-6497-1", maker: "ETA / Unitas", caliber: "6497-1 / 6498-1", bph: 18000, liftAngle: 44 },
  { id: "eta-c07", maker: "ETA / Tissot", caliber: "Powermatic 80 (C07.111)", bph: 21600, liftAngle: 53 },

  // Sellita
  { id: "sellita-sw200", maker: "Sellita", caliber: "SW200-1", bph: 28800, liftAngle: 50 },
  { id: "sellita-sw300", maker: "Sellita", caliber: "SW300-1", bph: 28800, liftAngle: 51 },
  { id: "sellita-sw500", maker: "Sellita", caliber: "SW500", bph: 28800, liftAngle: 49 },

  // Rolex & Tudor
  { id: "rolex-3135", maker: "Rolex", caliber: "3135 / 3186", bph: 28800, liftAngle: 52 },
  { id: "rolex-3235", maker: "Rolex", caliber: "3235 / 3285 (Chronergy)", bph: 28800, liftAngle: 55 },
  { id: "rolex-4130", maker: "Rolex", caliber: "4130", bph: 28800, liftAngle: 52 },
  { id: "tudor-mt5602", maker: "Tudor", caliber: "MT5602 / MT5402", bph: 28800, liftAngle: 49 },

  // Omega (note Co-Axial geometry)
  {
    id: "omega-1861",
    maker: "Omega",
    caliber: "1861 / 861 Speedmaster",
    bph: 21600,
    liftAngle: 51,
  },
  {
    id: "omega-3861",
    maker: "Omega",
    caliber: "3861 Master Co-Axial",
    bph: 21600,
    liftAngle: 30,
    notes: "Co-Axial escapements require dedicated Witschi Co-Axial mode for exact amplitude; rate and beat error remain exact.",
  },
  {
    id: "omega-8800",
    maker: "Omega",
    caliber: "8800 / 8900 Co-Axial",
    bph: 25200,
    liftAngle: 38,
    notes: "25,200 BPH Co-Axial; rate and beat error are exact, amplitude is approximate.",
  },

  // Miyota / Citizen
  { id: "miyota-9015", maker: "Miyota", caliber: "9015 / 9039", bph: 28800, liftAngle: 51 },
  { id: "miyota-9075", maker: "Miyota", caliber: "9075 Flyer GMT", bph: 28800, liftAngle: 51 },
  { id: "miyota-8215", maker: "Miyota", caliber: "8215 / 821A", bph: 21600, liftAngle: 49 },

  // Zenith / Nomos / Vostok / Sea-Gull
  { id: "zenith-400", maker: "Zenith", caliber: "El Primero 400 / 3600", bph: 36000, liftAngle: 53 },
  { id: "nomos-alpha", maker: "Nomos", caliber: "Alpha", bph: 21600, liftAngle: 49 },
  { id: "seagull-st1901", maker: "Sea-Gull", caliber: "ST1901 Chronograph", bph: 21600, liftAngle: 49 },
  { id: "pt5000", maker: "HK Precision", caliber: "PT5000", bph: 28800, liftAngle: 50 },
  { id: "vostok-2416b", maker: "Vostok", caliber: "2416B", bph: 19800, liftAngle: 42 },
];

export function findPreset(id: string): MovementPreset {
  return MOVEMENT_PRESETS.find((p) => p.id === id) ?? MOVEMENT_PRESETS[0];
}
