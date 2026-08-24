import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { MARUNGKO_ORDER } from '@/lib/letterDays';

export interface LetterProgress {
  letter: string;
  uppercase: string;
  lowercase: string;
  sound: string;
  exampleWord: string;
  completed: boolean;
  tracingCompleted: boolean;
  listeningCompleted: boolean;
  assessmentScore: number;
}

export interface LetterAsset {
  word: string;
  image: string;
  sound: string;
}

export type AppPhase =
  | 'anticipatory'
  | 'instruction'
  | 'guided'
  | 'independent'
  | 'drag-assessment'
  | 'assessment'
  | 'review-relearn';

export interface AppContextType {
  currentLetter: LetterProgress | null;
  setCurrentLetter: (letter: LetterProgress | null) => void;
  letterProgress: Record<string, LetterProgress>;
  updateLetterProgress: (letter: string, progress: Partial<LetterProgress>) => void;
  currentPhase: AppPhase;
  setCurrentPhase: (phase: AppPhase) => void;
  currentDay: number;
  setCurrentDay: (day: number) => void;
  allLetters: LetterProgress[];
  overallProgress: number;
  consumeNextAsset: () => LetterAsset | null;
  peekCurrentAsset: () => LetterAsset | null;
  advanceQueue: (steps?: number) => void;
  resetAssetQueue: () => void;
  resetForNewUser: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LETTER_ASSETS: Record<string, LetterAsset[]> = {
  a: [
    { word: 'agila', image: '/allimages/A-agila.png', sound: '/sounds/A_agila.mp3' },
    { word: 'aklat', image: '/allimages/A-aklat.png', sound: '/sounds/A_aklat.mp3' },
    { word: 'apoy',  image: '/allimages/A-apoy.png',  sound: '/sounds/A_apoy.mp3'  },
    { word: 'araw',  image: '/allimages/A-araw.png',  sound: '/sounds/A_araw.mp3'  },
    { word: 'aso',   image: '/allimages/A-aso.png',   sound: '/sounds/A_aso.mp3'   },
  ],
  b: [
    { word: 'bahay', image: '/allimages/B-bahay.png', sound: '/sounds/B_bahay.mp3' },
    { word: 'baso',  image: '/allimages/B-baso.png',  sound: '/sounds/B_baso.mp3'  },
    { word: 'bato',  image: '/allimages/B-bato.png',  sound: '/sounds/B_bato.mp3'  },
    { word: 'bola',  image: '/allimages/B-bola.png',  sound: '/sounds/B_bola.mp3'  },
    { word: 'buko',  image: '/allimages/B-buko.png',  sound: '/sounds/B_buko.mp3'  },
    { word: 'bus',   image: '/allimages/B-bus.png',   sound: '/sounds/B_bus.mp3'   },
  ],
  c: [
    { word: 'cactus',       image: '/allimages/C-cactus.png',       sound: '/sounds/C_cactus.mp3'       },
    { word: 'cake',         image: '/allimages/C-cake.png',         sound: '/sounds/C_cake.mp3'         },
    { word: 'calculator',   image: '/allimages/C-calculator.png',   sound: '/sounds/C_calculator.mp3'   },
    { word: 'camel',        image: '/allimages/C-camel.png',        sound: '/sounds/C_camel.mp3'        },
    { word: 'camera',       image: '/allimages/C-camera.png',       sound: '/sounds/C_camera.mp3'       },
    { word: 'caterpillar',  image: '/allimages/C-caterpillar.png',  sound: '/sounds/C_caterpillar.mp3'  },
    { word: 'cookies',      image: '/allimages/C-cookies.png',      sound: '/sounds/C_cookies.mp3'      },
  ],
  d: [
    { word: 'daga',  image: '/allimages/D-daga.png',  sound: '/sounds/D_daga.mp3'  },
    { word: 'dahon', image: '/allimages/D-dahon.png', sound: '/sounds/D_dahon.mp3' },
    { word: 'damit', image: '/allimages/D-damit.png', sound: '/sounds/D_damit.mp3' },
    { word: 'dila',  image: '/allimages/D-dila.png',  sound: '/sounds/D_dila.mp3'  },
    { word: 'durian',image: '/allimages/D-durian.png',sound: '/sounds/D_durian.mp3'},
    { word: 'duyan', image: '/allimages/D-duyan.png', sound: '/sounds/D_duyan.mp3' },
  ],
  e: [
    { word: 'elepante',  image: '/allimages/E-elepante.png',  sound: '/sounds/E_elepante.mp3'  },
    { word: 'empanada',  image: '/allimages/E-empanada.png',  sound: '/sounds/E_empanada.mp3'  },
    { word: 'ensaymada', image: '/allimages/E-ensaymada.png', sound: '/sounds/E_ensaymada.mp3' },
    { word: 'eroplano',  image: '/allimages/E-eroplano.png',  sound: '/sounds/E_eroplano.mp3'  },
    { word: 'espada',    image: '/allimages/E-espada.png',    sound: '/sounds/E_espada.mp3'    },
    { word: 'espageti',  image: '/allimages/E-espageti.png',  sound: '/sounds/E_espageti.mp3'  },
  ],
  f: [
    { word: 'facemask',    image: '/allimages/F-facemask.png',    sound: '/sounds/F_facemask.mp3'    },
    { word: 'filipiniana', image: '/allimages/F-filipiniana.png', sound: '/sounds/F_filipiniana.mp3' },
    { word: 'flashlight',  image: '/allimages/F-flashlight.png',  sound: '/sounds/F_flashlight.mp3'  },
    { word: 'flute',       image: '/allimages/F-flute.png',       sound: '/sounds/F_flute.mp3'       },
    { word: 'folder',      image: '/allimages/F-folder.png',      sound: '/sounds/F_folder.mp3'      },
    { word: 'football',    image: '/allimages/F-football.png',    sound: '/sounds/F_football.mp3'    },
    { word: 'fries',       image: '/allimages/F-fries.png',       sound: '/sounds/F_fries.mp3'       },
  ],
  g: [
    { word: 'gabi',     image: '/allimages/G-gabi.png',     sound: '/sounds/G_gabi.mp3'     },
    { word: 'gagamba',  image: '/allimages/G-gagamba.png',  sound: '/sounds/G_gagamba.mp3'  },
    { word: 'gatas',    image: '/allimages/G-gatas.png',    sound: '/sounds/G_gatas.mp3'    },
    { word: 'gitara',   image: '/allimages/G-gitara.png',   sound: '/sounds/G_gitara.mp3'   },
    { word: 'globo',    image: '/allimages/G-globo.png',    sound: '/sounds/G_globo.mp3'    },
    { word: 'gripo',    image: '/allimages/G-gripo.png',    sound: '/sounds/G_gripo.mp3'    },
    { word: 'gunting',  image: '/allimages/G-gunting.png',  sound: '/sounds/G_gunting.mp3'  },
  ],
  h: [
    { word: 'hagdan',     image: '/allimages/H-hagdan.png',     sound: '/sounds/H_hagdan.mp3'     },
    { word: 'helicopter', image: '/allimages/H-helicopter.png', sound: '/sounds/H_helicopter.mp3' },
    { word: 'hikaw',      image: '/allimages/H-hikaw.png',      sound: '/sounds/H_hikaw.mp3'      },
    { word: 'hinlalaki',  image: '/allimages/H-hinlalaki.png',  sound: '/sounds/H_hinlalaki.mp3'  },
    { word: 'hipon',      image: '/allimages/H-hipon.png',      sound: '/sounds/H_hipon.mp3'      },
    { word: 'holen',      image: '/allimages/H-holen.png',      sound: '/sounds/H_holen.mp3'      },
  ],
  i: [
    { word: 'ibon',  image: '/allimages/I-ibon.png',  sound: '/sounds/I_ibon.mp3'  },
    { word: 'ilaw',  image: '/allimages/I-ilaw.png',  sound: '/sounds/I_ilaw.mp3'  },
    { word: 'ina',   image: '/allimages/I-ina.png',   sound: '/sounds/I_ina.mp3'   },
    { word: 'isda',  image: '/allimages/I-isda.png',  sound: '/sounds/I_isda.mp3'  },
    { word: 'isla',  image: '/allimages/I-isla.png',  sound: '/sounds/I_isla.mp3'  },
    { word: 'itlog', image: '/allimages/I-itlog.png', sound: '/sounds/I_itlog.mp3' },
  ],
  j: [
    { word: 'jacket',   image: '/allimages/J-jacket.png',   sound: '/sounds/J_jacket.mp3'   },
    { word: 'jaguar',   image: '/allimages/J-jaguar.png',   sound: '/sounds/J_jaguar.mp3'   },
    { word: 'jam',      image: '/allimages/J-jam.png',      sound: '/sounds/J_jam.mp3'      },
    { word: 'janitor',  image: '/allimages/J-janitor.png',  sound: '/sounds/J_janitor.mp3'  },
    { word: 'joker',    image: '/allimages/J-joker.png',    sound: '/sounds/J_joker.mp3'    },
    { word: 'jollibee', image: '/allimages/J-jollibee.png', sound: '/sounds/J_jollibee.mp3' },
    { word: 'jupiter',  image: '/allimages/J-jupiter.png',  sound: '/sounds/J_jupiter.mp3'  },
  ],
  
  w: [
    { word: 'waffle',      image: '/allimages/W-waffle.png',      sound: '/sounds/W_waffle.mp3'      },
    { word: 'waling-waling',image: '/allimages/W-waling-waling.png',sound: '/sounds/W_waling-waling.mp3'},
    { word: 'walis',       image: '/allimages/W-walis.png',       sound: '/sounds/W_walis.mp3'       },
    { word: 'watawat',     image: '/allimages/W-watawat.png',     sound: '/sounds/W_watawat.mp3'     },
    { word: 'waterlily',   image: '/allimages/W-waterlily.png',   sound: '/sounds/W_waterlily.mp3'   },
    { word: 'wheelchair',  image: '/allimages/W-wheelchair.png',  sound: '/sounds/W_wheelchair.mp3'  },
  ],
  k: [
    { word: 'kama',    image: '/allimages/K-kama.png',    sound: '/sounds/K_kama.mp3'    },
    { word: 'kamatis', image: '/allimages/K-kamatis.png', sound: '/sounds/K_kamatis.mp3' },
    { word: 'kamay',   image: '/allimages/K-kamay.png',   sound: '/sounds/K_kamay.mp3'   },
    { word: 'kanin',   image: '/allimages/K-kanin.png',   sound: '/sounds/K_kanin.mp3'   },
    { word: 'kotse',   image: '/allimages/K-kotse.png',   sound: '/sounds/K_kotse.mp3'   },
    { word: 'kubo',    image: '/allimages/K-kubo.png',    sound: '/sounds/K_kubo.mp3'    },
    { word: 'kutsara', image: '/allimages/K-kutsara.png', sound: '/sounds/K_kutsara.mp3' },
  ],
  l: [
    { word: 'langaw', image: '/allimages/L-langaw.png', sound: '/sounds/L_langaw.mp3' },
    { word: 'lapis',  image: '/allimages/L-lapis.png',  sound: '/sounds/L_lapis.mp3'  },
    { word: 'laruan', image: '/allimages/L-laruan.png', sound: '/sounds/L_laruan.mp3' },
    { word: 'leon',   image: '/allimages/L-leon.png',   sound: '/sounds/L_leon.mp3'   },
    { word: 'libro',  image: '/allimages/L-libro.png',  sound: '/sounds/L_libro.mp3'  },
    { word: 'lobo',   image: '/allimages/L-lobo.png',   sound: '/sounds/L_lobo.mp3'   },
  ],
  m: [
    { word: 'malungay', image: '/allimages/M-malungay.png', sound: '/sounds/M_malungay.mp3' },
    { word: 'mango',    image: '/allimages/M-mango.png',    sound: '/sounds/M_mango.mp3'    },
    { word: 'manok',    image: '/allimages/M-manok.png',    sound: '/sounds/M_manok.mp3'    },
    { word: 'mapa',     image: '/allimages/M-mapa.png',     sound: '/sounds/M_mapa.mp3'     },
    { word: 'medyas',   image: '/allimages/M-medyas.png',   sound: '/sounds/M_medyas.mp3'   },
    { word: 'motor',    image: '/allimages/M-motor.png',    sound: '/sounds/M_motor.mp3'    },
    { word: 'mundo',    image: '/allimages/M-mundo.png',    sound: '/sounds/M_mundo.mp3'    },
  ],
  n: [
    { word: 'ngipin', image: '/allimages/N-ngipin.png', sound: '/sounds/N_ngipin.mp3' },
    { word: 'nipa',   image: '/allimages/N-nipa.png',   sound: '/sounds/N_nipa.mp3'   },
    { word: 'niyog',  image: '/allimages/N-niyog.png',  sound: '/sounds/N_niyog.mp3'  },
    { word: 'noo',    image: '/allimages/N-noo.png',    sound: '/sounds/N_noo.mp3'    },
    { word: 'nota',   image: '/allimages/N-nota.png',   sound: '/sounds/N_nota.mp3'   },
    { word: 'numero', image: '/allimages/N-numero.png', sound: '/sounds/N_numero.mp3' },
    { word: 'nunal',  image: '/allimages/N-nunal.png',  sound: '/sounds/N_nunal.mp3'  },
  ],
  o: [
    { word: 'okra',    image: '/allimages/O-okra.png',    sound: '/sounds/O_okra.mp3'    },
    { word: 'oktopus', image: '/allimages/O-oktopus.png', sound: '/sounds/O_oktopus.mp3' },
    { word: 'orange',  image: '/allimages/O-orange.png',  sound: '/sounds/O_orange.mp3'  },
    { word: 'orasan',  image: '/allimages/O-orasan.png',  sound: '/sounds/O_orasan.mp3'  },
    { word: 'oso',     image: '/allimages/O-oso.png',     sound: '/sounds/O_oso.mp3'     },
  ],
  p: [
    { word: 'paa',    image: '/allimages/P-paa.png',    sound: '/sounds/P_paa.mp3'    },
    { word: 'pagong', image: '/allimages/P-pagong.png', sound: '/sounds/P_pagong.mp3' },
    { word: 'papaya', image: '/allimages/P-papaya.png', sound: '/sounds/P_papaya.mp3' },
    { word: 'payong', image: '/allimages/P-payong.png', sound: '/sounds/P_payong.mp3' },
    { word: 'pera',   image: '/allimages/P-pera.png',   sound: '/sounds/P_pera.mp3'   },
    { word: 'puno',   image: '/allimages/P-puno.png',   sound: '/sounds/P_puno.mp3'   },
    { word: 'pusa',   image: '/allimages/P-pusa.png',   sound: '/sounds/P_pusa.mp3'   },
  ],
  q: [
    { word: 'quail',      image: '/allimages/Q-quail.png',      sound: '/sounds/Q_quail.mp3'      },
    { word: 'quarts',     image: '/allimages/Q-quarts.png',     sound: '/sounds/Q_quarts.mp3'     },
    { word: 'queen',      image: '/allimages/Q-queen.png',      sound: '/sounds/Q_queen.mp3'      },
    { word: 'quesadilla', image: '/allimages/Q-quesadilla.png', sound: '/sounds/Q_quesadilla.mp3' },
    { word: 'quezon',     image: '/allimages/Q-quezon.png',     sound: '/sounds/Q_quezon.mp3'     },
    { word: 'quill',      image: '/allimages/Q-quill.png',      sound: '/sounds/Q_quill.mp3'      },
    { word: 'quokka',     image: '/allimages/Q-quokka.png',     sound: '/sounds/Q_quokka.mp3'     },
  ],
  r: [
    { word: 'radyo',   image: '/allimages/R-radyo.png',   sound: '/sounds/R_radyo.mp3'   },
    { word: 'relo',    image: '/allimages/R-relo.png',    sound: '/sounds/R_relo.mp3'    },
    { word: 'repolyo', image: '/allimages/R-repolyo.png', sound: '/sounds/R_repolyo.mp3' },
    { word: 'robot',   image: '/allimages/R-robot.png',   sound: '/sounds/R_robot.mp3'   },
    { word: 'rosary',  image: '/allimages/R-rosary.png',  sound: '/sounds/R_rosary.mp3'  },
    { word: 'rosas',   image: '/allimages/R-rosas.png',   sound: '/sounds/R_rosas.mp3'   },
    { word: 'ruler',   image: '/allimages/R-ruler.png',   sound: '/sounds/R_ruler.mp3'   },
  ],
  s: [
    { word: 'saging',    image: '/allimages/S-saging.png',    sound: '/sounds/S_saging.mp3'    },
    { word: 'sandok',    image: '/allimages/S-sandok.png',    sound: '/sounds/S_sandok.mp3'    },
    { word: 'sapatos',   image: '/allimages/S-sapatos.png',   sound: '/sounds/S_sapatos.mp3'   },
    { word: 'sarangola', image: '/allimages/S-sarangola.png', sound: '/sounds/S_sarangola.mp3' },
    { word: 'suklay',    image: '/allimages/S-Suklay.png',    sound: '/sounds/S_suklay.mp3'    },
    { word: 'susi',      image: '/allimages/S-susi.png',      sound: '/sounds/S_susi.mp3'      },
  ],
  t: [
    { word: 'talong',   image: '/allimages/T-talong.png',   sound: '/sounds/T_talong.mp3'   },
    { word: 'telepono', image: '/allimages/T-telepono.png', sound: '/sounds/T_telepono.mp3' },
    { word: 'tigre',    image: '/allimages/T-tigre.png',    sound: '/sounds/T_tigre.mp3'    },
    { word: 'timba',    image: '/allimages/T-timba.png',    sound: '/sounds/T_timba.mp3'    },
    { word: 'tinapay',  image: '/allimages/T-tinapay.png',  sound: '/sounds/T_tinapay.mp3'  },
    { word: 'tupa',     image: '/allimages/T-tupa.png',     sound: '/sounds/T_tupa.mp3'     },
  ],
  u: [
    { word: 'ube',    image: '/allimages/U-ube.png',    sound: '/sounds/U_ube.mp3'    },
    { word: 'ulap',   image: '/allimages/U-ulap.png',   sound: '/sounds/U_ulap.mp3'   },
    { word: 'unan',   image: '/allimages/U-unan.png',   sound: '/sounds/U_unan.mp3'   },
    { word: 'unggoy', image: '/allimages/U-unggoy.png', sound: '/sounds/U_unggoy.mp3' },
    { word: 'upuan',  image: '/allimages/U-upuan.png',  sound: '/sounds/U_upuan.mp3'  },
    { word: 'uwak',   image: '/allimages/U-uwak.png',   sound: '/sounds/U_uwak.mp3'   },
  ],
  v: [
    { word: 'vacuum',    image: '/allimages/V-vacuum.png',    sound: '/sounds/V_vacuum.mp3'    },
    { word: 'van',       image: '/allimages/V-van.png',       sound: '/sounds/V_van.mp3'       },
    { word: 'venus',     image: '/allimages/V-venus.png',     sound: '/sounds/V_venus.mp3'     },
    { word: 'vinta',     image: '/allimages/V-vinta.png',     sound: '/sounds/V_vinta.mp3'     },
    { word: 'violin',    image: '/allimages/V-violin.png',    sound: '/sounds/V_violin.mp3'    },
    { word: 'volleyball',image: '/allimages/V-volleyball.png',sound: '/sounds/V_volleyball.mp3'},
    { word: 'vulture',   image: '/allimages/V-vulture.png',   sound: '/sounds/V_vulture.mp3'   },
  ],
  x: [
    { word: 'x-box',     image: '/allimages/X-x-box.png',     sound: '/sounds/X_x-box.mp3'     },
    { word: 'x-men',     image: '/allimages/X-x-men.jpg',     sound: '/sounds/X_x-men.mp3'     },
    { word: 'x-ray',     image: '/allimages/X-x-ray.png',     sound: '/sounds/X_x-ray.mp3'     },
    { word: 'xerox',     image: '/allimages/X-xerox.png',     sound: '/sounds/X_xerox.mp3'     },
    { word: 'xerus',     image: '/allimages/X-xerus.png',     sound: '/sounds/X_xerus.mp3'     },
    { word: 'xylophone', image: '/allimages/X-xylophone.png', sound: '/sounds/X_xylophone.mp3' },
  ],
  y: [
    { word: 'yakult', image: '/allimages/Y-yakult.png', sound: '/sounds/Y_yakult.mp3' },
    { word: 'yate',   image: '/allimages/Y-yate.png',   sound: '/sounds/Y_yate.mp3'   },
    { word: 'yelo',   image: '/allimages/Y-yelo.png',   sound: '/sounds/Y_yelo.mp3'   },
    { word: 'yema',   image: '/allimages/Y-yema.png',   sound: '/sounds/Y_yema.mp3'   },
    { word: 'yero',   image: '/allimages/Y-yero.png',   sound: '/sounds/Y_yero.mp3'   },
    { word: 'yogurt', image: '/allimages/Y-yogurt.png', sound: '/sounds/Y_yogurt.mp3' },
    { word: 'yoyo',   image: '/allimages/Y-yoyo.png',   sound: '/sounds/Y_yoyo.mp3'   },
  ],
  z: [
    { word: 'zebra',  image: '/allimages/Z-zebra.png',  sound: '/sounds/Z_zebra.mp3'  },
    { word: 'zero',   image: '/allimages/Z-zero.png',   sound: '/sounds/Z_zero.mp3'   },
    { word: 'zest-o', image: '/allimages/Z-zest-o.png', sound: '/sounds/Z_zest-o.mp3' },
    { word: 'zigzag', image: '/allimages/Z-zigzag.png', sound: '/sounds/Z_zigzag.mp3' },
    { word: 'zipper', image: '/allimages/Z-zipper.png', sound: '/sounds/Z_zipper.mp3' },
    { word: 'zoo',    image: '/allimages/Z-zoo.png',    sound: '/sounds/Z_zoo.mp3'    },
  ],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQueue(letter: string): LetterAsset[] {
  const assets = LETTER_ASSETS[letter.toLowerCase()];
  if (!assets || assets.length === 0) return [];
  return shuffle(assets);
}

export function getLetterAssets(letter: string): LetterAsset[] {
  return LETTER_ASSETS[letter.toLowerCase()] ?? [];
}

const LETTER_DETAILS: LetterProgress[] = [
  { letter: 'm', uppercase: 'M', lowercase: 'm', sound: '/m/', exampleWord: 'mesa',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 's', uppercase: 'S', lowercase: 's', sound: '/s/', exampleWord: 'saging',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'a', uppercase: 'A', lowercase: 'a', sound: '/a/', exampleWord: 'araw',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'i', uppercase: 'I', lowercase: 'i', sound: '/i/', exampleWord: 'ibon',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'o', uppercase: 'O', lowercase: 'o', sound: '/o/', exampleWord: 'oras',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'b', uppercase: 'B', lowercase: 'b', sound: '/b/', exampleWord: 'bahay',     completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'e', uppercase: 'E', lowercase: 'e', sound: '/e/', exampleWord: 'espesyal',  completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'u', uppercase: 'U', lowercase: 'u', sound: '/u/', exampleWord: 'ulo',       completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 't', uppercase: 'T', lowercase: 't', sound: '/t/', exampleWord: 'tao',       completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'k', uppercase: 'K', lowercase: 'k', sound: '/k/', exampleWord: 'kain',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'l', uppercase: 'L', lowercase: 'l', sound: '/l/', exampleWord: 'laya',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'y', uppercase: 'Y', lowercase: 'y', sound: '/y/', exampleWord: 'yaya',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'n', uppercase: 'N', lowercase: 'n', sound: '/n/', exampleWord: 'niyog',     completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'g', uppercase: 'G', lowercase: 'g', sound: '/g/', exampleWord: 'gabi',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'p', uppercase: 'P', lowercase: 'p', sound: '/p/', exampleWord: 'puso',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'r', uppercase: 'R', lowercase: 'r', sound: '/r/', exampleWord: 'rosas',     completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'd', uppercase: 'D', lowercase: 'd', sound: '/d/', exampleWord: 'dalan',     completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'h', uppercase: 'H', lowercase: 'h', sound: '/h/', exampleWord: 'halika',    completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'c', uppercase: 'C', lowercase: 'c', sound: '/k/', exampleWord: 'calamansi', completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'f', uppercase: 'F', lowercase: 'f', sound: '/f/', exampleWord: 'flan',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'j', uppercase: 'J', lowercase: 'j', sound: '/j/', exampleWord: 'jusi',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'q', uppercase: 'Q', lowercase: 'q', sound: '/k/', exampleWord: 'queen',     completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'v', uppercase: 'V', lowercase: 'v', sound: '/v/', exampleWord: 'violeta',   completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'x', uppercase: 'X', lowercase: 'x', sound: '/ks/', exampleWord: 'xilofon', completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'z', uppercase: 'Z', lowercase: 'z', sound: '/z/', exampleWord: 'zapatos',   completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'w', uppercase: 'W', lowercase: 'w', sound: '/w/', exampleWord: 'walis', completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
];

const MARUNGKO_LETTERS = MARUNGKO_ORDER.map(letter =>
  LETTER_DETAILS.find(detail => detail.letter === letter)!
);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentLetter, setCurrentLetter] = useState<LetterProgress | null>(MARUNGKO_LETTERS[0]);
  const [currentPhase, setCurrentPhase] = useState<AppPhase>('anticipatory');
  const [currentDay, setCurrentDay] = useState(1);

  const [letterProgress, setLetterProgress] = useState<Record<string, LetterProgress>>(() => {
    const saved = localStorage.getItem('marungko-progress');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Failed to parse saved progress:', e); }
    }
    const initial: Record<string, LetterProgress> = {};
    MARUNGKO_LETTERS.forEach((letter) => { initial[letter.letter] = letter; });
    return initial;
  });

