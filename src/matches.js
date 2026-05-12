// src/matches.js

const MATCHES = [
  // Grupo A
  { id:'A1', group:'A', date:'2026-06-11', time:'15:00', t1:'México',         t2:'Sudáfrica',      venue:'Est. Ciudad de México' },
  { id:'A2', group:'A', date:'2026-06-11', time:'22:00', t1:'Rep. de Corea',  t2:'Rep. Checa',     venue:'Est. Guadalajara' },
  { id:'A3', group:'A', date:'2026-06-18', time:'12:00', t1:'Rep. Checa',     t2:'Sudáfrica',      venue:'Atlanta Stadium' },
  { id:'A4', group:'A', date:'2026-06-18', time:'21:00', t1:'México',         t2:'Rep. de Corea',  venue:'Est. Guadalajara' },
  { id:'A5', group:'A', date:'2026-06-24', time:'21:00', t1:'Rep. Checa',     t2:'México',         venue:'Est. Ciudad de México' },
  { id:'A6', group:'A', date:'2026-06-24', time:'21:00', t1:'Sudáfrica',      t2:'Rep. de Corea',  venue:'Est. Monterrey' },
  // Grupo B
  { id:'B1', group:'B', date:'2026-06-12', time:'15:00', t1:'Canadá',         t2:'Bosnia y Herz.', venue:'Toronto Stadium' },
  { id:'B2', group:'B', date:'2026-06-13', time:'15:00', t1:'Catar',          t2:'Suiza',          venue:'San Francisco Bay Area' },
  { id:'B3', group:'B', date:'2026-06-18', time:'15:00', t1:'Suiza',          t2:'Bosnia y Herz.', venue:'Los Angeles Stadium' },
  { id:'B4', group:'B', date:'2026-06-18', time:'18:00', t1:'Canadá',         t2:'Catar',          venue:'BC Place Vancouver' },
  { id:'B5', group:'B', date:'2026-06-24', time:'15:00', t1:'Suiza',          t2:'Canadá',         venue:'BC Place Vancouver' },
  { id:'B6', group:'B', date:'2026-06-24', time:'15:00', t1:'Bosnia y Herz.', t2:'Catar',          venue:'Seattle Stadium' },
  // Grupo C
  { id:'C1', group:'C', date:'2026-06-13', time:'18:00', t1:'Brasil',         t2:'Marruecos',      venue:'NY New Jersey Stadium' },
  { id:'C2', group:'C', date:'2026-06-13', time:'21:00', t1:'Haití',          t2:'Escocia',        venue:'Boston Stadium' },
  { id:'C3', group:'C', date:'2026-06-19', time:'18:00', t1:'Escocia',        t2:'Marruecos',      venue:'Boston Stadium' },
  { id:'C4', group:'C', date:'2026-06-19', time:'21:00', t1:'Brasil',         t2:'Haití',          venue:'Philadelphia Stadium' },
  { id:'C5', group:'C', date:'2026-06-24', time:'18:00', t1:'Brasil',         t2:'Escocia',        venue:'Miami Stadium' },
  { id:'C6', group:'C', date:'2026-06-24', time:'18:00', t1:'Marruecos',      t2:'Haití',          venue:'Atlanta Stadium' },
  // Grupo D
  { id:'D1', group:'D', date:'2026-06-12', time:'21:00', t1:'Estados Unidos', t2:'Paraguay',       venue:'Los Angeles Stadium' },
  { id:'D2', group:'D', date:'2026-06-13', time:'00:00', t1:'Australia',      t2:'Turquía',        venue:'BC Place Vancouver' },
  { id:'D3', group:'D', date:'2026-06-19', time:'15:00', t1:'Estados Unidos', t2:'Australia',      venue:'Seattle Stadium' },
  { id:'D4', group:'D', date:'2026-06-19', time:'00:00', t1:'Turquía',        t2:'Paraguay',       venue:'San Francisco Bay Area' },
  { id:'D5', group:'D', date:'2026-06-25', time:'22:00', t1:'Turquía',        t2:'Estados Unidos', venue:'Los Angeles Stadium' },
  { id:'D6', group:'D', date:'2026-06-25', time:'22:00', t1:'Paraguay',       t2:'Australia',      venue:'San Francisco Bay Area' },
  // Grupo E
  { id:'E1', group:'E', date:'2026-06-14', time:'13:00', t1:'Alemania',       t2:'Curazao',          venue:'Houston Stadium' },
  { id:'E2', group:'E', date:'2026-06-14', time:'19:00', t1:'Costa de Marfil',t2:'Ecuador',          venue:'Philadelphia Stadium' },
  { id:'E3', group:'E', date:'2026-06-20', time:'16:00', t1:'Alemania',       t2:'Costa de Marfil',  venue:'Toronto Stadium' },
  { id:'E4', group:'E', date:'2026-06-20', time:'22:00', t1:'Ecuador',        t2:'Curazao',          venue:'Kansas City Stadium' },
  { id:'E5', group:'E', date:'2026-06-25', time:'16:00', t1:'Curazao',        t2:'Costa de Marfil',  venue:'Philadelphia Stadium' },
  { id:'E6', group:'E', date:'2026-06-25', time:'16:00', t1:'Ecuador',        t2:'Alemania',         venue:'NY New Jersey Stadium' },
  // Grupo F
  { id:'F1', group:'F', date:'2026-06-14', time:'16:00', t1:'Países Bajos',   t2:'Japón',          venue:'Dallas Stadium' },
  { id:'F2', group:'F', date:'2026-06-14', time:'22:00', t1:'Suecia',         t2:'Túnez',          venue:'Est. Monterrey' },
  { id:'F3', group:'F', date:'2026-06-20', time:'13:00', t1:'Países Bajos',   t2:'Suecia',         venue:'Houston Stadium' },
  { id:'F4', group:'F', date:'2026-06-20', time:'00:00', t1:'Túnez',          t2:'Japón',          venue:'Est. Monterrey' },
  { id:'F5', group:'F', date:'2026-06-25', time:'19:00', t1:'Japón',          t2:'Suecia',         venue:'Dallas Stadium' },
  { id:'F6', group:'F', date:'2026-06-25', time:'19:00', t1:'Túnez',          t2:'Países Bajos',   venue:'Kansas City Stadium' },
  // Grupo G
  { id:'G1', group:'G', date:'2026-06-15', time:'15:00', t1:'Bélgica',        t2:'Egipto',         venue:'Seattle Stadium' },
  { id:'G2', group:'G', date:'2026-06-15', time:'21:00', t1:'RI de Irán',     t2:'Nueva Zelanda',  venue:'Los Angeles Stadium' },
  { id:'G3', group:'G', date:'2026-06-21', time:'15:00', t1:'Bélgica',        t2:'RI de Irán',     venue:'Los Angeles Stadium' },
  { id:'G4', group:'G', date:'2026-06-21', time:'21:00', t1:'Nueva Zelanda',  t2:'Egipto',         venue:'BC Place Vancouver' },
  { id:'G5', group:'G', date:'2026-06-26', time:'23:00', t1:'Egipto',         t2:'RI de Irán',     venue:'Seattle Stadium' },
  { id:'G6', group:'G', date:'2026-06-26', time:'23:00', t1:'Nueva Zelanda',  t2:'Bélgica',        venue:'BC Place Vancouver' },
  // Grupo H
  { id:'H1', group:'H', date:'2026-06-15', time:'12:00', t1:'España',         t2:'Cabo Verde',     venue:'Atlanta Stadium' },
  { id:'H2', group:'H', date:'2026-06-15', time:'18:00', t1:'Arabia Saudí',   t2:'Uruguay',        venue:'Miami Stadium' },
  { id:'H3', group:'H', date:'2026-06-21', time:'12:00', t1:'España',         t2:'Arabia Saudí',   venue:'Atlanta Stadium' },
  { id:'H4', group:'H', date:'2026-06-21', time:'18:00', t1:'Uruguay',        t2:'Cabo Verde',     venue:'Miami Stadium' },
  { id:'H5', group:'H', date:'2026-06-26', time:'20:00', t1:'Cabo Verde',     t2:'Arabia Saudí',   venue:'Houston Stadium' },
  { id:'H6', group:'H', date:'2026-06-26', time:'20:00', t1:'Uruguay',        t2:'España',         venue:'Est. Guadalajara' },
  // Grupo I
  { id:'I1', group:'I', date:'2026-06-16', time:'15:00', t1:'Francia',        t2:'Senegal',        venue:'NY New Jersey Stadium' },
  { id:'I2', group:'I', date:'2026-06-16', time:'18:00', t1:'Irak',           t2:'Noruega',        venue:'Boston Stadium' },
  { id:'I3', group:'I', date:'2026-06-22', time:'17:00', t1:'Francia',        t2:'Irak',           venue:'Philadelphia Stadium' },
  { id:'I4', group:'I', date:'2026-06-22', time:'20:00', t1:'Noruega',        t2:'Senegal',        venue:'NY New Jersey Stadium' },
  { id:'I5', group:'I', date:'2026-06-26', time:'15:00', t1:'Noruega',        t2:'Francia',        venue:'Boston Stadium' },
  { id:'I6', group:'I', date:'2026-06-26', time:'15:00', t1:'Senegal',        t2:'Irak',           venue:'Toronto Stadium' },
  // Grupo J
  { id:'J1', group:'J', date:'2026-06-16', time:'21:00', t1:'Argentina',      t2:'Argelia',        venue:'Kansas City Stadium' },
  { id:'J2', group:'J', date:'2026-06-16', time:'00:00', t1:'Austria',        t2:'Jordania',       venue:'San Francisco Bay Area' },
  { id:'J3', group:'J', date:'2026-06-22', time:'13:00', t1:'Argentina',      t2:'Austria',        venue:'Dallas Stadium' },
  { id:'J4', group:'J', date:'2026-06-22', time:'23:00', t1:'Jordania',       t2:'Argelia',        venue:'San Francisco Bay Area' },
  { id:'J5', group:'J', date:'2026-06-27', time:'22:00', t1:'Argelia',        t2:'Austria',        venue:'Kansas City Stadium' },
  { id:'J6', group:'J', date:'2026-06-27', time:'22:00', t1:'Jordania',       t2:'Argentina',      venue:'Dallas Stadium' },
  // Grupo K
  { id:'K1', group:'K', date:'2026-06-17', time:'13:00', t1:'Portugal',       t2:'RD Congo/Jamaica', venue:'Houston Stadium' },
  { id:'K2', group:'K', date:'2026-06-17', time:'22:00', t1:'Uzbekistán',     t2:'Colombia',         venue:'Est. Ciudad de México' },
  { id:'K3', group:'K', date:'2026-06-23', time:'13:00', t1:'Portugal',       t2:'Uzbekistán',       venue:'Houston Stadium' },
  { id:'K4', group:'K', date:'2026-06-23', time:'22:00', t1:'Colombia',       t2:'RD Congo/Jamaica', venue:'Est. Guadalajara' },
  { id:'K5', group:'K', date:'2026-06-27', time:'19:30', t1:'Colombia',       t2:'Portugal',         venue:'Miami Stadium' },
  { id:'K6', group:'K', date:'2026-06-27', time:'19:30', t1:'RD Congo/Jamaica',t2:'Uzbekistán',      venue:'Atlanta Stadium' },
  // Grupo L
  { id:'L1', group:'L', date:'2026-06-17', time:'16:00', t1:'Inglaterra',     t2:'Croacia',        venue:'Dallas Stadium' },
  { id:'L2', group:'L', date:'2026-06-17', time:'19:00', t1:'Ghana',          t2:'Panamá',         venue:'Toronto Stadium' },
  { id:'L3', group:'L', date:'2026-06-23', time:'16:00', t1:'Inglaterra',     t2:'Ghana',          venue:'Boston Stadium' },
  { id:'L4', group:'L', date:'2026-06-23', time:'19:00', t1:'Panamá',         t2:'Croacia',        venue:'Toronto Stadium' },
  { id:'L5', group:'L', date:'2026-06-27', time:'17:00', t1:'Panamá',         t2:'Inglaterra',     venue:'NY New Jersey Stadium' },
  { id:'L6', group:'L', date:'2026-06-27', time:'17:00', t1:'Croacia',        t2:'Ghana',          venue:'Philadelphia Stadium' },
];

function calcPoints(pred, real) {
  if (pred.g1 === real.g1 && pred.g2 === real.g2) return 3;
  const predSign = Math.sign(pred.g1 - pred.g2);
  const realSign = Math.sign(real.g1 - real.g2);
  if (predSign === realSign) return 2;
  return 1;
}

module.exports = { MATCHES, calcPoints };
