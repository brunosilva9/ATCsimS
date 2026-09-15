/**
 * Panel de administracion: editar la base de navegacion completa, directo en Firestore.
 *
 * Solo entra quien tiene rol `admin` (ver App.tsx y state/role.ts) — esta pantalla en si no
 * vuelve a comprobarlo porque App.tsx ya no la monta si el rol no da.
 *
 * Firestore pasa a ser la base VIVA a partir de este panel: data/*.json y el Excel siguen siendo
 * el import original, pero volver a correr `npm run data:firestore` PISA cualquier edicion hecha
 * aca. Ver data/README.md.
 */

import { useState } from 'react';

import { AdminCollectionList } from './AdminCollectionList.js';
import { ADMIN_SCHEMAS } from './AdminSchema.js';
import shared from './shared.module.css';
import styles from './Admin.module.css';

export function Admin() {
  const [tab, setTab] = useState(ADMIN_SCHEMAS[0]!.collection);
  const schema = ADMIN_SCHEMAS.find((s) => s.collection === tab) ?? ADMIN_SCHEMAS[0]!;

  return (
    <div className={shared.page}>
      <header className={shared.pageHead}>
        <div>
          <p className={shared.eyebrow}>Administración</p>
          <h2 className={shared.pageTitle}>Editar la base de navegación</h2>
          <p className={shared.lead}>
            Esto escribe directo en Firestore, la base que usa toda la app. Un cambio acá lo ve
            cualquiera que entre después de vos. Antes de guardar en fixes, procedimientos,
            aerovías, esperas, performance o espaciamiento, se comprueba que no rompa el motor de
            cálculo — el resto de las colecciones se guarda sin esa comprobación porque el motor
            no las usa.
          </p>
        </div>
      </header>

      <div className={shared.notice}>
        <strong>Esto reemplaza al Excel para lo que edites acá.</strong> Si más tarde alguien
        vuelve a correr <code>npm run data:firestore</code>, pisa cualquier cambio hecho desde
        este panel — ver <code>data/README.md</code>.
      </div>

      <div className={styles.tabs} role="tablist">
        {ADMIN_SCHEMAS.map((s) => (
          <button
            key={s.collection}
            type="button"
            role="tab"
            aria-selected={tab === s.collection}
            className={tab === s.collection ? styles.tabOn : styles.tab}
            onClick={() => setTab(s.collection)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <AdminCollectionList schema={schema} />
    </div>
  );
}
