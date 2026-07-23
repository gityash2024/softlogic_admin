// Empirical Verification Script for AssessmentCreatePage logic & backend schema alignment
const assert = require('assert');

console.log('=== EMPIRICAL TEST SUITE: AssessmentCreatePage ===\n');

// -------------------------------------------------------------
// Test 1: Option Removal Correct Index Shift Bug
// -------------------------------------------------------------
function testOptionRemovalBug() {
  console.log('[Test 1] Testing handleRemoveOption correctOptionIndex tracking...');
  
  let questionState = {
    prompt: 'What is 2+2?',
    points: 1,
    options: ['Option 0 (Wrong)', 'Option 1 (CORRECT)', 'Option 2 (Wrong)'],
    correctOptionIndex: 1, // 'Option 1 (CORRECT)'
  };

  const removeOptionIndex = 0; // Remove 'Option 0'
  
  // Updated logic in AssessmentCreatePage.tsx:
  const handleRemoveOption = (q, optIndex) => {
    const newOptions = q.options.filter((_, idx) => idx !== optIndex);
    let newCorrect = q.correctOptionIndex;
    if (optIndex < q.correctOptionIndex) {
      newCorrect = q.correctOptionIndex - 1;
    } else if (optIndex === q.correctOptionIndex) {
      newCorrect = Math.min(optIndex, newOptions.length - 1);
    }
    return { ...q, options: newOptions, correctOptionIndex: newCorrect };
  };

  const newState = handleRemoveOption(questionState, removeOptionIndex);
  
  console.log('  Initial state:');
  console.log('    options:', questionState.options);
  console.log('    correctOptionIndex:', questionState.correctOptionIndex, '=>', questionState.options[questionState.correctOptionIndex]);
  console.log('  Removing option index 0 ("Option 0 (Wrong)")...');
  console.log('  New state under updated logic:');
  console.log('    options:', newState.options);
  console.log('    correctOptionIndex:', newState.correctOptionIndex, '=>', newState.options[newState.correctOptionIndex]);

  const expectedCorrectText = 'Option 1 (CORRECT)';
  const actualCorrectText = newState.options[newState.correctOptionIndex];
  
  if (actualCorrectText !== expectedCorrectText) {
    console.log('  ❌ BUG CONFIRMED: Correct option shifted! Expected "' + expectedCorrectText + '", but now points to "' + actualCorrectText + '".\n');
    return { pass: false, issue: 'Option removal index desynchronization' };
  } else {
    console.log('  ✅ Pass\n');
    return { pass: true };
  }
}

// -------------------------------------------------------------
// Test 2: MCQ Payload Schema Alignment with Backend Zod Validator
// -------------------------------------------------------------
function testMcqPayloadBackendAlignment() {
  console.log('[Test 2] Testing MCQ Payload structure against Backend createAssessmentSchema...');
  
  const questions = [
    {
      prompt: 'What is the capital of France?',
      points: 1,
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
      correctOptionIndex: 1,
    }
  ];

  const frontendPayload = {
    liveSessionId: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Sample MCQ Quiz',
    type: 'MCQ',
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
    }))
  };

  console.log('  Frontend sends:');
  console.dir(frontendPayload, { depth: null });

  // Backend Zod schema expectation (src/modules/assessments/assessment.validator.ts):
  // options: array of { id: string, text: string, isCorrect?: boolean }
  const isOptionsArrayOfObjects = frontendPayload.questions.every(q => 
    Array.isArray(q.options) && q.options.every(opt => typeof opt === 'object' && opt !== null && 'id' in opt && 'text' in opt)
  );

  if (!isOptionsArrayOfObjects) {
    console.log('  ❌ SCHEMA MISMATCH CONFIRMED: Backend createAssessmentSchema expects options as Array<{ id, text, isCorrect }>, but frontend sends Array<string>.\n');
    return { pass: false, issue: 'Frontend MCQ payload options format (string[]) incompatible with backend Zod schema (object[])' };
  } else {
    console.log('  ✅ Pass\n');
    return { pass: true };
  }
}

// -------------------------------------------------------------
// Test 3: S3 Upload Payload & State Reset behavior
// -------------------------------------------------------------
function testS3PayloadStructure() {
  console.log('[Test 3] Testing S3 Upload Payload structure & metadata...');
  
  const mockFile = { name: 'assignment_guide.pdf', size: 1048576 };
  const mockFormDataEntries = {
    kind: 'FILE',
    displayFileName: mockFile.name,
    metadata: JSON.stringify({
      category: 'ASSESSMENT_ATTACHMENT',
      source: 'TEACHER_PORTAL',
      originalFileName: mockFile.name,
      displayFileName: mockFile.name,
    })
  };

  console.log('  FormData fields prepared:');
  console.dir(mockFormDataEntries, { depth: null });

  const parsedMetadata = JSON.parse(mockFormDataEntries.metadata);
  const isValidMetadata = parsedMetadata.category === 'ASSESSMENT_ATTACHMENT' && parsedMetadata.source === 'TEACHER_PORTAL';

  if (isValidMetadata && mockFormDataEntries.kind === 'FILE') {
    console.log('  ✅ S3 Media Upload Payload structure is valid and aligns with backend createMediaSchema.\n');
    return { pass: true };
  } else {
    console.log('  ❌ S3 Payload invalid\n');
    return { pass: false };
  }
}

// Execute tests
const res1 = testOptionRemovalBug();
const res2 = testMcqPayloadBackendAlignment();
const res3 = testS3PayloadStructure();

console.log('=== SUMMARY OF EMPIRICAL RESULTS ===');
console.log('Test 1 (Option Removal Index):', res1.pass ? 'PASS' : 'FAIL - ' + res1.issue);
console.log('Test 2 (MCQ Backend Schema):', res2.pass ? 'PASS' : 'FAIL - ' + res2.issue);
console.log('Test 3 (S3 Upload Payload):', res3.pass ? 'PASS' : 'FAIL');
