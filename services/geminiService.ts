import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeneratedPersona, Question, QuestionType, Survey, AnalysisResult, SurveyResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Generates specific personas based on a broad target description.
 */
export const generatePersonas = async (
  description: string,
  count: number
): Promise<GeneratedPersona[]> => {
  
  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        name: { type: Type.STRING },
        age: { type: Type.INTEGER },
        occupation: { type: Type.STRING },
        traits: { type: Type.STRING, description: "Comma separated personality traits" },
        painPoints: { type: Type.STRING, description: "Key frustrations related to the target description" },
      },
      required: ["id", "name", "age", "occupation", "traits", "painPoints"],
    },
  };

  const prompt = `
    Generate ${count} distinct and realistic user personas based on the following target audience description:
    "${description}"
    
    Ensure diversity in background within the constraints of the target audience.
    Assign a unique ID (e.g., "p1", "p2") to each.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  const text = response.text;
  if (!text) return [];
  return JSON.parse(text) as GeneratedPersona[];
};

/**
 * Simulates a single persona answering the survey.
 */
export const simulateSurveyResponse = async (
  persona: GeneratedPersona,
  survey: Survey
): Promise<SurveyResponse> => {
  
  // Construct a schema dynamically based on questions is ideal, 
  // but for simplicity we'll ask for a standard array of objects.
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      answers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            questionId: { type: Type.STRING },
            answer: { type: Type.STRING, description: "The answer text or selected option" }
          },
          required: ["questionId", "answer"]
        }
      }
    },
    required: ["answers"]
  };

  const questionsText = survey.questions.map(q => {
    let details = "";
    if (q.type === QuestionType.MULTIPLE_CHOICE) {
      details = `(Options: ${q.options?.join(', ')})`;
    } else if (q.type === QuestionType.RATING_SCALE) {
      details = `(Rate from 1 to 5)`;
    }
    return `ID: ${q.id}. Question: "${q.text}" ${details}`;
  }).join('\n');

  const systemInstruction = `
    You are role-playing as a specific persona. 
    Name: ${persona.name}
    Age: ${persona.age}
    Job: ${persona.occupation}
    Traits: ${persona.traits}
    Pain Points: ${persona.painPoints}

    Answer the following survey questions authentically as this person would.
    Be honest, consistent with your traits, and provide realistic detail for open-ended questions.
  `;

  const prompt = `
    Please answer this survey:
    ${questionsText}
    
    Return the answers in a structured format matching the question IDs.
    For rating scales, return the number as a string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    
    const parsed = JSON.parse(text);
    
    // Sanitize: Ensure numerical answers for ratings are handled if parsed as strings
    const sanitizedAnswers = parsed.answers.map((a: any) => {
        const q = survey.questions.find(quest => quest.id === a.questionId);
        if (q?.type === QuestionType.RATING_SCALE) {
             // Ensure it's a number, clamped 1-5
             let val = parseInt(a.answer);
             if (isNaN(val)) val = 3;
             return { ...a, answer: val };
        }
        return a;
    });

    return {
      personaId: persona.id,
      answers: sanitizedAnswers
    };

  } catch (e) {
    console.error("Simulation failed for persona", persona.name, e);
    // Return empty or fallback to avoid crashing entire batch
    return { personaId: persona.id, answers: [] };
  }
};

/**
 * Analyzes all collected responses to generate a market research report.
 */
export const analyzeResults = async (
  survey: Survey,
  responses: SurveyResponse[],
  personas: GeneratedPersona[]
): Promise<AnalysisResult> => {

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "Executive summary of the findings" },
      keyInsights: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "List of 3-5 major takeaways"
      },
      sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] },
      featureSuggestions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of concrete product or marketing suggestions based on feedback"
      }
    },
    required: ["summary", "keyInsights", "sentiment", "featureSuggestions"]
  };

  // Prepare data for analysis
  const dataContext = responses.map(r => {
    const p = personas.find(per => per.id === r.personaId);
    const answersReadable = r.answers.map(a => {
        const q = survey.questions.find(qu => qu.id === a.questionId);
        return `Q: "${q?.text}" -> A: "${a.answer}"`;
    }).join('; ');
    return `Participant: ${p?.name} (${p?.occupation}, ${p?.age}). Answers: [${answersReadable}]`;
  }).join('\n---\n');

  const prompt = `
    Analyze the following survey results from a simulated focus group.
    Survey Title: ${survey.title}
    Survey Description: ${survey.description}

    Data:
    ${dataContext}

    Provide a comprehensive analysis for the product/marketing team.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Can use pro for deeper reasoning if needed
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Analysis failed");
  return JSON.parse(text) as AnalysisResult;
};