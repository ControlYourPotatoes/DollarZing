import { useState, useCallback } from 'react';
import { datasetStorage } from '../../data/src/storage';

export interface GenerationStatus {
  isGenerating: boolean;
  progress: number;
  error: string | null;
  currentDataset: any | null;
}

export const useDataGeneration = () => {
  const [status, setStatus] = useState<GenerationStatus>({
    isGenerating: false,
    progress: 0,
    error: null,
    currentDataset: null
  });

  const generateDataset = useCallback(async (parameters: any) => {
    setStatus(prev => ({ ...prev, isGenerating: true, error: null, progress: 0 }));
    
    try {
      // This will integrate with the engine container in subsequent tasks
      const response = await fetch('http://localhost:3001/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameters)
      });
      
      if (!response.ok) {
        throw new Error('Generation failed');
      }
      
      const result = await response.json();
      
      // Store the dataset locally
      const datasetId = `dataset-${Date.now()}`;
      await datasetStorage.storeDataset(datasetId, result);
      
      setStatus(prev => ({
        ...prev,
        isGenerating: false,
        progress: 100,
        currentDataset: result
      }));
      
      return result;
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      throw error;
    }
  }, []);

  const loadDataset = useCallback(async (datasetId: string) => {
    try {
      const dataset = await datasetStorage.getDataset(datasetId);
      setStatus(prev => ({ ...prev, currentDataset: dataset }));
      return dataset;
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load dataset'
      }));
      throw error;
    }
  }, []);

  return {
    status,
    generateDataset,
    loadDataset
  };
};