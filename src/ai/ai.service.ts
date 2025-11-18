import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'node:fs/promises';

export interface QuizQuestion {
  questionType: 'true-false' | 'single-select' | 'multi-select' | 'matching' | 'fill-blank';
  question: string;
  options?: string[];
  correctAnswer: number | number[] | string | { [key: string]: string };
  explanation?: string;
  // For matching questions
  leftColumn?: string[];
  rightColumn?: string[];
}

export interface Flashcard {
  front: string;
  back: string;
  explanation?: string;
}

@Injectable()
export class AiService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: any;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
      },
    });
  }

  /**
   * Process uploaded files - text files and PDFs are read as bytes
   */
  async processFiles(files: Express.Multer.File[]): Promise<{textContent?: string; pdfParts?: any[]}> {
    const textContents: string[] = [];
    const pdfParts: any[] = [];

    for (const file of files) {
      try {
        if (file.mimetype === 'application/pdf') {
          // Read PDF as bytes for inline data
          const pdfData = await fs.readFile(file.path);
          pdfParts.push({
            inlineData: {
              data: pdfData.toString('base64'),
              mimeType: 'application/pdf',
            },
          });
        } else {
          // Read text files directly
          const content = await fs.readFile(file.path, 'utf-8');
          textContents.push(content);
        }
        
        // Clean up uploaded file after processing
        await fs.unlink(file.path).catch(() => {});
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        throw new Error(`Failed to process file: ${file.originalname}`);
      }
    }

    return {
      textContent: textContents.length > 0 ? textContents.join('\n\n=== NEXT DOCUMENT ===\n\n') : undefined,
      pdfParts: pdfParts.length > 0 ? pdfParts : undefined,
    };
  }

  /**
   * Generate quiz questions from text or files
   */
  async generateQuiz(params: {
    topic?: string;
    content?: string;
    files?: Express.Multer.File[];
    numberOfQuestions: number;
    difficulty: 'easy' | 'medium' | 'hard';
    quizType?: 'standard' | 'timed' | 'scenario';
    questionTypes?: ('true-false' | 'single-select' | 'multi-select' | 'matching' | 'fill-blank')[];
  }): Promise<{ questions: QuizQuestion[]; title: string; topic: string }> {
    const { topic, content, files, numberOfQuestions, difficulty, quizType = 'standard', questionTypes = ['single-select', 'true-false'] } = params;

    // Process files if provided
    let sourceContent = content || '';
    let pdfParts: any[] | undefined;
    if (files && files.length > 0) {
      const processed = await this.processFiles(files);
      sourceContent = processed.textContent || sourceContent;
      pdfParts = processed.pdfParts;
    }

    // Build question type instructions
    const questionTypeInstructions = this.buildQuestionTypeInstructions(questionTypes);
    const quizTypeContext = this.buildQuizTypeContext(quizType);

    const prompt = `
You are an expert quiz generator. Generate ${numberOfQuestions} questions based on the following:

${topic ? `Topic: ${topic}` : ''}
${sourceContent ? `Content:\n${sourceContent}` : ''}

Difficulty Level: ${difficulty}
Quiz Type: ${quizType} ${quizTypeContext}

Question Types to Generate:
${questionTypeInstructions}

Requirements:
1. Distribute questions evenly across the specified question types
2. For each question, include the "questionType" field
3. Questions should be clear and unambiguous
4. Provide brief explanations for correct answers
5. Make questions appropriate for the quiz type and difficulty level

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{
  "title": "Generated quiz title",
  "topic": "Main topic covered",
  "questions": [
    // For true-false questions:
    {
      "questionType": "true-false",
      "question": "Statement here?",
      "options": ["True", "False"],
      "correctAnswer": 0,
      "explanation": "Brief explanation"
    },
    // For single-select questions:
    {
      "questionType": "single-select",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation"
    },
    // For multi-select questions:
    {
      "questionType": "multi-select",
      "question": "Select all that apply:",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": [0, 2],
      "explanation": "Brief explanation"
    },
    // For matching questions:
    {
      "questionType": "matching",
      "question": "Match the following:",
      "leftColumn": ["Item 1", "Item 2", "Item 3"],
      "rightColumn": ["Match A", "Match B", "Match C"],
      "correctAnswer": {"Item 1": "Match A", "Item 2": "Match B", "Item 3": "Match C"},
      "explanation": "Brief explanation"
    },
    // For fill-in-the-blank questions:
    {
      "questionType": "fill-blank",
      "question": "Complete the sentence: The capital of France is ____.",
      "correctAnswer": "Paris",
      "explanation": "Brief explanation"
    }
  ]
}
`;

    // Build request parts - PDFs first, then prompt
    const parts: any[] = [];
    if (pdfParts && pdfParts.length > 0) {
      parts.push(...pdfParts);
    }
    parts.push({ text: prompt });

    const result = await this.model.generateContent(parts);
    const response = await result.response;
    const responseText = response.text();

    // Parse JSON response
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = responseText
        .replaceAll(/```json\n?/g, '')
        .replaceAll(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedResponse);
      return {
        title: parsed.title || `${topic || 'Quiz'} - ${difficulty}`,
        topic: parsed.topic || topic || 'General Knowledge',
        questions: parsed.questions,
      };
    } catch (error) {
      console.error('Failed to parse AI response:', responseText, error);
      throw new Error('Failed to generate valid quiz format');
    }
  }

  /**
   * Build instructions for question types
   */
  private buildQuestionTypeInstructions(questionTypes: string[]): string {
    const instructions: string[] = [];
    
    if (questionTypes.includes('true-false')) {
      instructions.push('- True/False: Statement questions with True or False options');
    }
    if (questionTypes.includes('single-select')) {
      instructions.push('- Single-select: Multiple choice with one correct answer (4 options)');
    }
    if (questionTypes.includes('multi-select')) {
      instructions.push('- Multi-select: Multiple choice with multiple correct answers (4-6 options)');
    }
    if (questionTypes.includes('matching')) {
      instructions.push('- Matching: Match items from left column to right column (3-5 pairs)');
    }
    if (questionTypes.includes('fill-blank')) {
      instructions.push('- Fill-in-the-blank: Complete the sentence or phrase with the correct answer');
    }
    
    return instructions.join('\n');
  }

  /**
   * Build context for quiz type
   */
  private buildQuizTypeContext(quizType: string): string {
    switch (quizType) {
      case 'timed':
        return '(This quiz will be timed, so questions should be clear and focused)';
      case 'scenario':
        return '(Questions should be scenario-based with real-world context and applications)';
      default:
        return '(Standard quiz format)';
    }
  }

  /**
   * Generate flashcards from topic, text, or files
   */
  async generateFlashcards(params: {
    topic?: string;
    content?: string;
    files?: Express.Multer.File[];
    numberOfCards: number;
  }): Promise<{ cards: Flashcard[]; title: string; topic: string }> {
    const { topic, content, files, numberOfCards } = params;

    // Process files if provided
    let sourceContent = content || '';
    let pdfParts: any[] | undefined;
    if (files && files.length > 0) {
      const processed = await this.processFiles(files);
      sourceContent = processed.textContent || sourceContent;
      pdfParts = processed.pdfParts;
    }

    const prompt = `
You are an expert flashcard creator. Generate ${numberOfCards} flashcards based on the following:

${topic ? `Topic: ${topic}` : ''}
${sourceContent ? `Content:\n${sourceContent}` : ''}

Requirements:
1. Front side should be a concise question or term
2. Back side should be a clear, complete answer or definition
3. Add an optional explanation with additional context, examples, or mnemonics to help remember
4. Focus on key concepts, definitions, and important facts
5. Make cards clear and educational
6. Avoid overly complex or ambiguous cards

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{
  "title": "Generated flashcard set title",
  "topic": "Main topic covered",
  "cards": [
    {
      "front": "Question or term",
      "back": "Answer or definition",
      "explanation": "Additional context, examples, or memory aids (optional)"
    }
  ]
}
`;

    // Build request parts - PDFs first, then prompt
    const parts: any[] = [];
    if (pdfParts && pdfParts.length > 0) {
      parts.push(...pdfParts);
    }
    parts.push({ text: prompt });

    const result = await this.model.generateContent(parts);
    const response = await result.response;
    const responseText = response.text();

    // Parse JSON response
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = responseText
        .replaceAll(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedResponse);
      return {
        title: parsed.title || `${topic || 'Flashcards'}`,
        topic: parsed.topic || topic || 'Study Cards',
        cards: parsed.cards,
      };
    } catch (error) {
      console.error('Failed to parse AI response:', responseText);
      throw new Error('Failed to generate valid flashcard format');
    }
  }

  /**
   * Generate personalized recommendations based on user performance
   */
  async generateRecommendations(params: {
    weakTopics: string[];
    recentAttempts: any[];
  }): Promise<Array<{ topic: string; reason: string; priority: string }>> {
    const { weakTopics, recentAttempts } = params;

    const prompt = `
Analyze the following user learning data and generate 3-5 personalized study recommendations:

Weak Topics: ${JSON.stringify(weakTopics)}
Recent Performance: ${JSON.stringify(recentAttempts.slice(0, 10))}

Generate recommendations focusing on:
1. Topics where the user scored poorly
2. Topics not practiced recently
3. Progressive learning paths

Return ONLY a valid JSON array in this exact format (no markdown, no code blocks):
[
  {
    "topic": "Topic name",
    "reason": "Why this is recommended",
    "priority": "high|medium|low"
  }
]
`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    try {
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('Failed to parse recommendations:', responseText);
      return [];
    }
  }
}
