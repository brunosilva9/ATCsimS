/**
 * Nivel de transicion.
 *
 * No es un dato que se escriba a mano por ejercicio: depende solo del QNH. Con 1013 hPa o mas
 * alto, FL110; por debajo, FL115 — el escalon estandar que mantiene el colchon de 1000 ft sobre
 * la altitud de transicion cuando la presion baja.
 *
 * docs/REQUISITOS.md (RN-1.1) y data/tma.json traian FL120 como constante fija, transcrita de
 * la planilla. Ese numero no depende del QNH, asi que no puede ser la regla real -- se
 * reemplaza por esta, y ambos documentos quedan con la nota de por que.
 */
export function transitionLevelFor(qnhHpa: number): string {
  return qnhHpa >= 1013 ? 'FL110' : 'FL115';
}
