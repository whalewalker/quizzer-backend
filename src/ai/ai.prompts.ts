export class AiPrompts {
  static generateQuiz(
    topic: string,
    numberOfQuestions: number,
    difficulty: string,
    quizType: string,
    questionTypeInstructions: string,
    sourceContent: string = ""
  ) {
    return `
You are an expert quiz generator. Generate ${numberOfQuestions} questions based on the following:

${topic ? `Topic: ${topic}` : ""}
${sourceContent ? `Content:\n${sourceContent}` : ""}

Difficulty Level: ${difficulty}
Quiz Type: ${quizType}

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
  }

  static generateFlashcards(
    topic: string,
    numberOfCards: number,
    sourceContent: string = ""
  ) {
    return `
You are an expert flashcard creator. Generate ${numberOfCards} flashcards based on the following:

${topic ? `Topic: ${topic}` : ""}
${sourceContent ? `Content:\n${sourceContent}` : ""}

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
  }

  static generateRecommendations(weakTopics: string[], recentAttempts: any[]) {
    return `
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
  }

  static generateContent(topic: string) {
    return `Generate comprehensive educational content about: ${topic}. Include key concepts, explanations, and examples.`;
  }

  static extractTopic(text: string) {
    return `Based on this text, provide a single concise topic name (max 3 words): ${text}`;
  }
}
