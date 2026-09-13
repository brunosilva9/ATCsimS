/**
 * El panel desde el que el alumno controla.
 *
 * Un formulario por tipo de instruccion, con los campos que ese tipo necesita y ninguno mas.
 * Los fixes que ofrece son los del vuelo elegido, no los 107 de la base: no se puede instruir
 * sobre un punto por el que el avion no pasa.
 */

import { useMemo, useState } from 'react';

import { formatHhmm, parseHhmm } from '@atcsims/core';
import type { Instruction, InstructionKind, Scenario } from '@atcsims/core';

import styles from './InstructionPanel.module.css';

const KINDS: readonly { id: InstructionKind; label: string; hint: string }[] = [
  { id: 'LEVEL_CHANGE', label: 'Nivel', hint: 'Autorizar a otro nivel' },
  { id: 'SPEED_RESTRICTION', label: 'Velocidad', hint: 'Restringir la velocidad' },
  { id: 'HOLD', label: 'Espera', hint: 'Mantener sobre un punto' },
  { id: 'VECTOR', label: 'Vectores', hint: 'Alargar la trayectoria' },
  { id: 'DIRECT', label: 'Directo', hint: 'Cortar a un punto posterior' },
  { id: 'TRANSFER', label: 'Transferir', hint: 'Pasar al sector siguiente' },
];

export interface InstructionPanelProps {
  readonly scenario: Scenario;
  readonly onSubmit: (instruction: Omit<Instruction, 'id'>) => void;
  readonly error: string | null;
}

export function InstructionPanel({ scenario, onSubmit, error }: InstructionPanelProps) {
  const [flightId, setFlightId] = useState(scenario.flights[0]?.id ?? '');
  const [kind, setKind] = useState<InstructionKind>('LEVEL_CHANGE');
  const [fromFix, setFromFix] = useState('');
  const [time, setTime] = useState(formatHhmm(scenario.startTime));
  const [levelFl, setLevelFl] = useState('100');
  const [speedKt, setSpeedKt] = useState('210');
  const [holdMinutes, setHoldMinutes] = useState('4');
  const [extraTrackNm, setExtraTrackNm] = useState('10');
  const [targetFix, setTargetFix] = useState('');

  const flight = scenario.flights.find((f) => f.id === flightId);
  const fixes = useMemo(() => flight?.legs.map((l) => l.fix) ?? [], [flight]);

  // El directo solo puede ir a un punto POSTERIOR al de la instruccion.
  const laterFixes = useMemo(() => {
    const from = fixes.indexOf(fromFix);
    return from === -1 ? fixes.slice(2) : fixes.slice(from + 2);
  }, [fixes, fromFix]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!flight) return;

    let parsedTime: number;
    try {
      parsedTime = parseHhmm(time);
    } catch {
      return;
    }

    const draft: Omit<Instruction, 'id'> = {
      time: parsedTime,
      flightId,
      kind,
      fromFix: fromFix === '' ? null : fromFix,
      ...(kind === 'LEVEL_CHANGE' ? { levelFt: Number(levelFl) * 100 } : {}),
      ...(kind === 'SPEED_RESTRICTION' ? { speedKt: Number(speedKt) } : {}),
      ...(kind === 'HOLD' ? { holdMinutes: Number(holdMinutes) } : {}),
      ...(kind === 'VECTOR' ? { extraTrackNm: Number(extraTrackNm) } : {}),
      ...(kind === 'DIRECT' ? { targetFix } : {}),
    };

    onSubmit(draft);
  };

  return (
    <form className={styles.panel} onSubmit={submit}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Vuelo</span>
          <select
            id="instruction-flight"
            value={flightId}
            onChange={(e) => {
              setFlightId(e.target.value);
              setFromFix('');
              setTargetFix('');
            }}
          >
            {scenario.flights.map((f) => (
              <option key={f.id} value={f.id}>
                {f.callsign} · {f.icaoType}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Hora</span>
          <input
            id="instruction-time"
            className={styles.time}
            value={time}
            inputMode="numeric"
            onChange={(e) => setTime(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Desde</span>
          <select
            id="instruction-from"
            value={fromFix}
            onChange={(e) => setFromFix(e.target.value)}
          >
            <option value="">Próximo punto</option>
            {fixes.map((fix) => (
              <option key={fix} value={fix}>
                {fix}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.kinds} role="group" aria-label="Tipo de instrucción">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            title={k.hint}
            aria-pressed={kind === k.id}
            className={kind === k.id ? styles.kindOn : styles.kind}
            onClick={() => setKind(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className={styles.row}>
        {kind === 'LEVEL_CHANGE' ? (
          <label className={styles.field}>
            <span className={styles.label}>Nivel de vuelo</span>
            <input
              id="instruction-level"
              value={levelFl}
              inputMode="numeric"
              onChange={(e) => setLevelFl(e.target.value)}
            />
          </label>
        ) : null}

        {kind === 'SPEED_RESTRICTION' ? (
          <label className={styles.field}>
            <span className={styles.label}>Velocidad (kt)</span>
            <input
              id="instruction-speed"
              value={speedKt}
              inputMode="numeric"
              onChange={(e) => setSpeedKt(e.target.value)}
            />
          </label>
        ) : null}

        {kind === 'HOLD' ? (
          <label className={styles.field}>
            <span className={styles.label}>Minutos en espera</span>
            <input
              id="instruction-hold"
              value={holdMinutes}
              inputMode="numeric"
              onChange={(e) => setHoldMinutes(e.target.value)}
            />
          </label>
        ) : null}

        {kind === 'VECTOR' ? (
          <label className={styles.field}>
            <span className={styles.label}>Millas de más</span>
            <input
              id="instruction-track"
              value={extraTrackNm}
              inputMode="numeric"
              onChange={(e) => setExtraTrackNm(e.target.value)}
            />
          </label>
        ) : null}

        {kind === 'DIRECT' ? (
          <label className={styles.field}>
            <span className={styles.label}>Directo a</span>
            <select
              id="instruction-target"
              value={targetFix}
              onChange={(e) => setTargetFix(e.target.value)}
            >
              <option value="">Elegir punto…</option>
              {laterFixes.map((fix) => (
                <option key={fix} value={fix}>
                  {fix}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button type="submit" className={styles.submit}>
          Instruir
        </button>
      </div>

      {error !== null ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
