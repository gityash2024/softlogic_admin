import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, HelpCircle, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { extractApiError } from '@/lib/api';
import { assessmentApi, type Assessment } from '@/services/assessment.api';
import { cn } from '@/lib/utils';

interface StudentAssessmentSubmitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: Assessment | null;
}

export function StudentAssessmentSubmitModal({
  open,
  onOpenChange,
  assessment,
}: StudentAssessmentSubmitModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  
  // For MCQ
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const resetState = () => {
    setFile(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setSubmitted(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const submitMcqMutation = useMutation({
    mutationFn: async () => {
      if (!assessment) return;
      const payload = {
        answers: Object.entries(answers).map(([questionId, selectedOptionIds]) => ({
          questionId,
          selectedOptionIds,
        })),
      };
      return await assessmentApi.submitAssessment(assessment.id, payload);
    },
    onSuccess: () => {
      toast.success('Assessment submitted successfully!');
      setSubmitted(true);
      if (assessment) {
        queryClient.invalidateQueries({ queryKey: ['assessments-session', assessment.liveSessionId] });
      }
    },
    onError: (err) => {
      toast.error(extractApiError(err));
    },
  });

  const submitFileMutation = useMutation({
    mutationFn: async () => {
      if (!assessment || !file) return;
      return await assessmentApi.submitAssessmentFile(assessment.id, file);
    },
    onSuccess: () => {
      toast.success('File uploaded and submitted successfully!');
      setSubmitted(true);
      if (assessment) {
        queryClient.invalidateQueries({ queryKey: ['assessments-session', assessment.liveSessionId] });
      }
    },
    onError: (err) => {
      toast.error(extractApiError(err));
    },
  });

  if (!assessment) return null;
  const isMcq = assessment.type === 'MCQ';

  const renderContent = () => {
    const existingSubmission = assessment?.submissions?.[0];

    if (submitted || existingSubmission) {
      const submission = existingSubmission || (submitted ? { status: 'GRADED', totalScore: 0, maxScore: 0 } : null); // Fallback for newly submitted state where query hasn't updated yet

      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-success/10 p-4 mb-4">
            <CheckCircle2 className="h-12 w-12 text-success" />
          </div>
          <h3 className="text-xl font-bold text-ink-900">
            {isMcq ? 'Assessment Completed' : 'File Submitted Successfully'}
          </h3>
          <p className="mt-2 text-sm text-ink-500">
            {isMcq && existingSubmission
              ? `You scored ${existingSubmission.totalScore ?? 0} out of ${assessment.maxScore ?? assessment.questions?.length ?? 0} points.`
              : (existingSubmission?.fileName ? `File: ${existingSubmission.fileName}` : 'Your assessment has been recorded.')}
          </p>
          <Button className="mt-6" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </div>
      );
    }

    if (!isMcq) {
      return (
        <div className="space-y-6">
          <div className="rounded-lg border-2 border-dashed border-line p-8 text-center bg-surface-variant/40">
            <FileText className="mx-auto h-12 w-12 text-ink-300 mb-4" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-900">
                Upload your assignment file
              </p>
              <p className="text-xs text-ink-500">
                Ensure your file is under 50MB. PDFs or Word documents are preferred.
              </p>
            </div>
            <div className="mt-6 max-w-sm mx-auto">
              <Label htmlFor="file-upload" className="sr-only">Choose file</Label>
              <Input
                id="file-upload"
                type="file"
                className="cursor-pointer"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!file || submitFileMutation.isPending}
              onClick={() => submitFileMutation.mutate()}
            >
              {submitFileMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Submit File
            </Button>
          </div>
        </div>
      );
    }

    const questions = assessment.questions || [];
    if (questions.length === 0) {
      return <p className="text-sm text-ink-500 py-4">No questions found in this assessment.</p>;
    }

    const question = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const isFirstQuestion = currentQuestionIndex === 0;

    const handleOptionSelect = (optionId: string) => {
      setAnswers((prev) => ({
        ...prev,
        [question.id!]: [optionId],
      }));
    };

    const hasAnsweredCurrent = Boolean(answers[question.id!]?.length > 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-ink-500">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
          <p className="text-xs font-semibold text-brand-primary">
            {question.points} Points
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-ink-900">{question.prompt}</h3>
          <div className="space-y-2">
            {question.options.map((opt: any) => {
              const isSelected = answers[question.id!]?.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => handleOptionSelect(opt.id)}
                  className={cn(
                    "cursor-pointer rounded-lg border p-4 transition-colors",
                    isSelected
                      ? "border-brand-primary bg-brand-primary/5 shadow-sm"
                      : "border-line bg-white hover:border-brand-primary/40 hover:bg-surface-variant/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border",
                        isSelected
                          ? "border-brand-primary bg-brand-primary text-white"
                          : "border-ink-300"
                      )}
                    >
                      {isSelected && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                    <span className="text-sm font-medium text-ink-800">
                      {opt.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-line">
          <Button
            variant="outline"
            disabled={isFirstQuestion}
            onClick={() => setCurrentQuestionIndex((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          
          {isLastQuestion ? (
            <Button
              disabled={!hasAnsweredCurrent || submitMcqMutation.isPending}
              onClick={() => submitMcqMutation.mutate()}
            >
              {submitMcqMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Assessment
            </Button>
          ) : (
            <Button
              disabled={!hasAnsweredCurrent}
              onClick={() => setCurrentQuestionIndex((p) => Math.min(questions.length - 1, p + 1))}
            >
              Next Question
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2">
              {isMcq ? (
                <HelpCircle className="h-5 w-5 text-brand-primary" />
              ) : (
                <Upload className="h-5 w-5 text-brand-primary" />
              )}
              {assessment.title}
            </DialogTitle>
          </div>
          <DialogDescription>
            {assessment.description || (isMcq ? 'Complete the quiz below.' : 'Upload your assignment file.')}
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
