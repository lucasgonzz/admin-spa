/**
 * Punto de entrada para `node --test tests/recursos`: desde Node 22 el comando recibe la carpeta como si
 * fuera un módulo y no la recorre, así que esta carpeta se resuelve a este archivo, que carga las pruebas.
 */
import './buscador.test.mjs'
