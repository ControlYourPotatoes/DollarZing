// IndexedDB storage utilities for dataset management
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DollarZingDB extends DBSchema {
  datasets: {
    key: string;
    value: {
      id: string;
      metadata: {
        generatedAt: Date;
        parameters: any;
        version: string;
      };
      data: any;
    };
  };
}

export class DatasetStorage {
  private db: IDBPDatabase<DollarZingDB> | null = null;

  async init(): Promise<void> {
    this.db = await openDB<DollarZingDB>('dollarzing-datasets', 1, {
      upgrade(db) {
        db.createObjectStore('datasets', {
          keyPath: 'id',
        });
      },
    });
  }

  async storeDataset(id: string, dataset: any): Promise<void> {
    if (!this.db) await this.init();
    
    await this.db!.put('datasets', {
      id,
      metadata: {
        generatedAt: new Date(),
        parameters: dataset.parameters || {},
        version: '1.0.0'
      },
      data: dataset
    });
  }

  async getDataset(id: string): Promise<any | null> {
    if (!this.db) await this.init();
    
    const result = await this.db!.get('datasets', id);
    return result ? result.data : null;
  }

  async deleteDataset(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    await this.db!.delete('datasets', id);
  }

  async listDatasets(): Promise<string[]> {
    if (!this.db) await this.init();
    
    const keys = await this.db!.getAllKeys('datasets');
    return keys as string[];
  }
}

export const datasetStorage = new DatasetStorage();