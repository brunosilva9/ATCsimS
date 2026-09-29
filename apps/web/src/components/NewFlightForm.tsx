/**
 * Armar un vuelo desde las piezas (tipo de aeronave, operador, aerodromos) en vez de elegir uno
 * ya armado de sampleFlights — para cuando ese vuelo todavia no existe en el catalogo.
 *
 * El indicativo real de un vuelo comercial tiene ruta y operador fijos, pero no siempre lo vuela
 * el mismo modelo ni la misma matricula: por eso esto arma la IDENTIDAD del vuelo una sola vez
 * (para agregarlo al ejercicio), y no fuerza ninguna relacion permanente entre indicativo y
 * aeronave — el instructor puede seguir editando tipo/matricula despues, por vuelo, en la tabla
 * del editor.
 */

import { type FormEvent, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';

import { db } from '../lib/firebase.js';
import { useNavdataStore } from '../state/navdata.js';
import { useRoleStore } from '../state/role.js';
import shared from '../routes/shared.module.css';
import styles from './NewFlightForm.module.css';

export interface NewFlightIdentity {
  readonly callsign: string;
  readonly icaoType: string;
  readonly registration: string | null;
  readonly tasKt: number;
  readonly adep: string;
  readonly ades: string;
}

export interface NewFlightFormProps {
  readonly onAdd: (identity: NewFlightIdentity) => void;
  readonly onClose: () => void;
}

export function NewFlightForm({ onAdd, onClose }: NewFlightFormProps) {
  const aircraftTypes = useNavdataStore((s) => s.aircraftTypes);
  const operators = useNavdataStore((s) => s.operators);
  const aerodromes = useNavdataStore((s) => s.aerodromes);
  const role = useRoleStore((s) => s.role);

  const [operatorPrefix, setOperatorPrefix] = useState('');
  const [callsignRest, setCallsignRest] = useState('');
  const [icaoType, setIcaoType] = useState('');
  const [tasKt, setTasKt] = useState('');
  const [registration, setRegistration] = useState('');
  const [adep, setAdep] = useState('');
  const [ades, setAdes] = useState('');
  const [saveAsSample, setSaveAsSample] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callsign = `${operatorPrefix}${callsignRest.trim().toUpperCase()}`;

  const pickType = (icao: string) => {
    setIcaoType(icao);
    const type = aircraftTypes.find((t) => t.icao === icao);
    if (type) setTasKt(String(type.maxSpeedKt ?? type.minSpeedKt));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (callsignRest.trim() === '') return setError('Falta el indicativo.');
    if (icaoType === '') return setError('Falta el tipo de aeronave.');
    const tas = Number(tasKt);
    if (!Number.isFinite(tas) || tas <= 0) return setError('TAS inválida.');
    if (adep === '' || ades === '') return setError('Falta origen o destino.');
    if (adep === ades) return setError('Origen y destino no pueden ser el mismo aeródromo.');

    const identity: NewFlightIdentity = {
      callsign,
      icaoType,
      registration: registration.trim() === '' ? null : registration.trim().toUpperCase(),
      tasKt: tas,
      adep,
      ades,
    };

    onAdd(identity);

    if (saveAsSample && role === 'admin') {
      setSaving(true);
      try {
        await setDoc(doc(db, 'sampleFlights', callsign), {
          callsign,
          operator: operatorPrefix,
          icaoType,
          tasKt: tas,
          adep,
          ades,
          ssr: '',
          registration: identity.registration,
        });
        await useNavdataStore.getState().loadAll();
      } catch (err) {
        setSaving(false);
        setError(
          err instanceof Error ? err.message : 'El vuelo se agregó al ejercicio, pero no se pudo guardar en el catálogo.'
        );
        return;
      }
      setSaving(false);
    }

    onClose();
  };

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Operador</span>
          <select value={operatorPrefix} onChange={(e) => setOperatorPrefix(e.target.value)}>
            <option value="">— sin operador</option>
            {operators.map((o) => (
              <option key={o.icaoPrefix} value={o.icaoPrefix}>
                {o.icaoPrefix} · {o.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Indicativo</span>
          <div className={styles.callsignRow}>
            {operatorPrefix !== '' ? <span className={styles.prefix}>{operatorPrefix}</span> : null}
            <input
              value={callsignRest}
              placeholder={operatorPrefix === '' ? 'Indicativo completo' : 'Resto del indicativo'}
              onChange={(e) => setCallsignRest(e.target.value)}
            />
          </div>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Tipo de aeronave</span>
          <select value={icaoType} onChange={(e) => pickType(e.target.value)}>
            <option value="">Elegir tipo…</option>
            {aircraftTypes.map((t) => (
              <option key={t.icao} value={t.icao}>
                {t.icao} · {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>TAS (kt)</span>
          <input type="number" value={tasKt} onChange={(e) => setTasKt(e.target.value)} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Matrícula</span>
          <input value={registration} placeholder="—" onChange={(e) => setRegistration(e.target.value)} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Origen</span>
          <select value={adep} onChange={(e) => setAdep(e.target.value)}>
            <option value="">Elegir…</option>
            {aerodromes.map((a) => (
              <option key={a.icao} value={a.icao}>
                {a.icao}
                {a.name ? ` · ${a.name}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Destino</span>
          <select value={ades} onChange={(e) => setAdes(e.target.value)}>
            <option value="">Elegir…</option>
            {aerodromes.map((a) => (
              <option key={a.icao} value={a.icao}>
                {a.icao}
                {a.name ? ` · ${a.name}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {role === 'admin' ? (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={saveAsSample}
            onChange={(e) => setSaveAsSample(e.target.checked)}
          />
          <span>
            Guardar como vuelo de ejemplo
            <em className={styles.hint}>
              Queda disponible en «Añadir del catálogo» la próxima vez, sin tener que rearmarlo.
            </em>
          </span>
        </label>
      ) : null}

      {error !== null ? (
        <p className={shared.note} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={saving}>
          {saving ? 'Guardando…' : 'Agregar'}
        </button>
        <button type="button" className={styles.secondary} onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
