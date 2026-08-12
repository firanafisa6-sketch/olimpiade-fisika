-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'REJECTED', 'NEEDS_ALIGNMENT_REVIEW');
CREATE TYPE "StimulusType" AS ENUM ('TEXT', 'IMAGE', 'TABLE', 'AUDIO', 'TEXT_IMAGE', 'TEXT_TABLE', 'TEXT_AUDIO', 'MIXED');
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "OptionLabel" AS ENUM ('A', 'B', 'C', 'D', 'E');
CREATE TYPE "ReviewDecisionType" AS ENUM ('APPROVE', 'REQUEST_REVISION', 'REJECT', 'EDIT_AND_FORWARD');
CREATE TYPE "AssetType" AS ENUM ('IMAGE', 'AUDIO', 'DOCUMENT');
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'QUEUED', 'PARSING', 'VALIDATING', 'WAITING_CONFIRMATION', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ValidationTaskStatus" AS ENUM ('ASSIGNED', 'IN_REVIEW', 'DONE', 'CANCELLED');
CREATE TYPE "AttemptStatus" AS ENUM ('NOT_STARTED', 'ACTIVE', 'SUBMITTED', 'EXPIRED', 'TERMINATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId", "roleId")
);
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);
CREATE TABLE "SelectionPeriod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SelectionPeriod_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Blueprint" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Blueprint_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BlueprintVersion" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "titleHtml" TEXT NOT NULL,
    "testGroupHtml" TEXT,
    "testTopicHtml" TEXT,
    "competencyHtml" TEXT NOT NULL,
    "indicatorHtml" TEXT NOT NULL,
    "materialHtml" TEXT,
    "gridHtml" TEXT,
    "confidentialLabel" TEXT NOT NULL DEFAULT 'SANGAT RAHASIA',
    "cognitiveLevel" TEXT,
    "expectedQuestionCount" INTEGER NOT NULL DEFAULT 1,
    "changeSummaryHtml" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlueprintVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Stimulus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "StimulusType" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'id',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Stimulus_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StimulusVersion" (
    "id" TEXT NOT NULL,
    "stimulusId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "titleHtml" TEXT NOT NULL,
    "instructionsHtml" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "contentJson" JSONB,
    "source" TEXT,
    "copyrightNote" TEXT,
    "expectedQuestions" INTEGER,
    "changeSummaryHtml" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StimulusVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "stimulusId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "QuestionVersion" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "blueprintVersionId" TEXT NOT NULL,
    "stimulusVersionId" TEXT,
    "orderInStimulus" INTEGER,
    "stemHtml" TEXT NOT NULL,
    "stemJson" JSONB,
    "explanationHtml" TEXT,
    "explanationJson" JSONB,
    "difficulty" "Difficulty" NOT NULL,
    "answerKey" "OptionLabel" NOT NULL,
    "keyChanged" BOOLEAN NOT NULL DEFAULT false,
    "changeSummaryHtml" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "label" "OptionLabel" NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "contentJson" JSONB,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "checksum" TEXT NOT NULL,
    "altText" TEXT,
    "caption" TEXT,
    "source" TEXT,
    "copyrightNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StimulusAsset" (
    "stimulusVersionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'BODY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StimulusAsset_pkey" PRIMARY KEY ("stimulusVersionId", "assetId")
);
CREATE TABLE "QuestionAsset" (
    "questionVersionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'STEM',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuestionAsset_pkey" PRIMARY KEY ("questionVersionId", "assetId")
);
CREATE TABLE "OptionAsset" (
    "questionOptionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OptionAsset_pkey" PRIMARY KEY ("questionOptionId", "assetId")
);
CREATE TABLE "QuestionWritingAssignment" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT,
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "noteHtml" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuestionWritingAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "QuestionValidationAssignment" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT,
    "noteHtml" TEXT,
    "status" "ValidationTaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuestionValidationAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReviewWorkflow" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewWorkflow_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReviewStage" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "approvalsRequired" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ReviewStage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReviewAssignment" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "blueprintVersionId" TEXT,
    "stimulusVersionId" TEXT,
    "questionVersionId" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecisionType" NOT NULL,
    "notesHtml" TEXT NOT NULL,
    "changedFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityCode" TEXT,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "messages" JSONB,
    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ExamPackage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "durationMinutes" INTEGER NOT NULL,
    "shuffleBlocks" BOOLEAN NOT NULL DEFAULT false,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExamPackage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ExamPackageQuestion" (
    "id" TEXT NOT NULL,
    "examPackageId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamPackageQuestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PublishedStimulus" (
    "id" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "titleHtml" TEXT NOT NULL,
    "instructionsHtml" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "contentJson" JSONB,
    "checksum" TEXT NOT NULL,
    CONSTRAINT "PublishedStimulus_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PublishedQuestion" (
    "id" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "publishedStimulusId" TEXT,
    "orderInStimulus" INTEGER,
    "stemHtml" TEXT NOT NULL,
    "stemJson" JSONB,
    "answerKey" "OptionLabel" NOT NULL,
    "checksum" TEXT NOT NULL,
    CONSTRAINT "PublishedQuestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PublishedOption" (
    "id" TEXT NOT NULL,
    "publishedQuestionId" TEXT NOT NULL,
    "label" "OptionLabel" NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "contentJson" JSONB,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "PublishedOption_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ExamPackageItem" (
    "id" TEXT NOT NULL,
    "examPackageId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "publishedStimulusId" TEXT,
    "publishedQuestionId" TEXT,
    "startNumber" INTEGER,
    "endNumber" INTEGER,
    "keepTogether" BOOLEAN NOT NULL DEFAULT true,
    "shuffleInside" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ExamPackageItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ExamSession" (
    "id" TEXT NOT NULL,
    "examPackageId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "examSessionId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "lastSavedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ParticipantAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "publishedQuestionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParticipantAnswer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "wrongCount" INTEGER NOT NULL,
    "unansweredCount" INTEGER NOT NULL,
    "rawScore" DECIMAL(10,2) NOT NULL,
    "finalScore" DECIMAL(10,2) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");
CREATE UNIQUE INDEX "SelectionPeriod_code_key" ON "SelectionPeriod"("code");
CREATE UNIQUE INDEX "Blueprint_code_key" ON "Blueprint"("code");
CREATE UNIQUE INDEX "Blueprint_currentVersionId_key" ON "Blueprint"("currentVersionId");
CREATE UNIQUE INDEX "BlueprintVersion_blueprintId_versionNumber_key" ON "BlueprintVersion"("blueprintId", "versionNumber");
CREATE UNIQUE INDEX "Stimulus_code_key" ON "Stimulus"("code");
CREATE UNIQUE INDEX "Stimulus_currentVersionId_key" ON "Stimulus"("currentVersionId");
CREATE UNIQUE INDEX "StimulusVersion_stimulusId_versionNumber_key" ON "StimulusVersion"("stimulusId", "versionNumber");
CREATE UNIQUE INDEX "Question_code_key" ON "Question"("code");
CREATE UNIQUE INDEX "Question_currentVersionId_key" ON "Question"("currentVersionId");
CREATE UNIQUE INDEX "QuestionVersion_questionId_versionNumber_key" ON "QuestionVersion"("questionId", "versionNumber");
CREATE INDEX "QuestionVersion_stimulusVersionId_orderInStimulus_idx" ON "QuestionVersion"("stimulusVersionId", "orderInStimulus");
CREATE UNIQUE INDEX "QuestionOption_questionVersionId_label_key" ON "QuestionOption"("questionVersionId", "label");
CREATE UNIQUE INDEX "Asset_storagePath_key" ON "Asset"("storagePath");
CREATE UNIQUE INDEX "QuestionWritingAssignment_blueprintId_assignedToId_key" ON "QuestionWritingAssignment"("blueprintId", "assignedToId");
CREATE INDEX "QuestionWritingAssignment_assignedToId_idx" ON "QuestionWritingAssignment"("assignedToId");
CREATE INDEX "QuestionWritingAssignment_status_idx" ON "QuestionWritingAssignment"("status");
CREATE UNIQUE INDEX "QuestionValidationAssignment_questionId_assignedToId_key" ON "QuestionValidationAssignment"("questionId", "assignedToId");
CREATE INDEX "QuestionValidationAssignment_assignedToId_idx" ON "QuestionValidationAssignment"("assignedToId");
CREATE INDEX "QuestionValidationAssignment_status_idx" ON "QuestionValidationAssignment"("status");
CREATE UNIQUE INDEX "ReviewWorkflow_code_key" ON "ReviewWorkflow"("code");
CREATE UNIQUE INDEX "ReviewStage_workflowId_orderNumber_key" ON "ReviewStage"("workflowId", "orderNumber");
CREATE UNIQUE INDEX "ExamPackage_code_key" ON "ExamPackage"("code");
CREATE UNIQUE INDEX "ExamPackageQuestion_examPackageId_questionId_key" ON "ExamPackageQuestion"("examPackageId", "questionId");
CREATE INDEX "ExamPackageQuestion_questionId_idx" ON "ExamPackageQuestion"("questionId");
CREATE UNIQUE INDEX "PublishedOption_publishedQuestionId_label_key" ON "PublishedOption"("publishedQuestionId", "label");
CREATE UNIQUE INDEX "ExamPackageItem_examPackageId_sortOrder_key" ON "ExamPackageItem"("examPackageId", "sortOrder");
CREATE UNIQUE INDEX "Participant_externalId_key" ON "Participant"("externalId");
CREATE UNIQUE INDEX "ExamSession_examPackageId_participantId_key" ON "ExamSession"("examPackageId", "participantId");
CREATE UNIQUE INDEX "Attempt_examSessionId_key" ON "Attempt"("examSessionId");
CREATE UNIQUE INDEX "ParticipantAnswer_attemptId_publishedQuestionId_key" ON "ParticipantAnswer"("attemptId", "publishedQuestionId");
CREATE UNIQUE INDEX "Score_attemptId_key" ON "Score"("attemptId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Blueprint" ADD CONSTRAINT "Blueprint_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SelectionPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Blueprint" ADD CONSTRAINT "Blueprint_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "BlueprintVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BlueprintVersion" ADD CONSTRAINT "BlueprintVersion_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "Blueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlueprintVersion" ADD CONSTRAINT "BlueprintVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Stimulus" ADD CONSTRAINT "Stimulus_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "StimulusVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StimulusVersion" ADD CONSTRAINT "StimulusVersion_stimulusId_fkey" FOREIGN KEY ("stimulusId") REFERENCES "Stimulus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StimulusVersion" ADD CONSTRAINT "StimulusVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "Blueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_stimulusId_fkey" FOREIGN KEY ("stimulusId") REFERENCES "Stimulus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_blueprintVersionId_fkey" FOREIGN KEY ("blueprintVersionId") REFERENCES "BlueprintVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_stimulusVersionId_fkey" FOREIGN KEY ("stimulusVersionId") REFERENCES "StimulusVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StimulusAsset" ADD CONSTRAINT "StimulusAsset_stimulusVersionId_fkey" FOREIGN KEY ("stimulusVersionId") REFERENCES "StimulusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StimulusAsset" ADD CONSTRAINT "StimulusAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionAsset" ADD CONSTRAINT "QuestionAsset_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionAsset" ADD CONSTRAINT "QuestionAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OptionAsset" ADD CONSTRAINT "OptionAsset_questionOptionId_fkey" FOREIGN KEY ("questionOptionId") REFERENCES "QuestionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptionAsset" ADD CONSTRAINT "OptionAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionWritingAssignment" ADD CONSTRAINT "QuestionWritingAssignment_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "Blueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionWritingAssignment" ADD CONSTRAINT "QuestionWritingAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionWritingAssignment" ADD CONSTRAINT "QuestionWritingAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuestionValidationAssignment" ADD CONSTRAINT "QuestionValidationAssignment_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionValidationAssignment" ADD CONSTRAINT "QuestionValidationAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionValidationAssignment" ADD CONSTRAINT "QuestionValidationAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewStage" ADD CONSTRAINT "ReviewStage_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ReviewWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ReviewStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_blueprintVersionId_fkey" FOREIGN KEY ("blueprintVersionId") REFERENCES "BlueprintVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_stimulusVersionId_fkey" FOREIGN KEY ("stimulusVersionId") REFERENCES "StimulusVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ReviewAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamPackage" ADD CONSTRAINT "ExamPackage_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SelectionPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamPackageQuestion" ADD CONSTRAINT "ExamPackageQuestion_examPackageId_fkey" FOREIGN KEY ("examPackageId") REFERENCES "ExamPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamPackageQuestion" ADD CONSTRAINT "ExamPackageQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublishedQuestion" ADD CONSTRAINT "PublishedQuestion_publishedStimulusId_fkey" FOREIGN KEY ("publishedStimulusId") REFERENCES "PublishedStimulus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishedOption" ADD CONSTRAINT "PublishedOption_publishedQuestionId_fkey" FOREIGN KEY ("publishedQuestionId") REFERENCES "PublishedQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamPackageItem" ADD CONSTRAINT "ExamPackageItem_examPackageId_fkey" FOREIGN KEY ("examPackageId") REFERENCES "ExamPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamPackageItem" ADD CONSTRAINT "ExamPackageItem_publishedStimulusId_fkey" FOREIGN KEY ("publishedStimulusId") REFERENCES "PublishedStimulus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamPackageItem" ADD CONSTRAINT "ExamPackageItem_publishedQuestionId_fkey" FOREIGN KEY ("publishedQuestionId") REFERENCES "PublishedQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_examPackageId_fkey" FOREIGN KEY ("examPackageId") REFERENCES "ExamPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES "ExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParticipantAnswer" ADD CONSTRAINT "ParticipantAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParticipantAnswer" ADD CONSTRAINT "ParticipantAnswer_publishedQuestionId_fkey" FOREIGN KEY ("publishedQuestionId") REFERENCES "PublishedQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParticipantAnswer" ADD CONSTRAINT "ParticipantAnswer_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "PublishedOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Score" ADD CONSTRAINT "Score_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
