import { api } from '@/lib/api';
import type { ApiResponse } from '@/types/api';

export type AssessmentType = 'FILE_UPLOAD' | 'MCQ';

export interface MCQQuestion {
  id?: string;
  prompt: string;
  points: number;
  options: string[];
  correctOptionIndex: number;
}

export interface CreateAssessmentPayload {
  liveSessionId: string;
  title: string;
  description?: string;
  type: AssessmentType;
  maxScore?: number;
  dueDate?: string;
  timeLimitMinutes?: number;
  settings?: Record<string, any>;
  questions?: any[];
}

export interface Assessment {
  id: string;
  liveSessionId: string;
  title: string;
  description?: string | null;
  type: AssessmentType;
  maxScore?: number | null;
  dueDate?: string | null;
  timeLimitMinutes?: number | null;
  questions?: MCQQuestion[] | null;
  settings?: Record<string, any> | null;
  submissionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MCQAnswerBreakdown {
  questionIndex: number;
  prompt: string;
  options: string[];
  selectedOptionIndex: number;
  correctOptionIndex: number;
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
}

export interface AssessmentSubmission {
  id: string;
  assessmentId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string | null;
  submittedAt: string;
  // File Upload specific fields
  fileUrl?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  score?: number | null;
  maxScore?: number | null;
  feedback?: string | null;
  gradedAt?: string | null;
  // MCQ specific fields
  autoScore?: number | null;
  totalPoints?: number | null;
  percentage?: number | null;
  correctCount?: number | null;
  incorrectCount?: number | null;
  breakdown?: MCQAnswerBreakdown[] | null;
}

export interface SubmitAssessmentPayload {
  answers: {
    questionId: string;
    selectedOptionIds: string[];
  }[];
}

export interface GradeSubmissionPayload {
  score: number;
  feedback?: string;
}

export async function createAssessment(payload: CreateAssessmentPayload): Promise<Assessment> {
  const res = await api.post<ApiResponse<Assessment>>('/assessments', payload);
  return res.data.data;
}

export async function getAssessmentsBySession(sessionId: string): Promise<Assessment[]> {
  const res = await api.get<ApiResponse<Assessment[]>>(`/live-sessions/${sessionId}/assessments`);
  return res.data.data;
}

export async function getSubmissions(assessmentId: string): Promise<AssessmentSubmission[]> {
  const res = await api.get<ApiResponse<AssessmentSubmission[]>>(`/assessments/${assessmentId}/submissions`);
  return res.data.data;
}

export async function gradeSubmission(
  submissionId: string,
  payload: GradeSubmissionPayload,
): Promise<AssessmentSubmission> {
  const res = await api.patch<ApiResponse<AssessmentSubmission>>(`/assessments/submissions/${submissionId}/grade`, payload);
  return res.data.data;
}

export async function submitAssessment(
  assessmentId: string,
  payload: SubmitAssessmentPayload,
): Promise<AssessmentSubmission> {
  const res = await api.post<ApiResponse<AssessmentSubmission>>(`/assessments/${assessmentId}/submit`, payload);
  return res.data.data;
}

export async function submitAssessmentFile(
  assessmentId: string,
  file: File,
): Promise<AssessmentSubmission> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<ApiResponse<AssessmentSubmission>>(`/assessments/${assessmentId}/submit-file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export const assessmentApi = {
  createAssessment,
  getAssessmentsBySession,
  getSubmissions,
  gradeSubmission,
  submitAssessment,
  submitAssessmentFile,
};
