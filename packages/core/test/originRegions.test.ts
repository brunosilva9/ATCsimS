import { describe, expect, it } from 'vitest';

import { regionForIcao, starRegions } from '../src/originRegions.js';
import { procedureByIdent } from './fixtures.js';

describe('regionForIcao', () => {
  it('reconoce los prefijos de una letra ya usados en data/sample-flights.json', () => {
    expect(regionForIcao('EGLL')).toBe('NORTE'); // Reino Unido
    expect(regionForIcao('LFPG')).toBe('NORTE'); // Francia
    expect(regionForIcao('LEMD')).toBe('NORTE'); // España
    expect(regionForIcao('EDDF')).toBe('NORTE'); // Alemania
    expect(regionForIcao('EHAM')).toBe('NORTE'); // Holanda
    expect(regionForIcao('OMDB')).toBe('NORTE'); // Dubai
    expect(regionForIcao('KATL')).toBe('NORTE'); // Estados Unidos
    expect(regionForIcao('KMIA')).toBe('NORTE');
    expect(regionForIcao('CYYZ')).toBe('NORTE'); // Canada
    expect(regionForIcao('MMMX')).toBe('NORTE'); // Mexico
    expect(regionForIcao('MPTO')).toBe('NORTE'); // Panama
  });

  it('el prefijo de dos letras manda sobre el de una, para Sudamerica', () => {
    expect(regionForIcao('SAEZ')).toBe('ESTE'); // Argentina
    expect(regionForIcao('SBGR')).toBe('ESTE'); // Brasil
    expect(regionForIcao('SBSP')).toBe('ESTE');
  });

  it('Chile (SC) queda sin region a proposito: es domestico, no cruza un corredor internacional', () => {
    expect(regionForIcao('SCEL')).toBeNull();
    expect(regionForIcao('SCFA')).toBeNull();
  });

  it('un prefijo sin confirmar o desconocido no inventa una region', () => {
    expect(regionForIcao('SKBO')).toBeNull(); // Colombia: pendiente confirmar norte o este
    expect(regionForIcao('ZZZZ')).toBeNull();
  });
});

describe('starRegions', () => {
  it('EROLO7F entra por el corredor norte (UQ808/UQ810)', () => {
    expect(starRegions(procedureByIdent('EROLO7F'))).toEqual(new Set(['NORTE']));
  });

  it('VENTANAS1D entra por el corredor norte (UV200)', () => {
    expect(starRegions(procedureByIdent('VENTANAS1D'))).toEqual(new Set(['NORTE']));
  });

  it('SIMOK7B entra por el corredor este, trasandino (UQ803/UL302)', () => {
    expect(starRegions(procedureByIdent('SIMOK7B'))).toEqual(new Set(['ESTE']));
  });

  it('ANDES1 entra por el corredor este (V551/T112/UV204/UV208)', () => {
    expect(starRegions(procedureByIdent('ANDES1'))).toEqual(new Set(['ESTE']));
  });

  it('ASIMO7D y UMKAL7C quedan sin region a proposito, pendientes de confirmar', () => {
    // Sus entryAirways (UL322/UM799/UM529 y L405) existen — vienen de CIRC-STAR-SID — pero
    // AIRWAY_REGION todavia no les asigna nada: falta el visto bueno de un controlador real.
    expect(procedureByIdent('ASIMO7D').entryAirways).toEqual(['UL322', 'UM799', 'UM529']);
    expect(starRegions(procedureByIdent('ASIMO7D'))).toEqual(new Set());

    expect(procedureByIdent('UMKAL7C').entryAirways).toEqual(['L405']);
    expect(starRegions(procedureByIdent('UMKAL7C'))).toEqual(new Set());
  });
});
