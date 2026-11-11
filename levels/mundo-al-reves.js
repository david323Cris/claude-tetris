'use strict';
(function (C) {
  C.registerLevel({
    id: 'mundo-al-reves',
    order: 5,
    name: 'Mundo al revés',
    description: 'Tras 10 líneas, la rotación se invierte (horario ↔ antihorario).',
    objective: 'Limpia 30 líneas',
    lose: 'El tablero se llena',
    modifiers: { targetLines: 30, invertedRotation: { afterLines: 10 } },
  });
})(typeof require !== 'undefined' ? require('../challenge.js') : Challenge);
