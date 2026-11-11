'use strict';
(function (C) {
  C.registerLevel({
    id: 'a-ciegas',
    order: 4,
    name: 'A ciegas',
    description: 'Las piezas se vuelven invisibles al asentarse. Memoriza el tablero.',
    objective: 'Limpia 20 líneas',
    lose: 'El tablero se llena',
    modifiers: { targetLines: 20, invisiblePieces: true },
  });
})(typeof require !== 'undefined' ? require('../challenge.js') : Challenge);
