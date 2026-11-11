'use strict';
(function (C) {
  C.registerLevel({
    id: 'tablero-sembrado',
    order: 3,
    name: 'Tablero sembrado',
    description: 'El tablero empieza con bloques fijos (de color distinto).',
    objective: 'Limpia todos los bloques sembrados',
    lose: 'El tablero se llena',
    modifiers: {
      presetBoard: {
        mustClear: true,
        rows: [
          '#.#..#..#.',
          '.#..##.#..',
          '#..#..#..#',
          '.##..#.##.',
          '#.#.#..#.#',
          '..#.##.#..',
        ],
      },
    },
  });
})(typeof require !== 'undefined' ? require('../challenge.js') : Challenge);
