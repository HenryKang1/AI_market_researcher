import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, User, Play, FileText, BarChart2, CheckCircle, Loader2, ChevronRight, Printer, FileSpreadsheet, Users, Save, Edit2, X, Check, FolderOpen, RotateCcw, Download, Calendar, LayoutList } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { StepIndicator } from './components/StepIndicator';
import { Survey, Question, QuestionType, TargetPersonaDefinition, GeneratedPersona, SurveyResponse, Step, AnalysisResult, SavedTemplate } from './types';
import { generatePersonas, simulateSurveyResponse, analyzeResults } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'SURVEY' | 'LIBRARY'>('SURVEY');
  const [step, setStep] = useState<Step>('SETUP');
  const [isLoading, setIsLoading] = useState(false);
  
  // Library State (Persisted)
  const [savedPersonas, setSavedPersonas] = useState<GeneratedPersona[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  
  // Template Modals State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");

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
    count: 3
  });
  // activeParticipants are the ones currently selected for the survey
  const [activeParticipants, setActiveParticipants] = useState<GeneratedPersona[]>([]);
  
  // Edit Mode State
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GeneratedPersona | null>(null);

  // Step 3: Simulation Data
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [simulationProgress, setSimulationProgress] = useState(0);

  // Step 4: Results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  
  const reportRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  useEffect(() => {
    const loadedPersonas = localStorage.getItem('personaPulse_library');
    if (loadedPersonas) {
      try {
        setSavedPersonas(JSON.parse(loadedPersonas));
      } catch (e) {
        console.error("Failed to load persona library", e);
      }
    }

    const loadedTemplates = localStorage.getItem('personaPulse_templates');
    if (loadedTemplates) {
      try {
        setSavedTemplates(JSON.parse(loadedTemplates));
      } catch (e) {
        console.error("Failed to load survey templates", e);
      }
    }
  }, []);

  const savePersonaLibrary = (newList: GeneratedPersona[]) => {
    setSavedPersonas(newList);
    localStorage.setItem('personaPulse_library', JSON.stringify(newList));
  };

  const saveTemplatesToStorage = (newList: SavedTemplate[]) => {
    setSavedTemplates(newList);
    localStorage.setItem('personaPulse_templates', JSON.stringify(newList));
  };

  // --- Helpers ---
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  };

  // --- Handlers ---

  // Survey Builder Handlers
  const addQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: `q${generateId()}`,
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
  
  const resetSurveyForm = () => {
      if(window.confirm("Are you sure? This will clear all questions.")) {
          setSurvey({
              title: "Untitled Survey",
              description: "",
              questions: []
          });
      }
  };

  // Template Handlers
  const openSaveTemplateModal = () => {
      setTemplateNameInput(survey.title);
      setIsSaveModalOpen(true);
  };

  const saveTemplate = () => {
      if (!templateNameInput.trim()) {
          alert("Please enter a name for the template.");
          return;
      }

      const newTemplate: SavedTemplate = {
          id: generateId(),
          name: templateNameInput,
          survey: JSON.parse(JSON.stringify(survey)), // Deep copy to ensure snapshot
          createdAt: Date.now()
      };
      
      saveTemplatesToStorage([...savedTemplates, newTemplate]);
      setIsSaveModalOpen(false);
  };

  const loadTemplate = (template: SavedTemplate) => {
      if (window.confirm(`Load template "${template.name}"? Current progress will be replaced.`)) {
          // Deep copy when loading to avoid reference issues
          const surveyCopy = JSON.parse(JSON.stringify(template.survey));
          setSurvey(surveyCopy);
          setIsLoadModalOpen(false);
      }
  };

  const deleteTemplate = (id: string) => {
      if (window.confirm("Delete this template permanently?")) {
          saveTemplatesToStorage(savedTemplates.filter(t => t.id !== id));
      }
  };

  // Persona Generation Handler
  const handleGeneratePersonas = async () => {
    if (!targetDef.description.trim()) return;
    setIsLoading(true);
    try {
      const personas = await generatePersonas(targetDef.description, targetDef.count);
      // IMPORTANT: Ensure unique IDs here to prevent library collisions
      const uniquePersonas = personas.map(p => ({
          ...p,
          id: generateId() // Overwrite AI generated ID with a unique timestamp-based ID
      }));
      
      setActiveParticipants(prev => [...prev, ...uniquePersonas]);
    } catch (error) {
      console.error(error);
      alert("Failed to generate personas. Please check your API key or try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Library Handlers
  const addToLibrary = (persona: GeneratedPersona) => {
    // Since we use random IDs now, exact ID match is rare unless previously saved.
    if (savedPersonas.some(p => p.id === persona.id)) {
        alert("This specific persona instance is already in your library.");
        return;
    }
    savePersonaLibrary([...savedPersonas, persona]);
  };

  const removeFromLibrary = (id: string) => {
    savePersonaLibrary(savedPersonas.filter(p => p.id !== id));
  };

  const importFromLibrary = (persona: GeneratedPersona) => {
      if (activeParticipants.some(p => p.id === persona.id)) return;
      setActiveParticipants(prev => [...prev, persona]);
  };

  // Editing Handlers
  const startEditing = (persona: GeneratedPersona) => {
      setEditingPersonaId(persona.id);
      setEditForm({...persona});
  };

  const saveEdit = (isLibrary: boolean) => {
      if (!editForm) return;
      
      if (isLibrary) {
          const updated = savedPersonas.map(p => p.id === editForm.id ? editForm : p);
          savePersonaLibrary(updated);
      } else {
          // Updating active participant
          setActiveParticipants(prev => prev.map(p => p.id === editForm.id ? editForm : p));
      }
      setEditingPersonaId(null);
      setEditForm(null);
  };

  const cancelEdit = () => {
      setEditingPersonaId(null);
      setEditForm(null);
  };

  const deleteActivePersona = (id: string) => {
      setActiveParticipants(prev => prev.filter(p => p.id !== id));
  };

  // Simulation Handler
  const runSimulation = async () => {
    if (activeParticipants.length === 0) {
        alert("Please add at least one persona to run the simulation.");
        return;
    }
    setStep('SIMULATION');
    setResponses([]);
    setSimulationProgress(0);
    
    const newResponses: SurveyResponse[] = [];
    
    // Process sequentially
    for (let i = 0; i < activeParticipants.length; i++) {
      const persona = activeParticipants[i];
      try {
        const resp = await simulateSurveyResponse(persona, survey);
        newResponses.push(resp);
        setResponses(prev => [...prev, resp]);
      } catch (e) {
        console.error(`Error simulating ${persona.name}`);
      }
      setSimulationProgress(((i + 1) / activeParticipants.length) * 100);
    }

    // Auto-analyze
    if (newResponses.length > 0) {
        try {
            setIsLoading(true);
            const analysisResult = await analyzeResults(survey, newResponses, activeParticipants);
            setAnalysis(analysisResult);
            setStep('RESULTS');
        } catch(e) {
            console.error("Analysis failed", e);
            alert("Simulation finished, but analysis failed.");
        } finally {
            setIsLoading(false);
        }
    } else {
        setStep('PERSONAS'); // Go back if no responses
        setIsLoading(false);
    }
  };

  // Export Handlers
  const downloadCSV = () => {
    const escapeCsv = (text: any) => {
        if (text === null || text === undefined) return "";
        const stringText = String(text);
        return `"${stringText.replace(/"/g, '""')}"`;
    };

    // Headers
    const headers = ['Persona ID', 'Name', 'Age', 'Occupation', 'Traits', ...survey.questions.map(q => escapeCsv(q.text))];
    const csvRows = [headers.join(',')];

    // Data Rows
    responses.forEach(r => {
        const p = activeParticipants.find(gp => gp.id === r.personaId);
        if (!p) return;

        const row = [
            escapeCsv(p.id),
            escapeCsv(p.name),
            p.age,
            escapeCsv(p.occupation),
            escapeCsv(p.traits),
            ...survey.questions.map(q => {
                const ans = r.answers.find(a => a.questionId === q.id)?.answer;
                return escapeCsv(ans);
            })
        ];
        csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${survey.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_data.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadTXT = () => {
    if (!analysis) return;
    const content = `
SURVEY REPORT
============================================
Title: ${survey.title}
Date: ${new Date().toLocaleDateString()}
Description: ${survey.description}

OVERALL SENTIMENT
--------------------------------------------
${analysis.sentiment}

EXECUTIVE SUMMARY
--------------------------------------------
${analysis.summary}

KEY INSIGHTS
--------------------------------------------
${analysis.keyInsights.map(i => `- ${i}`).join('\n')}

ACTIONABLE SUGGESTIONS
--------------------------------------------
${analysis.featureSuggestions.map(s => `- ${s}`).join('\n')}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${survey.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generatePDF = () => {
      const element = reportRef.current;
      if (!element) {
          window.print();
          return;
      }
      
      // Check if html2pdf is available (loaded via script tag in index.html)
      if ((window as any).html2pdf) {
           const opt = {
              margin:       10,
              filename:     `${survey.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`,
              image:        { type: 'jpeg', quality: 0.98 },
              html2canvas:  { scale: 2 },
              jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            (window as any).html2pdf().set(opt).from(element).save();
      } else {
          // Fallback
          window.print();
      }
  };

  // --- Renderers ---

  const renderPersonaCard = (p: GeneratedPersona, isLibrary: boolean, isEditing: boolean) => {
      if (isEditing && editForm) {
          return (
              <div key={p.id} className="bg-white p-5 rounded-xl shadow-md border-2 border-indigo-500 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                          <label className="text-xs text-gray-500">Name</label>
                          <input type="text" className="w-full border p-1 rounded" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs text-gray-500">Age</label>
                          <input type="number" className="w-full border p-1 rounded" value={editForm.age} onChange={e => setEditForm({...editForm, age: parseInt(e.target.value)})} />
                      </div>
                  </div>
                  <div className="mb-3">
                       <label className="text-xs text-gray-500">Occupation</label>
                       <input type="text" className="w-full border p-1 rounded" value={editForm.occupation} onChange={e => setEditForm({...editForm, occupation: e.target.value})} />
                  </div>
                  <div className="mb-3">
                       <label className="text-xs text-gray-500">Traits</label>
                       <textarea className="w-full border p-1 rounded text-sm" rows={2} value={editForm.traits} onChange={e => setEditForm({...editForm, traits: e.target.value})} />
                  </div>
                   <div className="mb-3">
                       <label className="text-xs text-gray-500">Pain Points</label>
                       <textarea className="w-full border p-1 rounded text-sm" rows={2} value={editForm.painPoints} onChange={e => setEditForm({...editForm, painPoints: e.target.value})} />
                  </div>
                  <div className="flex justify-end space-x-2 mt-2">
                      <button onClick={cancelEdit} className="p-2 text-gray-500 hover:bg-gray-100 rounded"><X size={16} /></button>
                      <button onClick={() => saveEdit(isLibrary)} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded"><Check size={16} /></button>
                  </div>
              </div>
          )
      }

      const isSaved = savedPersonas.some(saved => saved.id === p.id);

      return (
        <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4 items-start relative group hover:shadow-md transition-all">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                {p.name.charAt(0)}
            </div>
            <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-bold text-gray-900 flex items-center">
                            {p.name}, {p.age}
                        </h4>
                        <p className="text-sm text-gray-600 font-medium">{p.occupation}</p>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2 italic">"{p.traits}"</p>
                <div className="mt-3 text-xs bg-red-50 text-red-700 p-2 rounded border border-red-100">
                    <span className="font-semibold">Pain Points:</span> {p.painPoints}
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-2 mt-2 sm:mt-0">
                {!isLibrary && (
                    <button 
                        onClick={() => deleteActivePersona(p.id)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
                        title="Remove from survey"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
                 {isLibrary && (
                    <button 
                        onClick={() => removeFromLibrary(p.id)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
                        title="Delete from library"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
                <button 
                    onClick={() => startEditing(p)}
                    className="p-2 text-gray-400 hover:text-indigo-500 rounded-full hover:bg-indigo-50"
                    title="Edit"
                >
                    <Edit2 size={16} />
                </button>
                {!isLibrary && !isSaved && (
                     <button 
                        onClick={() => addToLibrary(p)}
                        className="p-2 text-gray-400 hover:text-green-600 rounded-full hover:bg-green-50"
                        title="Save to Library"
                    >
                        <Save size={16} />
                    </button>
                )}
                 {!isLibrary && isSaved && (
                     <div className="p-2 text-green-600" title="Saved in Library">
                        <CheckCircle size={16} />
                     </div>
                )}
            </div>
        </div>
    );
  }

  const renderLibrary = () => (
      <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
          <div className="flex justify-between items-end border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Persona Library</h2>
                <p className="text-gray-500">Manage your saved AI personas to reuse in future surveys.</p>
              </div>
              <div className="text-sm text-gray-400">
                  {savedPersonas.length} saved
              </div>
          </div>

          {savedPersonas.length === 0 ? (
               <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <Users size={48} className="text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Library is Empty</h3>
                    <p className="text-gray-500">Generate personas in a survey and click the save icon to store them here.</p>
               </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {savedPersonas.map(p => renderPersonaCard(p, true, editingPersonaId === p.id))}
              </div>
          )}
      </div>
  );

  const renderSurveyBuilder = () => (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Template Toolbar */}
      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col sm:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-2">
             <button 
                onClick={() => setIsLoadModalOpen(true)}
                className="flex items-center px-3 py-1.5 bg-white text-indigo-600 text-xs font-medium border border-indigo-200 rounded hover:bg-indigo-50 transition"
             >
                 <FolderOpen size={14} className="mr-1.5" /> Load Template
             </button>
         </div>
         <div className="flex gap-2">
             <button 
                onClick={openSaveTemplateModal}
                className="flex items-center px-3 py-1.5 bg-white text-indigo-600 text-xs font-medium border border-indigo-200 rounded hover:bg-indigo-50"
             >
                 <Save size={14} className="mr-1.5" /> Save Template
             </button>
             <button 
                onClick={resetSurveyForm}
                className="flex items-center px-3 py-1.5 bg-white text-gray-600 text-xs font-medium border border-gray-200 rounded hover:bg-red-50 hover:text-red-600"
             >
                 <RotateCcw size={14} className="mr-1.5" /> Reset Form
             </button>
         </div>
      </div>

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
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Add Participants */}
        <div className="lg:col-span-1 space-y-6">
            
            {/* Generator Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <User className="mr-2 text-indigo-600" size={20}/> Generate New
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Target Description</label>
                        <textarea
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 h-32 text-sm"
                            placeholder="E.g., Urban coffee lovers..."
                            value={targetDef.description}
                            onChange={(e) => setTargetDef(prev => ({...prev, description: e.target.value}))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
                        <select 
                            className="w-full p-2 border border-gray-300 rounded-md"
                            value={targetDef.count}
                            onChange={(e) => setTargetDef(prev => ({...prev, count: parseInt(e.target.value)}))}
                        >
                            <option value={1}>1 Persona</option>
                            <option value={3}>3 Personas</option>
                            <option value={5}>5 Personas</option>
                        </select>
                    </div>
                    <button
                        onClick={handleGeneratePersonas}
                        disabled={isLoading}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition font-medium flex justify-center items-center disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2" />}
                        {isLoading ? 'Generating...' : 'Generate & Add'}
                    </button>
                </div>
            </div>

            {/* Library Loader Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FolderOpen className="mr-2 text-yellow-600" size={20}/> Load from Library
                </h2>
                {savedPersonas.length === 0 ? (
                    <p className="text-sm text-gray-500">No saved personas found. Save generated personas to reuse them here.</p>
                ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {savedPersonas.map(p => {
                            const isAdded = activeParticipants.some(ap => ap.id === p.id);
                            return (
                                <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 text-sm">
                                    <div className="truncate pr-2">
                                        <span className="font-bold block truncate">{p.name}</span>
                                        <span className="text-gray-500 text-xs truncate">{p.occupation}</span>
                                    </div>
                                    <button 
                                        onClick={() => importFromLibrary(p)}
                                        disabled={isAdded}
                                        className={`p-1.5 rounded transition ${isAdded ? 'text-gray-400 bg-gray-200 cursor-default' : 'bg-white border hover:bg-green-50 text-green-600'}`}
                                    >
                                        {isAdded ? <Check size={14} /> : <Plus size={14} />}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

        </div>

        {/* Right Column: Active Participants List */}
        <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                    Participants ({activeParticipants.length})
                </h3>
                {activeParticipants.length > 0 && (
                    <button 
                        onClick={runSimulation}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow flex items-center font-medium transition animate-pulse-subtle"
                    >
                        <Play size={16} className="mr-2" /> Run Simulation
                    </button>
                )}
            </div>
            
            {activeParticipants.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                    <Users size={48} className="text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No Participants Added</h3>
                    <p className="text-gray-500 max-w-sm mt-2">
                        Generate new personas or load saved ones from your library to start the survey.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {activeParticipants.map(p => renderPersonaCard(p, false, editingPersonaId === p.id))}
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
                    const p = activeParticipants.find(gp => gp.id === r.personaId);
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
                {responses.length < activeParticipants.length && (
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
          <div className="max-w-5xl mx-auto space-y-8 print:space-y-4" ref={reportRef} id="report-content">
              {/* Export Actions */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
                  <div>
                      <h3 className="text-lg font-bold text-gray-900">Analysis Complete</h3>
                      <p className="text-sm text-gray-500">Review the insights below or export for your team.</p>
                  </div>
                  <div className="flex gap-3">
                      <button 
                        onClick={downloadCSV}
                        className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                      >
                          <FileSpreadsheet size={16} className="mr-2 text-green-600" /> CSV
                      </button>
                      <button 
                        onClick={downloadTXT}
                        className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                      >
                          <FileText size={16} className="mr-2 text-blue-600" /> TXT
                      </button>
                      <button 
                        onClick={generatePDF}
                        className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                      >
                          <Download size={16} className="mr-2" /> PDF Download
                      </button>
                  </div>
              </div>

              {/* Top Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print-break-inside-avoid">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
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
                          <div key={q.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm print-break-inside-avoid">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print-break-inside-avoid">
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
              
               <div className="flex justify-center pt-8 pb-12 no-print">
                  <button
                    onClick={() => {
                        setStep('SETUP');
                        setResponses([]);
                        setAnalysis(null);
                        // Intentionally NOT clearing activeParticipants or survey questions
                        // to allow easy iteration.
                        alert("Ready for a new run! Your survey questions and participants are preserved.");
                    }}
                    className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 transition font-medium"
                  >
                      Start New Survey (Reset Results)
                  </button>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 relative">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <BarChart2 className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight hidden sm:block">PersonaPulse AI</h1>
          </div>
          
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
             <button
                onClick={() => setActiveTab('SURVEY')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'SURVEY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
             >
                 Survey
             </button>
             <button
                onClick={() => setActiveTab('LIBRARY')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center ${
                    activeTab === 'LIBRARY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
             >
                 <Users size={14} className="mr-1.5" /> Library
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-8">
        
        {activeTab === 'SURVEY' ? (
            <div className="animate-fadeIn">
                <div className="no-print mb-8">
                    <StepIndicator currentStep={step} />
                </div>

                {step === 'SETUP' && renderSurveyBuilder()}
                {step === 'PERSONAS' && renderPersonaBuilder()}
                {step === 'SIMULATION' && renderSimulation()}
                {step === 'RESULTS' && renderResults()}
            </div>
        ) : (
            renderLibrary()
        )}

      </main>

      {/* Save Template Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md transform transition-all">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Save Survey Template</h3>
                    <button onClick={() => setIsSaveModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-4">Give your survey a memorable name to reuse it later.</p>
                <input 
                    type="text" 
                    className="w-full border border-gray-300 p-2 rounded-lg mb-6 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={templateNameInput}
                    onChange={e => setTemplateNameInput(e.target.value)}
                    placeholder="E.g. Product Concept Validation"
                    autoFocus
                />
                <div className="flex justify-end space-x-2">
                    <button 
                        onClick={() => setIsSaveModalOpen(false)} 
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={saveTemplate} 
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm"
                    >
                        Save Template
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Load Template Modal */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl transform transition-all max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-900">Load Survey Template</h3>
                    <button onClick={() => setIsLoadModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                
                {savedTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <LayoutList size={48} className="mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No templates saved yet.</p>
                        <p className="text-sm">Create a survey and click "Save Template" to see it here.</p>
                    </div>
                ) : (
                    <div className="overflow-y-auto flex-grow pr-2 custom-scrollbar space-y-3">
                        {savedTemplates.map(t => (
                            <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors">
                                <div>
                                    <h4 className="font-bold text-gray-900 text-lg">{t.name}</h4>
                                    <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
                                        <span className="flex items-center"><Calendar size={12} className="mr-1"/> {new Date(t.createdAt).toLocaleDateString()}</span>
                                        <span className="flex items-center"><LayoutList size={12} className="mr-1"/> {t.survey.questions.length} Questions</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button 
                                        onClick={() => deleteTemplate(t.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                                        title="Delete Template"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => loadTemplate(t)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm text-sm flex items-center"
                                    >
                                        Load <ChevronRight size={16} className="ml-1" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default App;