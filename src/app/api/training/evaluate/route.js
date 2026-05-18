import { NextResponse } from 'next/server';
import { callGroq, safeJSONParse } from '@/lib/ai';
import { getSession } from '@/lib/auth';
import { saveInterviewHistory, saveMcqHistory } from '@/lib/training';

export async function POST(request) {
  try {
    const session = await getSession();
    const userId = session ? session.email : 'guest';
    const { type, questions, answers, role, difficulty, techStack } = await request.json();

    if (type === 'mock-interview') {
      const system = `You are an expert interview coach. Evaluate the candidate's answers and provide scores.
Return a JSON object: { "overallScore": 75, "communication": 7, "technicalAccuracy": 8, "strengths": ["..."], "improvements": ["..."], "detailedFeedback": [{ "questionId": 1, "score": 8, "comment": "..." }] }`;

      const user = `Questions and Answers:
${questions.map((q, i) => `
Q${i + 1} (${q.type}): ${q.question}
Answer: ${answers[i] || 'No answer'}
`).join('\n')}

Score each answer 1-10 and provide overall feedback.`;

      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ];

      let text;
      try {
        text = await callGroq(messages, 2048);
      } catch {
        const { invokeAI } = await import('@/lib/ai');
        text = await invokeAI(system, user, 2048);
      }

      const evaluation = safeJSONParse(text) || {
        overallScore: 0,
        communication: 0,
        technicalAccuracy: 0,
        strengths: [],
        improvements: [],
        detailedFeedback: []
      };

      // Save to database
      saveInterviewHistory(userId, {
        type: 'text',
        role: role || 'Software Developer',
        difficulty: difficulty || 'mid',
        overallScore: evaluation.overallScore || 0,
        communication: evaluation.communication || 0,
        technicalAccuracy: evaluation.technicalAccuracy || 0,
        strengths: evaluation.strengths || [],
        improvements: evaluation.improvements || [],
        detailedFeedback: evaluation.detailedFeedback || [],
        answers: Object.keys(answers).map(k => ({
          question: questions[k]?.question,
          answer: answers[k],
          score: evaluation.detailedFeedback?.[k]?.score || 0,
          comment: evaluation.detailedFeedback?.[k]?.comment || 'Reviewed'
        }))
      });

      return NextResponse.json(evaluation);
    }

    if (type === 'technical-mock') {
      let correctCount = 0;
      const results = questions.map((q, i) => {
        const isCorrect = answers[i] === q.correct;
        if (isCorrect) correctCount++;
        return { questionId: q.id, correct: q.correct, selected: answers[i], isCorrect, explanation: q.explanation };
      });

      const mcqResult = {
        score: Math.round((correctCount / questions.length) * 100),
        correctCount,
        totalQuestions: questions.length,
        results,
      };

      // Save to database
      saveMcqHistory(userId, {
        techStack: techStack || 'General Tech',
        difficulty: difficulty || 'mid',
        score: mcqResult.score,
        correctCount,
        totalQuestions: questions.length,
        results: results.map((r, i) => ({
          question: questions[i]?.question,
          options: questions[i]?.options,
          correct: r.correct,
          selected: r.selected,
          isCorrect: r.isCorrect,
          explanation: r.explanation
        }))
      });

      return NextResponse.json(mcqResult);
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (err) {
    console.error('Evaluate API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