  useEffect(() => {
    localStorage.setItem('marungko-progress', JSON.stringify(letterProgress));
  }, [letterProgress]);

  const updateLetterProgress = (letter: string, progress: Partial<LetterProgress>) => {
    setLetterProgress((prev) => ({ ...prev, [letter]: { ...prev[letter], ...progress } }));
  };

  const queueRef       = useRef<LetterAsset[]>(buildQueue(MARUNGKO_LETTERS[0].letter));
  const queueIndexRef  = useRef<number>(0);
  const queueLetterRef = useRef<string>(MARUNGKO_LETTERS[0].letter);

  const rebuildAssetQueue = useCallback((letter: string) => {
    queueLetterRef.current = letter;
    queueRef.current = buildQueue(letter);
    queueIndexRef.current = 0;
  }, []);

  const setCurrentLetterAndQueue = useCallback((letter: LetterProgress | null) => {
    if (letter) {
      rebuildAssetQueue(letter.letter);
    } else {
      queueLetterRef.current = '';
      queueRef.current = [];
      queueIndexRef.current = 0;
    }
    setCurrentLetter(letter);
  }, [rebuildAssetQueue]);

  useEffect(() => {
    if (!currentLetter) return;
    if (queueLetterRef.current !== currentLetter.letter) {
      rebuildAssetQueue(currentLetter.letter);
    }
  }, [currentLetter]);

