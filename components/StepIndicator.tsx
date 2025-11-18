import React from 'react';
import { Step } from '../types';

interface StepIndicatorProps {
  currentStep: Step;
}

const steps: { id: Step; label: string }[] = [
  { id: 'SETUP', label: 'Design Survey' },
  { id: 'PERSONAS', label: 'Target Audience' },
  { id: 'SIMULATION', label: 'Simulate' },
  { id: 'RESULTS', label: 'Analysis' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-center space-x-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 transition-colors duration-300
                ${isCompleted ? 'bg-indigo-600 border-indigo-600 text-white' : 
                  isCurrent ? 'bg-white border-indigo-600 text-indigo-600' : 
                  'bg-white border-gray-300 text-gray-400'}`}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <span className={`ml-2 text-sm font-medium ${isCurrent ? 'text-indigo-600' : 'text-gray-500'}`}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-4 ${index < currentIndex ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};