import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileText,
  HelpCircle,
  Home,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api, extractApiError } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import { classroomApi } from '@/services/classroom.api';
import {
  createAssessment,
  type AssessmentType,
  type MCQQuestion,
} from '@/services/assessment.api';
import type { AdminLiveSessionRecord, ApiResponse } from '@/types/api';

type LiveSessionMediaAsset = NonNullable<AdminLiveSessionRecord['mediaAssets']>[number];

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function AssessmentCreatePage() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const query = useQuery({
    queryKey: ['live-session-assessment-create', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('Live session id is required');
      return classroomApi.liveSessionDetail(sessionId);
    },
    enabled: Boolean(sessionId),
  });

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
        if (optIndex < q.correctOptionIndex) {
          newCorrect = q.correctOptionIndex - 1;
        } else if (optIndex === q.correctOptionIndex) {
          newCorrect = Math.min(optIndex, newOptions.length - 1);
        }
        return { ...q, options: newOptions, correctOptionIndex: newCorrect };
      }),
    );
  };

  const handleSubmitFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
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
      queryClient.invalidateQueries({ queryKey: ['assessments-session', sessionId] });
      navigate(`/teacher/sessions/${sessionId}`);
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitMCQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
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
        questions: questions.map((q, qIdx) => ({
          order: qIdx,
          type: 'SINGLE_CHOICE',
          prompt: q.prompt.trim(),
          points: q.points || 1,
          options: q.options.map((o, optIdx) => ({
            id: `opt_${optIdx + 1}`,
            text: o.trim(),
            isCorrect: q.correctOptionIndex === optIdx,
          })),
        })),
      });

      toast.success('MCQ Assessment created successfully');
      queryClient.invalidateQueries({ queryKey: ['assessments-session', sessionId] });
      navigate(`/teacher/sessions/${sessionId}`);
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (query.isLoading) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-primary" />
      </div>
    );
  }

  if (!query.data || query.isError) {
    return (
      <Card className="space-y-3 px-5 py-6">
        <p className="font-semibold text-ink-900">Assessment creation is unavailable.</p>
        <p className="text-sm text-ink-500">
          {query.error ? extractApiError(query.error) : 'The session may be outside your teacher scope.'}
        </p>
        <Button variant="outline" onClick={() => navigate('/teacher/sessions')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to sessions
        </Button>
      </Card>
    );
  }

  const session = query.data;
  const totalMcqPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);

  return (
    <div className="space-y-4 pb-6">
      {/* Top Breadcrumbs */}
      <nav className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
        <Link to="/teacher/dashboard" className="inline-flex items-center gap-1 hover:text-brand-primary">
          <Home className="h-4 w-4" />
          Teacher
        </Link>
        <ChevronRight className="h-4 w-4 text-ink-300" />
        <Link to="/teacher/sessions" className="hover:text-brand-primary">
          Sessions
        </Link>
        <ChevronRight className="h-4 w-4 text-ink-300" />
        <Link to={`/teacher/sessions/${session.id}`} className="max-w-[220px] truncate hover:text-brand-primary">
          {session.title ?? session.canvas?.name ?? 'Live Session'}
        </Link>
        <ChevronRight className="h-4 w-4 text-ink-300" />
        <span className="font-semibold text-ink-800">Create assessment</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigate(`/teacher/sessions/${session.id}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-ink-900">Create Assessment</h2>
              <p className="truncate text-sm text-ink-500">
                {session.canvas?.name ?? session.title ?? 'Live Session'} - {session.organization?.name ?? 'No organization'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase text-ink-400">Session Status</p>
            <p className="text-sm font-bold text-ink-900">{session.status}</p>
          </div>
          <div className="rounded-lg border border-line bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase text-ink-400">Join Code</p>
            <p className="font-mono text-sm font-bold text-ink-900">{session.joinCode ?? 'None'}</p>
          </div>
          <div className="rounded-lg border border-line bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase text-ink-400">Assessment Type</p>
            <p className="text-sm font-bold text-ink-900">
              {activeTab === 'FILE_UPLOAD' ? 'File Upload' : 'Auto-Scored MCQ'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Split Workspace */}
      <Card className="grid min-w-0 overflow-hidden p-0 border-line lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* Left Form Panel */}
        <div className="flex flex-col border-b border-line lg:border-b-0 lg:border-r">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as AssessmentType)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-line bg-surface-variant/50 p-1">
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
            <TabsContent value="FILE_UPLOAD" className="p-6 space-y-5">
              <form id="file-assessment-form" onSubmit={handleSubmitFileUpload} className="space-y-4">
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
              </form>
            </TabsContent>

            {/* Tab 2: Auto-Scored MCQ Assessment */}
            <TabsContent value="MCQ" className="p-6 space-y-6">
              <form id="mcq-assessment-form" onSubmit={handleSubmitMCQ} className="space-y-6">
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

                {/* Questions Builder */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <h4 className="text-sm font-bold text-ink-900">Questions ({questions.length})</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddQuestion}
                    >
                      <Plus className="h-4 w-4 mr-1" />
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
              </form>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Interactive Preview & Action Panel */}
        <div className="flex flex-col justify-between bg-surface-variant/20">
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink-900">Live Assessment Preview</h3>
                <p className="text-xs text-ink-500">Real-time breakdown of your assessment structure</p>
              </div>
              <Badge variant="info" className="font-semibold">
                {activeTab === 'FILE_UPLOAD' ? 'File Assignment' : 'Interactive Quiz'}
              </Badge>
            </div>

            {activeTab === 'FILE_UPLOAD' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-line bg-white p-5 space-y-4 shadow-sm">
                  <div>
                    <span className="text-xs font-semibold uppercase text-ink-400">Title</span>
                    <h4 className="text-lg font-bold text-ink-900 mt-0.5">
                      {fileTitle.trim() || 'Untitled File Assessment'}
                    </h4>
                  </div>

                  <div>
                    <span className="text-xs font-semibold uppercase text-ink-400">Description</span>
                    <p className="text-sm text-ink-700 mt-1 whitespace-pre-wrap">
                      {fileDescription.trim() || 'No instructions provided.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
                    <div>
                      <span className="text-xs font-semibold uppercase text-ink-400">Max Points</span>
                      <p className="text-sm font-bold text-brand-primary">{maxScore > 0 ? maxScore : 100} pts</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase text-ink-400">Due Date</span>
                      <p className="text-sm font-medium text-ink-800">
                        {dueDate ? formatDateTime(dueDate) : 'No due date set'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line">
                    <span className="text-xs font-semibold uppercase text-ink-400">Attachment</span>
                    {attachmentFile ? (
                      <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-surface-variant/50 p-3">
                        <FileText className="h-5 w-5 text-brand-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink-900">{attachmentFile.name}</p>
                          <p className="text-[11px] text-ink-500">{formatBytes(attachmentFile.size)}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-ink-500 mt-1">No file attached</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-line bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-ink-400">Questions</p>
                    <p className="text-base font-bold text-ink-900">{questions.length}</p>
                  </div>
                  <div className="rounded-lg border border-line bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-ink-400">Total Points</p>
                    <p className="text-base font-bold text-brand-primary">{totalMcqPoints}</p>
                  </div>
                  <div className="rounded-lg border border-line bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-ink-400">Time Limit</p>
                    <p className="text-base font-bold text-ink-900">{timeLimitMinutes > 0 ? `${timeLimitMinutes} min` : 'None'}</p>
                  </div>
                </div>

                {/* MCQ Questions Preview List */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400">
                    {mcqTitle.trim() || 'Untitled MCQ Quiz'}
                  </h4>
                  {mcqDescription.trim() && (
                    <p className="text-xs text-ink-600 italic bg-white p-2.5 rounded border border-line">
                      {mcqDescription}
                    </p>
                  )}

                  {questions.map((q, idx) => (
                    <div key={idx} className="rounded-lg border border-line bg-white p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink-900">
                          Q{idx + 1}. {q.prompt.trim() || <span className="text-ink-400 italic">Prompt pending...</span>}
                        </span>
                        <Badge variant="default" className="text-[10px]">
                          {q.points || 1} pt{(q.points || 1) > 1 ? 's' : ''}
                        </Badge>
                      </div>

                      <div className="grid gap-1.5 pl-2">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = q.correctOptionIndex === optIdx;
                          return (
                            <div
                              key={optIdx}
                              className={cn(
                                'flex items-center justify-between rounded px-2.5 py-1.5 border',
                                isCorrect
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold'
                                  : 'border-line bg-surface-variant/30 text-ink-700'
                              )}
                            >
                              <span>
                                {String.fromCharCode(65 + optIdx)}. {opt.trim() || <span className="text-ink-400 italic">Option {optIdx + 1}</span>}
                              </span>
                              {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="border-t border-line bg-white p-4 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-ink-500 truncate">
              {activeTab === 'FILE_UPLOAD'
                ? attachmentFile ? 'File attached' : 'No attachment file'
                : `${questions.length} question(s) configured`}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => navigate(`/teacher/sessions/${sessionId}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form={activeTab === 'FILE_UPLOAD' ? 'file-assessment-form' : 'mcq-assessment-form'}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Creating...
                  </>
                ) : activeTab === 'FILE_UPLOAD' ? (
                  'Create File Assessment'
                ) : (
                  'Create MCQ Assessment'
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