  const resetForNewUser = useCallback(() => {
    const first = MARUNGKO_LETTERS[0];
    rebuildAssetQueue(first.letter);
    setCurrentLetter({ ...first });
    setCurrentPhase('anticipatory');
  }, [rebuildAssetQueue]);

  const resetAssetQueue = useCallback(() => {
    if (!currentLetter) return;
    rebuildAssetQueue(currentLetter.letter);
  }, [currentLetter, rebuildAssetQueue]);

  const peekCurrentAsset = useCallback((): LetterAsset | null => {
    const q = queueRef.current;
    if (!q.length) return null;
    return q[queueIndexRef.current % q.length];
  }, []);

  const consumeNextAsset = useCallback((): LetterAsset | null => {
    const q = queueRef.current;
    if (!q.length) return null;
    const asset = q[queueIndexRef.current % q.length];
    queueIndexRef.current += 1;
    if (queueIndexRef.current >= q.length) {
      queueRef.current      = buildQueue(queueLetterRef.current);
      queueIndexRef.current = 0;
    }
    return asset;
  }, []);

  const advanceQueue = useCallback((steps = 1) => {
    const q = queueRef.current;
    if (!q.length) return;
    queueIndexRef.current = (queueIndexRef.current + steps) % q.length;
    if (queueIndexRef.current === 0) {
      queueRef.current = buildQueue(queueLetterRef.current);
    }
  }, []);

  const allLetters       = MARUNGKO_LETTERS;
  const completedLetters = Object.values(letterProgress).filter((l) => l.completed).length;
  const overallProgress  = (completedLetters / allLetters.length) * 100;

  return (
    <AppContext.Provider
      value={{
        currentLetter,
        setCurrentLetter: setCurrentLetterAndQueue,
        letterProgress,
        updateLetterProgress,
        currentPhase,
        setCurrentPhase,
        currentDay,
        setCurrentDay,
        allLetters,
        overallProgress,
        consumeNextAsset,
        peekCurrentAsset,
        advanceQueue,
        resetAssetQueue,
        resetForNewUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
