import React, { useState } from 'react';
import { ExecutionCockpitWrapper } from './components/ExecutionCockpitWrapper';
import { WorkflowSelector } from './components/WorkflowSelector';
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './lib/auth-context';
import { WorkflowData } from './lib/supabase';
import { generateExecutionPlan } from './lib/orchestratorApi';
import { ExecutionPlan } from './types/execution';
import './index.css';

function AppContent() {
  const { user, loading } = useAuth();
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null);
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const handleWorkflowSelect = (workflow: WorkflowData) => {
    setSelectedWorkflow(workflow);
    setExecutionPlan(null);
    setGenerationError(null);
  };

  const handleGenerateFramework = async () => {
    if (!selectedWorkflow) return;
    
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      // Call the orchestrator API to generate the execution plan
      const plan = await generateExecutionPlan(selectedWorkflow);
      setExecutionPlan(plan);
    } catch (error) {
      console.error('Failed to generate execution framework:', error);
      setGenerationError('Failed to generate execution framework. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSignInClick = () => {
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!executionPlan ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="max-w-2xl w-full mx-auto p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                AEF Execution Cockpit
              </h1>
              <p className="text-lg text-gray-600">
                Select a completed workflow to generate an agentic execution framework
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Choose Workflow
                </h2>
                {!loading && !user && (
                  <button
                    onClick={handleSignInClick}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Sign In
                  </button>
                )}
                {user && (
                  <div className="text-sm text-gray-600">
                    Welcome, {user.email}
                  </div>
                )}
              </div>
              
              <WorkflowSelector
                onWorkflowSelect={handleWorkflowSelect}
                selectedWorkflow={selectedWorkflow}
              />
              
              {selectedWorkflow && (
                <>
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">
                      Selected Workflow Details
                    </h3>
                    <div className="text-sm text-blue-700 space-y-1">
                      <div><strong>Job ID:</strong> {selectedWorkflow.job_id}</div>
                      <div><strong>Created:</strong> {new Date(selectedWorkflow.created_at).toLocaleString()}</div>
                      <div><strong>Has SOP Data:</strong> {selectedWorkflow.sop_data ? 'Yes' : 'No'}</div>
                      <div><strong>Has Transcript:</strong> {selectedWorkflow.transcript ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                  
                  {generationError && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{generationError}</p>
                    </div>
                  )}
                  
                  <div className="mt-6">
                    <button
                      onClick={handleGenerateFramework}
                      disabled={isGenerating}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                        isGenerating 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                      }`}
                    >
                      {isGenerating ? (
                        <div className="flex items-center justify-center space-x-2">
                          <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating Agentic Execution Framework...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center space-x-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>Generate Agentic Execution Framework</span>
                        </div>
                      )}
                    </button>
                    <p className="text-xs text-gray-500 text-center mt-2">
                      This will analyze your workflow and create an intelligent execution plan
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute top-4 left-4 z-50">
            <button
              onClick={() => {
                setExecutionPlan(null);
                setSelectedWorkflow(null);
              }}
              className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              ← Back to Workflow Selection
            </button>
          </div>
          <ExecutionCockpitWrapper executionPlan={executionPlan} />
        </div>
      )}
      
      <AuthModal 
        open={showAuthModal} 
        onOpenChange={setShowAuthModal}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App; 