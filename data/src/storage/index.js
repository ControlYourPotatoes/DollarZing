// IndexedDB storage utilities for dataset management
import { openDB } from 'idb';
export class DatasetStorage {
    db = null;
    async init() {
        this.db = await openDB('dollarzing-datasets', 1, {
            upgrade(db) {
                db.createObjectStore('datasets', {
                    keyPath: 'id',
                });
            },
        });
    }
    async storeDataset(id, dataset) {
        if (!this.db)
            await this.init();
        await this.db.put('datasets', {
            id,
            metadata: {
                generatedAt: new Date(),
                parameters: dataset.parameters || {},
                version: '1.0.0'
            },
            data: dataset
        });
    }
    async getDataset(id) {
        if (!this.db)
            await this.init();
        const result = await this.db.get('datasets', id);
        return result ? result.data : null;
    }
    async deleteDataset(id) {
        if (!this.db)
            await this.init();
        await this.db.delete('datasets', id);
    }
    async listDatasets() {
        if (!this.db)
            await this.init();
        const keys = await this.db.getAllKeys('datasets');
        return keys;
    }
}
export const datasetStorage = new DatasetStorage();
//# sourceMappingURL=index.js.map