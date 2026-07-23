import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  HelpCircle,
  Loader2,
  Save,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  getSubmissions,
  gradeSubmission,
  type Assessment,
  type AssessmentSubmission,
} from '@/services/assessment.api';

interface AssessmentSubmissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: Assessment | null;
}

export function AssessmentSubmissionsModal({
  open,
  onOpenChange,
  assessment,
}: AssessmentSubmissionsModalProps) {
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state for grading file upload submissions (keyed by submissionId)
  const [gradingState, setGradingState] = useState<
    Record<string, { score: string; feedback: string; isSaving: boolean }>
  >({});

  // Selected submission for detailed MCQ breakdown view
  const [selectedMcqSubmission, setSelectedMcqSubmission] =
    useState<AssessmentSubmission | null>(null);

  useEffect(() => {
    if (!open || !assessment) {
      setSubmissions([]);
      setGradingState({});
      setSelectedMcqSubmission(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getSubmissions(assessment.id)
      .then((data) => {
        if (!isMounted) return;
        setSubmissions(data || []);
        const initialMap: Record<string, { score: string; feedback: string; isSaving: boolean }> =
          {};
        (data || []).forEach((sub) => {
          initialMap[sub.id] = {
            score: sub.score !== undefined && sub.score !== null ? String(sub.score) : '',
            feedback: sub.feedback || '',
            isSaving: false,
          };
        });
        setGradingState(initialMap);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error(extractApiError(err));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, assessment]);

  const handleGradeChange = (
    submissionId: string,
    field: 'score' | 'feedback',
    value: string,
  ) => {
    setGradingState((prev) => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [field]: value,
      },
    }));
  };

  const handleSaveGrade = async (submission: AssessmentSubmission) => {
    const currentState = gradingState[submission.id];
    if (!currentState) return;

    const numericScore = parseFloat(currentState.score);
    if (isNaN(numericScore) || numericScore < 0) {
      toast.error('Please enter a valid non-negative numeric score');
      return;
    }

    const maxAllowed = submission.maxScore ?? assessment?.maxScore ?? 100;
    if (numericScore > maxAllowed) {
      toast.error(`Score cannot exceed maximum score of ${maxAllowed}`);
      return;
    }

    setGradingState((prev) => ({
      ...prev,
      [submission.id]: { ...prev[submission.id], isSaving: true },
    }));

    try {
      const updated = await gradeSubmission(submission.id, {
        score: numericScore,
        feedback: currentState.feedback.trim() || undefined,
      });

      setSubmissions((prev) =>
        prev.map((item) => (item.id === submission.id ? { ...item, ...updated } : item)),
      );

      toast.success(`Grade saved for ${submission.studentName}`);
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setGradingState((prev) => ({
        ...prev,
        [submission.id]: { ...prev[submission.id], isSaving: false },
      }));
    }
  };

  if (!assessment) return null;

  const isMcq = assessment.type === 'MCQ';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2">
              {isMcq ? (
                <HelpCircle className="h-5 w-5 text-brand-primary" />
              ) : (
                <FileText className="h-5 w-5 text-brand-primary" />
              )}
              Submissions: {assessment.title}
            </DialogTitle>
            <Badge variant={isMcq ? 'info' : 'default'}>
              {isMcq ? 'Auto-Scored MCQ' : 'File Upload'}
            </Badge>
          </div>
          <DialogDescription>
            {assessment.description || 'View student submissions and grade performance.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-[250px] flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            <p className="text-sm font-medium text-ink-600">Loading submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface-variant/40 p-6 text-center">
            <FileText className="h-10 w-10 text-ink-300" />
            <p className="mt-2 text-sm font-semibold text-ink-800">No submissions yet</p>
            <p className="text-xs text-ink-500">
              Students have not submitted any responses for this assessment.
            </p>
          </div>
        ) : isMcq ? (
          /* MCQ Submissions Table */
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Breakdown</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => {
                  const score = sub.autoScore ?? sub.score ?? 0;
                  const total = sub.totalPoints ?? sub.maxScore ?? 100;
                  const percent = sub.percentage ?? (total > 0 ? Math.round((score / total) * 100) : 0);
                  const correct = sub.correctCount ?? 0;
                  const incorrect = sub.incorrectCount ?? 0;

                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium text-ink-900">
                        <div>
                          <p>{sub.studentName}</p>
                          {sub.studentEmail && (
                            <p className="text-xs text-ink-400">{sub.studentEmail}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-ink-600">
                        {formatDateTime(sub.submittedAt)}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-ink-900">
                          {score} / {total}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            percent >= 80
                              ? 'success'
                              : percent >= 50
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {percent}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-success font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {correct} correct
                          </span>
                          <span className="flex items-center gap-1 text-danger font-medium">
                            <XCircle className="h-3.5 w-3.5" />
                            {incorrect} incorrect
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMcqSubmission(sub)}
                        >
                          View Breakdown
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* MCQ Breakdown Detail Dialog */}
            {selectedMcqSubmission && (
              <Dialog
                open={Boolean(selectedMcqSubmission)}
                onOpenChange={(open) => !open && setSelectedMcqSubmission(null)}
              >
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Question Breakdown — {selectedMcqSubmission.studentName}</DialogTitle>
                    <DialogDescription>
                      Detailed question-by-question response breakdown.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    {selectedMcqSubmission.breakdown && selectedMcqSubmission.breakdown.length > 0 ? (
                      selectedMcqSubmission.breakdown.map((item, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg border p-4 space-y-2 ${
                            item.isCorrect
                              ? 'border-success/30 bg-success/5'
                              : 'border-danger/30 bg-danger/5'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-ink-500">
                              Question {idx + 1}
                            </span>
                            <Badge variant={item.isCorrect ? 'success' : 'danger'}>
                              {item.isCorrect ? `+${item.pointsEarned} pts` : `0 / ${item.maxPoints} pts`}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-ink-900">{item.prompt}</p>
                          <div className="space-y-1 text-xs">
                            {item.options.map((opt, oIdx) => {
                              const isSelected = item.selectedOptionIndex === oIdx;
                              const isCorrectOption = item.correctOptionIndex === oIdx;
                              return (
                                <div
                                  key={oIdx}
                                  className={`flex items-center justify-between rounded px-2.5 py-1.5 ${
                                    isCorrectOption
                                      ? 'bg-success/20 font-medium text-success'
                                      : isSelected
                                      ? 'bg-danger/20 font-medium text-danger'
                                      : 'bg-white text-ink-600'
                                  }`}
                                >
                                  <span>
                                    {opt} {isSelected && '(Selected)'}
                                  </span>
                                  {isCorrectOption && (
                                    <span className="text-[10px] uppercase font-bold text-success">
                                      Correct Answer
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-ink-500 italic text-center py-4">
                        Detailed breakdown is not available for this submission.
                      </p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        ) : (
          /* File Upload Submissions List & Manual Grading Form */
          <div className="space-y-6">
            {submissions.map((sub) => {
              const state = gradingState[sub.id] || { score: '', feedback: '', isSaving: false };
              const maxScore = sub.maxScore ?? assessment.maxScore ?? 100;
              const isGraded = Boolean(sub.gradedAt || (sub.score !== null && sub.score !== undefined));

              return (
                <div
                  key={sub.id}
                  className="rounded-xl border border-line bg-white p-5 shadow-card space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-ink-900">{sub.studentName}</h4>
                        <Badge variant={isGraded ? 'success' : 'warning'}>
                          {isGraded ? 'Graded' : 'Needs Grading'}
                        </Badge>
                      </div>
                      {sub.studentEmail && (
                        <p className="text-xs text-ink-500">{sub.studentEmail}</p>
                      )}
                      <p className="mt-1 text-xs text-ink-400">
                        Submitted: {formatDateTime(sub.submittedAt)}
                      </p>
                    </div>

                    {sub.fileUrl && (
                      <Button asChild variant="outline" size="sm">
                        <a href={sub.fileUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          View Submitted File
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* Manual Grading Form */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor={`score-${sub.id}`}>Score (out of {maxScore}) *</Label>
                      <Input
                        id={`score-${sub.id}`}
                        type="number"
                        min={0}
                        max={maxScore}
                        placeholder={`0 - ${maxScore}`}
                        value={state.score}
                        onChange={(e) => handleGradeChange(sub.id, 'score', e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`feedback-${sub.id}`}>Feedback / Remarks</Label>
                      <Textarea
                        id={`feedback-${sub.id}`}
                        placeholder="Add comments or constructive feedback for the student..."
                        value={state.feedback}
                        onChange={(e) => handleGradeChange(sub.id, 'feedback', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSaveGrade(sub)}
                      disabled={state.isSaving}
                    >
                      {state.isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Grade
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
