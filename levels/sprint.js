'use strict';
(function (C) {
  C.registerLevel({
    id: 'sprint',
    order: 1,
    name: 'Sprint',
    description: 'Velocidad pura: limpia líneas antes de que se acabe el tiempo.',
    objective: 'Limpia 40 líneas en menos de 2 minutos',
    lose: 'Se agota el tiempo o el tablero se llena',
    modifiers: { targetLines: 40, timeLimit: 120 },
  });
})(typeof require !== 'undefined' ? require('../challenge.js') : Challenge);
