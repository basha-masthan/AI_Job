import { NextResponse } from 'next/server';
import { callGroq } from '@/lib/ai';
import { safeJSONParse } from '@/lib/ai';

export async function POST(request) {
  try {
    const { type, role, difficulty, techStack, jobDescription } = await request.json();

    if (type === 'mock-interview') {
      let system = `You are an expert technical interviewer. Generate 5 interview questions for the given role and difficulty.`;
      if (jobDescription) {
        system += `\n\nCRITICAL REQUIREMENT: These questions MUST be specifically tailored to screen the candidate for the exact skills, responsibilities, and requirements described in this Job Description (JD):\n"""\n${jobDescription}\n"""`;
      }
      system += `\n\nReturn a JSON array of objects with: { "id": 1, "type": "behavioral|technical|problem-solving", "question": "question text", "expectedKeywords": ["keyword1", "keyword2"] }`;

      const user = `Role: ${role}
Difficulty: ${difficulty || 'mid'}
${jobDescription ? 'CUSTOM JD TAILORED: Yes' : ''}

Generate 5 mixed interview questions (2 behavioral, 2 technical, 1 problem-solving).`;

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

      const questions = safeJSONParse(text, []);
      return NextResponse.json({ questions });
    }

    if (type === 'technical-mock') {
      let system = `You are a technical assessment generator. Generate 10 MCQ questions for the given tech stack and difficulty.`;
      if (jobDescription) {
        system += `\n\nCRITICAL REQUIREMENT: These multiple-choice questions MUST be specifically tailored to evaluate the candidate's core understanding of the skills, technologies, concepts, and responsibilities highlighted in this Job Description (JD):\n"""\n${jobDescription}\n"""`;
      }
      system += `\n\nReturn a JSON array of objects with: { "id": 1, "question": "question text", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "why this answer" }`;

      const user = `Tech Stack/Role: ${techStack || role}
Difficulty: ${difficulty || 'mid'}
${jobDescription ? 'CUSTOM JD TAILORED: Yes' : ''}

Generate 10 multiple-choice questions with 4 options each.`;

      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ];

      let text;
      try {
        text = await callGroq(messages, 4096);
      } catch {
        const { invokeAI } = await import('@/lib/ai');
        text = await invokeAI(system, user, 4096);
      }

      const questions = safeJSONParse(text, []);
      return NextResponse.json({ questions });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
