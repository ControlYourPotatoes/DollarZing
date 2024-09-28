import React from 'react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { PlayCircle, StopCircle, RotateCcw } from 'lucide-react'
import useSimulationStore from '../store/SimulationStore';

type View = 'baseline' | 'adjusted' | 'comparison';

interface NavbarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView }) => {
  const { isRunning, setIsRunning, resetSimulation } = useSimulationStore();

  const handleToggleSimulation = () => {
    setIsRunning(!isRunning);
  };

  return (
    <nav className="flex justify-between items-center p-4 bg-white shadow-md">
      <ToggleGroup type="single" value={currentView} onValueChange={(value: View) => setCurrentView(value)}>
        <ToggleGroupItem value="baseline" aria-label="Baseline View">
          Baseline
        </ToggleGroupItem>
        <ToggleGroupItem value="adjusted" aria-label="Adjusted View">
          Adjusted
        </ToggleGroupItem>
        <ToggleGroupItem value="comparison" aria-label="Comparison View">
          Comparison
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="flex space-x-2">
        <Button onClick={handleToggleSimulation} variant={isRunning ? "destructive" : "default"}>
          {isRunning ? <StopCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {isRunning ? 'Stop' : 'Start'}
        </Button>
        <Button onClick={resetSimulation} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
    </nav>
  );
};

export default Navbar;