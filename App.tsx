import React, { useState, useCallback } from 'react';
import { Plus, Trash2, User, Play, FileText, BarChart2, CheckCircle, Loader2, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { StepIndicator } from './components/StepIndicator';
import { Survey, Question, QuestionType, TargetPersonaDefinition, GeneratedPersona, SurveyResponse, Step, AnalysisResult } from './types';
import { generatePersonas, simulateSurveyResponse, analyzeResults } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [step, setStep] = useState<Step>('SETUP');
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1: Survey Data
  const [survey, setSurvey] = useState<Survey>({
    title: "New Product Concept Survey",
    description: "Validating the need for a new AI-powered productivity tool.",
    questions: [
      { id: 'q1', text: "How often do you struggle with organizing your daily tasks?", type: QuestionType.RATING_SCALE },
      { id: 'q2', text: "What is your biggest pain point with current to-do list apps?", type: QuestionType.OPEN_ENDED },
    ]
  });

  // Step 2: Target Persona Data
  const [targetDef, setTargetDef] = useState<TargetPersonaDefinition>({
    description: "Remote workers and freelancers in the tech industry who manage multiple projects simultaneously.",
    count: 5
  });
  const [generatedPersonas, setGeneratedPersonas] = useState<GeneratedPersona[]>([]);

  // Step 3: Simulation Data
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [simulationProgress, setSimulationProgress] = useState(0);

  // Step 4: Results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // --- Handlers ---

  // Survey Builder Handlers
  const addQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: `q${Date.now()}`,
      text: "",
      type,
      options: type === QuestionType.MULTIPLE_CHOICE ? ["Option 1", "Option 2"] : undefined
    };
    setSurvey(prev => ({ ...prev, questions: [...prev.questions, newQ] }));
  };

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, [field]: value } : q)
    }));
  };

  const removeQuestion = (id: string) => {
    setSurvey(prev => ({ ...prev, questions: prev.questions.filter(q => q.id !== id) }));
  };

  const updateOption = (qId: string, optIndex: number, val: string) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id !== qId || !q.options) return q;
        const newOpts = [...q.options];
        newOpts[optIndex] = val;
        return { ...q, options: newOpts };
      })
    }));
  };

  // Persona Generation Handler
  const handleGeneratePersonas = async () => {
    if (!targetDef.description.trim()) return;
    setIsLoading(true);
    try {
      const personas = await generatePersonas(targetDef.description, targetDef.count);
      setGeneratedPersonas(personas);
    } catch (error) {
      console.error(error);
      alert("Failed to generate personas. Please check your API key or try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Simulation Handler
  const runSimulation = async () => {
    setStep('SIMULATION');
    setResponses([]);
    setSimulationProgress(0);
    
    const newResponses: SurveyResponse[] = [];
    
    // Process sequentially to visualize progress (and avoid potential rate limits for large batches)
    for (let i = 0; i < generatedPersonas.length; i++) {
      const persona = generatedPersonas[i];
      try {
        const resp = await simulateSurveyResponse(persona, survey);
        newResponses.push(resp);
        setResponses(prev => [...prev, resp]);
      } catch (e) {
        console.error(`Error simulating ${persona.name}`);
      }
      setSimulationProgress(((i + 1) / generatedPersonas.length) * 100);
    }

    // Auto-analyze after simulation
    if (newResponses.length > 0) {
        try {
            setIsLoading(true); // Re-use loading for analysis phase visually if needed, though we are in SIMULATION step
            const analysisResult = await analyzeResults(survey, newResponses, generatedPersonas);
            setAnalysis(analysisResult);
            setStep('RESULTS');
        } catch(e) {
            console.error("Analysis failed", e);
            alert("Simulation finished, but analysis failed.");
        } finally {
            setIsLoading(false);
        }
    }
  };

  // --- Renderers ---

  const renderSurveyBuilder = () => (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Survey Details</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Survey Title</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={survey.title}
              onChange={(e) => setSurvey(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Context / Objective</label>
            <textarea
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24"
              value={survey.description}
              onChange={(e) => setSurvey(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what you want to learn from this survey so the AI understands the context."
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {survey.questions.map((q, idx) => (
          <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative group">
            <button 
              onClick={() => removeQuestion(q.id)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={18} />
            </button>
            <div className="flex items-start space-x-4">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-100 text-indigo-700 font-bold rounded-full">
                {idx + 1}
              </span>
              <div className="flex-grow space-y-3">
                <div className="flex space-x-4">
                    <input
                    type="text"
                    className="flex-grow p-2 border border-gray-300 rounded-md font-medium"
                    value={q.text}
                    onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                    placeholder="Enter your question here..."
                    />
                    <div className="flex-shrink-0">
                        <span className="text-xs font-bold uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {q.type.replace('_', ' ')}
                        </span>
                    </div>
                </div>

                {q.type === QuestionType.MULTIPLE_CHOICE && q.options && (
                  <div className="ml-2 space-y-2 border-l-2 border-gray-100 pl-4">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full border border-gray-300"></div>
                        <input
                          type="text"
                          className="flex-grow p-1 text-sm border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                          value={opt}
                          onChange={(e) => updateOption(q.id, oIdx, e.target.value)}
                        />
                      </div>
                    ))}
                    <button
                        onClick={() => {
                            const newOpts = [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`];
                            updateQuestion(q.id, 'options', newOpts);
                        }}
                        className="text-xs text-indigo-600 font-medium hover:underline"
                    >
                        + Add Option
                    </button>
                  </div>
                )}
                
                {q.type === QuestionType.RATING_SCALE && (
                    <div className="flex space-x-2 text-sm text-gray-500 ml-2">
                        <span>1 (Strongly Disagree)</span>
                        <span className="flex-grow border-b border-dashed border-gray-300 mb-2"></span>
                        <span>5 (Strongly Agree)</span>
                    </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center space-x-4">
        <button 
            onClick={() => addQuestion(QuestionType.OPEN_ENDED)}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 shadow-sm rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
        >
            <Plus size={16} className="mr-2" /> Open Ended
        </button>
        <button 
            onClick={() => addQuestion(QuestionType.MULTIPLE_CHOICE)}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 shadow-sm rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
        >
            <Plus size={16} className="mr-2" /> Multiple Choice
        </button>
        <button 
            onClick={() => addQuestion(QuestionType.RATING_SCALE)}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 shadow-sm rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
        >
            <Plus size={16} className="mr-2" /> Rating Scale
        </button>
      </div>

      <div className="flex justify-end pt-6">
          <button
            onClick={() => setStep('PERSONAS')}
            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition font-medium"
          >
              Next: Define Audience <ChevronRight size={18} className="ml-2" />
          </button>
      </div>
    </div>
  );

  const renderPersonaBuilder = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Definition */}
        <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Target Audience</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Who is this for?</label>
                        <textarea
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 h-40 text-sm"
                            placeholder="E.g., College students in the US who love hiking and are budget-conscious..."
                            value={targetDef.description}
                            onChange={(e) => setTargetDef(prev => ({...prev, description: e.target.value}))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sample Size</label>
                        <select 
                            className="w-full p-2 border border-gray-300 rounded-md"
                            value={targetDef.count}
                            onChange={(e) => setTargetDef(prev => ({...prev, count: parseInt(e.target.value)}))}
                        >
                            <option value={3}>3 Personas (Fast)</option>
                            <option value={5}>5 Personas (Balanced)</option>
                            <option value={10}>10 Personas (Thorough)</option>
                        </select>
                    </div>
                    <button
                        onClick={handleGeneratePersonas}
                        disabled={isLoading}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition font-medium flex justify-center items-center disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : <User className="mr-2" />}
                        {isLoading ? 'Generating...' : 'Generate Personas'}
                    </button>
                </div>
            </div>
        </div>

        {/* Right: Generated List */}
        <div className="md:col-span-2">
            {generatedPersonas.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
                    <User size={48} className="text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No Personas Yet</h3>
                    <p className="text-gray-500 max-w-sm mt-2">Define your target audience and click generate to create synthetic AI participants for your survey.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">Generated Participants ({generatedPersonas.length})</h3>
                        {generatedPersonas.length > 0 && (
                            <button 
                                onClick={runSimulation}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow flex items-center font-medium transition"
                            >
                                <Play size={16} className="mr-2" /> Run Simulation
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {generatedPersonas.map(p => (
                            <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4 items-start">
                                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                    {p.name.charAt(0)}
                                </div>
                                <div className="flex-grow">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-gray-900">{p.name}, {p.age}</h4>
                                            <p className="text-sm text-gray-600 font-medium">{p.occupation}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2 italic">"{p.traits}"</p>
                                    <div className="mt-3 text-xs bg-red-50 text-red-700 p-2 rounded border border-red-100">
                                        <span className="font-semibold">Pain Points:</span> {p.painPoints}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );

  const renderSimulation = () => (
    <div className="max-w-2xl mx-auto text-center pt-12">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Simulating Responses</h2>
            <p className="text-gray-500 mb-8">AI agents are reading your survey and providing authentic answers...</p>

            <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                            Progress
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-indigo-600">
                            {Math.round(simulationProgress)}%
                        </span>
                    </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-100">
                    <div style={{ width: `${simulationProgress}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-500"></div>
                </div>
            </div>

            <div className="mt-8 grid gap-3">
                {responses.map((r, idx) => {
                    const p = generatedPersonas.find(gp => gp.id === r.personaId);
                    return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 animate-fadeIn">
                            <div className="flex items-center">
                                <CheckCircle size={16} className="text-green-500 mr-2" />
                                <span className="text-sm font-medium text-gray-700">{p?.name} finished the survey</span>
                            </div>
                            <span className="text-xs text-gray-400">Just now</span>
                        </div>
                    )
                })}
                {responses.length < generatedPersonas.length && (
                    <div className="flex items-center justify-center p-3 text-gray-400 animate-pulse">
                        <Loader2 className="animate-spin mr-2" size={16} />
                        <span className="text-sm">Interviewing next participant...</span>
                    </div>
                )}
            </div>
        </div>
    </div>
  );

  const renderResults = () => {
      if (!analysis) return <div className="text-center">Loading analysis...</div>;

      return (
          <div className="max-w-5xl mx-auto space-y-8">
              {/* Top Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={`p-6 rounded-xl border shadow-sm ${
                      analysis.sentiment === 'Positive' ? 'bg-green-50 border-green-200' : 
                      analysis.sentiment === 'Negative' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Overall Sentiment</h3>
                      <p className={`text-3xl font-bold ${
                          analysis.sentiment === 'Positive' ? 'text-green-700' :
                          analysis.sentiment === 'Negative' ? 'text-red-700' : 'text-gray-700'
                      }`}>{analysis.sentiment}</p>
                  </div>
                  
                  <div className="col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Executive Summary</h3>
                      <p className="text-gray-800 leading-relaxed">{analysis.summary}</p>
                  </div>
              </div>

              {/* Quantitative Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {survey.questions.filter(q => q.type !== QuestionType.OPEN_ENDED).map((q, idx) => {
                      // Prepare chart data
                      const dataMap: Record<string, number> = {};
                      
                      if (q.type === QuestionType.RATING_SCALE) {
                          [1,2,3,4,5].forEach(n => dataMap[n] = 0);
                      } else if (q.type === QuestionType.MULTIPLE_CHOICE && q.options) {
                          q.options.forEach(o => dataMap[o] = 0);
                      }

                      responses.forEach(r => {
                          const ans = r.answers.find(a => a.questionId === q.id);
                          if (ans) {
                              const val = ans.answer.toString();
                              if (dataMap[val] !== undefined) dataMap[val]++;
                              else dataMap[val] = 1; // fallback
                          }
                      });

                      const chartData = Object.keys(dataMap).map(k => ({ name: k, count: dataMap[k] }));

                      return (
                          <div key={q.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                              <h4 className="font-bold text-gray-900 mb-4">{q.text}</h4>
                              <div className="h-64">
                                  <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={chartData}>
                                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                          <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} />
                                          <YAxis allowDecimals={false} />
                                          <Tooltip 
                                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                                            cursor={{fill: '#f3f4f6'}}
                                          />
                                          <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={["#6366f1", "#818cf8", "#4f46e5", "#4338ca", "#3730a3"][index % 5]} />
                                            ))}
                                          </Bar>
                                      </BarChart>
                                  </ResponsiveContainer>
                              </div>
                          </div>
                      );
                  })}
              </div>

              {/* Qualitative Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center mb-4">
                          <div className="bg-yellow-100 p-2 rounded-lg mr-3">
                             <FileText size={20} className="text-yellow-600" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Key Insights</h3>
                      </div>
                      <ul className="space-y-3">
                          {analysis.keyInsights.map((insight, i) => (
                              <li key={i} className="flex items-start">
                                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 mr-3"></span>
                                  <span className="text-gray-700">{insight}</span>
                              </li>
                          ))}
                      </ul>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center mb-4">
                          <div className="bg-blue-100 p-2 rounded-lg mr-3">
                             <BarChart2 size={20} className="text-blue-600" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Actionable Suggestions</h3>
                      </div>
                      <ul className="space-y-3">
                          {analysis.featureSuggestions.map((sugg, i) => (
                              <li key={i} className="flex items-start">
                                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 mr-3"></span>
                                  <span className="text-gray-700">{sugg}</span>
                              </li>
                          ))}
                      </ul>
                  </div>
              </div>
              
               <div className="flex justify-center pt-8 pb-12">
                  <button
                    onClick={() => {
                        setStep('SETUP');
                        setResponses([]);
                        setGeneratedPersonas([]);
                        setAnalysis(null);
                    }}
                    className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 transition font-medium"
                  >
                      Start New Survey
                  </button>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <BarChart2 className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">PersonaPulse AI</h1>
          </div>
          <div className="text-sm text-gray-500">
              Simulated Market Research
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <StepIndicator currentStep={step} />

        <div className="animate-fadeIn">
          {step === 'SETUP' && renderSurveyBuilder()}
          {step === 'PERSONAS' && renderPersonaBuilder()}
          {step === 'SIMULATION' && renderSimulation()}
          {step === 'RESULTS' && renderResults()}
        </div>
      </main>
    </div>
  );
};

export default App;