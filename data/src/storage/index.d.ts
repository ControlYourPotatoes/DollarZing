export declare class DatasetStorage {
    private db;
    init(): Promise<void>;
    storeDataset(id: string, dataset: any): Promise<void>;
    getDataset(id: string): Promise<any | null>;
    deleteDataset(id: string): Promise<void>;
    listDatasets(): Promise<string[]>;
}
export declare const datasetStorage: DatasetStorage;
//# sourceMappingURL=index.d.ts.map