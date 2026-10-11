// Een lege database in het geheugen per testbestand (Dexie gebruikt de
// globale `indexedDB`), en tussen de tests alles leeg.
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { db } from './lib/db';

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});
