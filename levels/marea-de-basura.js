'use strict';
(function (C) {
  C.registerLevel({
    id: 'marea-de-basura',
    order: 2,
    name: 'Marea de basura',
    description: 'Cada 10 segundos sube una fila de basura con un hueco al azar.',
    objective: 'Sobrevive 3 minutos',
    lose: 'El tablero se llena',
    modifiers: { timeLimit: { seconds: 180, onExpire: 'win' }, garbageInterval: 10 },
  });
})(typeof require !== 'undefined' ? require('../challenge.js') : Challenge);
