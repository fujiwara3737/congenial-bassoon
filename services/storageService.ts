import { openDB, DBSchema } from 'idb';
import { DocumentItem } from '../types';
import { INITIAL_DOCUMENTS } from '../constants';

const DB_NAME = 'fdso-knowledge-base';
const STORE_NAME = 'documents';

interface KnowledgeDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentItem;
  };
}

const dbPromise = openDB<KnowledgeDB>(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  },
});

export const storageService = {
  async getAll(): Promise<DocumentItem[]> {
    const db = await dbPromise;
    const docs = await db.getAll(STORE_NAME);
    
    // Migration: If DB is empty, try to load from localStorage (old method) or use initial constants
    if (docs.length === 0) {
      const local = localStorage.getItem('fdso-knowledge-base-v1');
      let initialDocs = INITIAL_DOCUMENTS;
      
      if (local) {
        try {
          const parsed = JSON.parse(local);
          initialDocs = parsed.map((doc: any) => ({
            ...doc,
            createdAt: new Date(doc.createdAt),
            updatedAt: new Date(doc.updatedAt)
          }));
          console.log("Migrating data from LocalStorage to IndexedDB...");
        } catch (e) {
          console.error("Migration parse error", e);
        }
      }
      
      const tx = db.transaction(STORE_NAME, 'readwrite');
      await Promise.all(initialDocs.map(doc => tx.store.put(doc)));
      await tx.done;
      return initialDocs;
    }
    
    // IndexedDB stores Date objects correctly, no conversion needed usually.
    return docs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()); 
  },

  async save(doc: DocumentItem): Promise<void> {
    const db = await dbPromise;
    await db.put(STORE_NAME, doc);
  },

  async delete(id: string): Promise<void> {
    const db = await dbPromise;
    await db.delete(STORE_NAME, id);
  }
};