import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { FileText, HelpCircle, Loader2, Plus, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api, extractApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
import {
  createAssessment,
  type AssessmentType,
  type MCQQuestion,
} from '@/services/assessment.api';
import type { AdminLiveSessionRecord, ApiResponse } from '@/types/api';

type LiveSessionMediaAsset = NonNullable<AdminLiveSessionRecord['mediaAssets']>[number];

interface AssessmentCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onSuccess?: () => void;
}

export function AssessmentCreateModal({
  open,
  onOpenChange,
  sessionId,
  onSuccess,
}: AssessmentCreateModalProps) {
  const [activeTab, setActiveTab] = useState<AssessmentType>('FILE_UPLOAD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File Upload Assessment state
  const [fileTitle, setFileTitle] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [maxScore, setMaxScore] = useState<number>(100);
  const [dueDate, setDueDate] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-Scored MCQ Assessment state
  const [mcqTitle, setMcqTitle] = useState('');
  const [mcqDescription, setMcqDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(30);
  const [questions, setQuestions] = useState<MCQQuestion[]>([
    {
      prompt: '',
      points: 1,
      options: ['', '', '', ''],
      correctOptionIndex: 0,
    },
  ]);

  const resetForm = () => {
    setFileTitle('');
    setFileDescription('');
    setMaxScore(100);
    setDueDate('');
    setAttachmentFile(null);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setMcqTitle('');
    setMcqDescription('');
    setTimeLimitMinutes(30);
    setQuestions([
      {
        prompt: '',
        points: 1,
        options: ['', '', '', ''],
        correctOptionIndex: 0,
      },
    ]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSubmitting) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isSubmitting) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setAttachmentFile(droppedFile);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setAttachmentFile(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    if (isSubmitting) return;
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        prompt: '',
        points: 1,
        options: ['', '', '', ''],
        correctOptionIndex: 0,
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast.error('Assessment must have at least one question');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: keyof MCQQuestion, value: unknown) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    );
  };

  const handleOptionChange = (qIndex: number, optIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        return { ...q, options: newOptions };
      }),
    );
  };

  const handleAddOption = (qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ''] } : q)),
    );
  };

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        if (q.options.length <= 2) {
          toast.error('Question must have at least 2 options');
          return q;
        }
        const newOptions = q.options.filter((_, idx) => idx !== optIndex);
        let newCorrect = q.correctOptionIndex;
        if (newCorrect >= newOptions.length) {
          newCorrect = Math.max(0, newOptions.length - 1);
        }
        return { ...q, options: newOptions, correctOptionIndex: newCorrect };
      }),
    );
  };

  const handleSubmitFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileTitle.trim()) {
      toast.error('Please enter assessment title');
      return;
    }

    setIsSubmitting(true);
    try {
      let attachmentAsset: LiveSessionMediaAsset | undefined;
      
      if (attachmentFile) {
        const formData = new FormData();
        formData.append('file', attachmentFile);
        formData.append('kind', 'FILE');
        formData.append('displayFileName', attachmentFile.name);
        formData.append(
          'metadata',
          JSON.stringify({
            category: 'ASSESSMENT_ATTACHMENT',
            source: 'TEACHER_PORTAL',
            originalFileName: attachmentFile.name,
            displayFileName: attachmentFile.name,
          }),
        );
        
        const response = await api.post<ApiResponse<LiveSessionMediaAsset>>(
          `/live-sessions/${sessionId}/media`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        attachmentAsset = response.data.data;
      }

      await createAssessment({
        liveSessionId: sessionId,
        title: fileTitle.trim(),
        description: fileDescription.trim() || undefined,
        type: 'FILE_UPLOAD',
        maxScore: maxScore > 0 ? maxScore : 100,
        dueDate: dueDate || undefined,
        settings: attachmentAsset ? { attachmentAsset } : {},
      });

      toast.success('File Upload Assessment created successfully');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitMCQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcqTitle.trim()) {
      toast.error('Please enter assessment title');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt.trim()) {
        toast.error(`Question ${i + 1} prompt is required`);
        return;
      }
      if (q.options.some((opt) => !opt.trim())) {
        toast.error(`All options for Question ${i + 1} must be filled out`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await createAssessment({
        liveSessionId: sessionId,
        title: mcqTitle.trim(),
        description: mcqDescription.trim() || undefined,
        type: 'MCQ',
        timeLimitMinutes: timeLimitMinutes > 0 ? timeLimitMinutes : undefined,
        questions: questions.map((q) => ({
          prompt: q.prompt.trim(),
          points: q.points || 1,
          options: q.options.map((o) => o.trim()),
          correctOptionIndex: q.correctOptionIndex,
        })),
      });

      toast.success('MCQ Assessment created successfully');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Assessment</DialogTitle>
          <DialogDescription>
            Attach a new assessment to this live session for student completion and grading.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as AssessmentType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="FILE_UPLOAD" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              File Upload Assessment
            </TabsTrigger>
            <TabsTrigger value="MCQ" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Auto-Scored MCQ
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: File Upload Assessment */}
          <TabsContent value="FILE_UPLOAD">
            <form onSubmit={handleSubmitFileUpload} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="file-title">Title *</Label>
                <Input
                  id="file-title"
                  placeholder="e.g. Homework Assignment 1"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="file-desc">Description / Instructions</Label>
                <Textarea
                  id="file-desc"
                  placeholder="Provide detailed instructions or submission requirements..."
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="file-attachment">Attachment (Optional)</Label>

                <input
                  ref={fileInputRef}
                  id="file-attachment"
                  type="file"
                  className="hidden"
                  disabled={isSubmitting}
                  onChange={handleFileSelect}
                />

                {!attachmentFile ? (
                  <div
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-white p-6 text-center transition',
                      isDragging
                        ? 'border-brand-primary bg-brand-primary/5 ring-4 ring-brand-primary/10'
                        : 'border-line hover:border-brand-primary/50 hover:bg-brand-primary/[0.025]',
                      isSubmitting && 'cursor-not-allowed opacity-70'
                    )}
                    onClick={() => {
                      if (!isSubmitting) fileInputRef.current?.click();
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary shadow-sm">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-ink-900">
                      Click to upload or drag & drop file
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      Provide an optional file (e.g. PDF instructions) for students.
                    </p>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex items-center justify-between rounded-xl border border-line bg-surface-variant/40 p-3.5 shadow-sm',
                      isSubmitting && 'opacity-80'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                        {isSubmitting ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {attachmentFile.name}
                        </p>
                        <p className="text-xs text-ink-500">
                          {isSubmitting ? 'Uploading file...' : formatBytes(attachmentFile.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSubmitting}
                      className="h-8 w-8 p-0 text-ink-400 hover:text-danger hover:bg-danger/10"
                      onClick={handleRemoveFile}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="max-score">Maximum Score (Points)</Label>
                  <Input
                    id="max-score"
                    type="number"
                    min={1}
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="due-date">Due Date & Time</Label>
                  <Input
                    id="due-date"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create File Assessment'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Tab 2: Auto-Scored MCQ Assessment */}
          <TabsContent value="MCQ">
            <form onSubmit={handleSubmitMCQ} className="space-y-6 pt-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="mcq-title">Title *</Label>
                  <Input
                    id="mcq-title"
                    placeholder="e.g. Mid-term Multiple Choice Quiz"
                    value={mcqTitle}
                    onChange={(e) => setMcqTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="time-limit">Time Limit (Minutes)</Label>
                  <Input
                    id="time-limit"
                    type="number"
                    min={1}
                    placeholder="e.g. 30"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mcq-desc">Description / Guidelines</Label>
                <Textarea
                  id="mcq-desc"
                  placeholder="Instructions for quiz takers..."
                  value={mcqDescription}
                  onChange={(e) => setMcqDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Questions list */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <h4 className="text-sm font-bold text-ink-900">Questions ({questions.length})</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddQuestion}
                  >
                    <Plus className="h-4 w-4" />
                    Add Question
                  </Button>
                </div>

                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="rounded-lg border border-line bg-surface-variant/40 p-4 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                        Question {qIdx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:text-danger hover:bg-danger/10 h-8 px-2"
                        onClick={() => handleRemoveQuestion(qIdx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                      <div className="space-y-1.5 sm:col-span-3">
                        <Label>Question Prompt *</Label>
                        <Input
                          placeholder="Enter question text..."
                          value={q.prompt}
                          onChange={(e) => handleQuestionChange(qIdx, 'prompt', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Points</Label>
                        <Input
                          type="number"
                          min={1}
                          value={q.points}
                          onChange={(e) =>
                            handleQuestionChange(qIdx, 'points', Number(e.target.value))
                          }
                        />
                      </div>
                    </div>

                    {/* Options list */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-ink-600">
                        Options (Select radio for correct answer)
                      </Label>
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-opt-${qIdx}`}
                            checked={q.correctOptionIndex === optIdx}
                            onChange={() => handleQuestionChange(qIdx, 'correctOptionIndex', optIdx)}
                            className="h-4 w-4 text-brand-primary border-line focus:ring-brand-primary"
                          />
                          <Input
                            placeholder={`Option ${optIdx + 1}`}
                            value={opt}
                            onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                            className="flex-1"
                          />
                          {q.options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 text-ink-400 hover:text-danger"
                              onClick={() => handleRemoveOption(qIdx, optIdx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1 text-xs text-brand-primary"
                        onClick={() => handleAddOption(qIdx)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Option
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create MCQ Assessment'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
