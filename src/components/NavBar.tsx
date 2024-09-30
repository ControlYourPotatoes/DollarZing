import React from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

      <div className=''>
        <Tabs value={currentView} onValueChange={(value: View) => setCurrentView(value)}>
          <TabsList className="gap-3">
            <TabsTrigger className="text-lg" value="baseline">Baseline</TabsTrigger>
            <TabsTrigger className="text-lg"value="adjusted">Adjusted</TabsTrigger>
            <TabsTrigger className="text-lg"value="comparison">Comparison</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      

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