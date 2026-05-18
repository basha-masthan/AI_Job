import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { invokeAI } from '@/lib/ai';
import { getSession } from '@/lib/auth';
import { saveInterviewHistory } from '@/lib/training';

export async function POST(req) {
  try {
    const session = await getSession();
    const userId = session ? session.email : 'guest';
    
    // Parse the FormData which contains the video blob and the transcript
    const formData = await req.formData();
    const videoFile = formData.get('video');
    const messagesStr = formData.get('messages');
    const role = formData.get('role');
    const difficulty = formData.get('difficulty');
    
    let videoUrl = null;
    
    // 1. Save the video to public/uploads
    if (videoFile && videoFile.size > 0) {
      try {
        const buffer = Buffer.from(await videoFile.arrayBuffer());
        const isVercel = process.env.VERCEL === '1' || process.env.NOW_BUILDER === '1';
        const uploadDir = isVercel 
          ? path.join('/tmp', 'uploads', 'interviews')
          : path.join(process.cwd(), 'public', 'uploads', 'interviews');
        
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filename = `interview_${userId}_${Date.now()}.webm`;
        fs.writeFileSync(path.join(uploadDir, filename), buffer);
        videoUrl = isVercel ? null : `/uploads/interviews/${filename}`;
      } catch (err) {
        console.warn('Failed to save interview video locally due to serverless read-only filesystem:', err.message);
        videoUrl = null; // Failsafe fallback
      }
    }
    
    // 2. Evaluate the transcript using the AI engine
    const messages = messagesStr ? JSON.parse(messagesStr) : [];
    
    if (messages.length < 2) {
      return NextResponse.json({ error: 'Conversation too short to evaluate.' }, { status: 400 });
    }
    
    // Format the conversation for the evaluator prompt
    const conversationText = messages.map(m => `${m.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${m.content}`).join('\n');
    
    const evalPrompt = `
You are an expert technical recruiter evaluating a candidate's mock interview performance.
Role: ${role}
Difficulty: ${difficulty}

Here is the raw transcript of the voice interview:
${conversationText}

Evaluate the candidate based only on their answers. Ignore any speech-to-text transcription errors.
Return ONLY a valid JSON object matching this schema:
{
  "overallScore": <number 1-100>,
  "communication": <number 1-10>,
  "technicalAccuracy": <number 1-10>,
  "strengths": ["string", "string"],
  "improvements": ["string", "string"],
  "detailedFeedback": [
    { "score": <1-10>, "comment": "string analyzing a specific answer given by the candidate" }
  ]
}`;

    const rawResponse = await invokeAI(evalPrompt, "Please generate the JSON evaluation report according to the specified instructions.", 1500);
    
    let evaluation;
    try {
      const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      evaluation = JSON.parse(cleanJson);
      evaluation.videoUrl = videoUrl; // Attach the video URL to the result
    } catch (parseError) {
      console.error('Failed to parse voice evaluation JSON:', rawResponse);
      throw new Error('AI returned an invalid evaluation format.');
    }

    // Save Voice Interview History to Database
    saveInterviewHistory(userId, {
      type: 'voice',
      role: role || 'Software Developer',
      difficulty: difficulty || 'mid',
      overallScore: evaluation.overallScore || 0,
      communication: evaluation.communication || 0,
      technicalAccuracy: evaluation.technicalAccuracy || 0,
      strengths: evaluation.strengths || [],
      improvements: evaluation.improvements || [],
      detailedFeedback: evaluation.detailedFeedback || [],
      videoUrl: videoUrl,
      answers: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    });
    
    return NextResponse.json(evaluation);
    
  } catch (error) {
    console.error('Evaluate Voice API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
