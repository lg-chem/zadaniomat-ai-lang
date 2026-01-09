-- ==================== ENUMS ====================
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "WorkspaceType" AS ENUM ('WORK', 'PRIVATE');
CREATE TYPE "TaskStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'TO_TRANSFER');
CREATE TYPE "HabitFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "ChallengeType" AS ENUM ('NUMERIC', 'WEEKLY_HABIT', 'MONTHLY_GOAL', 'DAILY_GOAL');
CREATE TYPE "LinkedDataType" AS ENUM ('NONE', 'STEPS', 'SPORT', 'HABIT');
CREATE TYPE "GroupChallengeMemberRole" AS ENUM ('CREATOR', 'MEMBER');
CREATE TYPE "GroupChallengeInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TYPE "AIConversationType" AS ENUM ('MORNING_ROUTINE', 'PLANNING', 'RETROSPECTIVE', 'GENERAL', 'BACKLOG_DISCUSSION');
CREATE TYPE "KnowledgeVisibility" AS ENUM ('PRIVATE', 'TEAM');
CREATE TYPE "FitnessGoalType" AS ENUM ('WEIGHT_LOSS', 'WEIGHT_GAIN', 'MUSCLE_GAIN', 'CARDIO_IMPROVEMENT', 'STRENGTH_INCREASE', 'FLEXIBILITY', 'ENDURANCE', 'BODY_FAT_REDUCTION', 'CUSTOM');
CREATE TYPE "AdminReportType" AS ENUM ('BUG', 'FEATURE', 'OTHER');
CREATE TYPE "AdminReportStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "NotificationType" AS ENUM ('TASK_DELETED', 'TASK_COMPLETED', 'TASK_ASSIGNED', 'TASK_COMMENT', 'MEMBER_JOINED');

-- ==================== AUTH ====================
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "restrictedToWork" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- ==================== SETTINGS ====================
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultWorkspace" "WorkspaceType" NOT NULL DEFAULT 'WORK',
    "defaultSprintDuration" INTEGER NOT NULL DEFAULT 14,
    "defaultPeriodDuration" INTEGER NOT NULL DEFAULT 90,
    "workDayStart" TEXT NOT NULL DEFAULT '09:00',
    "workDayEnd" TEXT NOT NULL DEFAULT '17:00',
    "taskStatuses" JSONB NOT NULL DEFAULT '["TODO", "IN_PROGRESS", "DONE"]',
    "employeeSidebarConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- ==================== ORGANIZATIONS ====================
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sidebarConfig" JSONB,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");

CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

CREATE TABLE "TeamMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TeamMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeamMessage_organizationId_createdAt_idx" ON "TeamMessage"("organizationId", "createdAt");
CREATE INDEX "TeamMessage_userId_idx" ON "TeamMessage"("userId");

-- ==================== PERIODS & SPRINTS ====================
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "workspaceType" "WorkspaceType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Period_userId_workspaceType_idx" ON "Period"("userId", "workspaceType");

CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "periodId" TEXT NOT NULL,
    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Sprint_periodId_idx" ON "Sprint"("periodId");

CREATE TABLE "Retrospective" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "wentWell" TEXT[],
    "needsImprovement" TEXT[],
    "actionItems" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Retrospective_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Retrospective_sprintId_key" ON "Retrospective"("sprintId");

-- ==================== CATEGORIES ====================
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "isStrategic" BOOLEAN NOT NULL DEFAULT false,
    "workspaceType" "WorkspaceType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_userId_name_workspaceType_key" ON "Category"("userId", "name", "workspaceType");
CREATE INDEX "Category_userId_workspaceType_idx" ON "Category"("userId", "workspaceType");
CREATE INDEX "Category_organizationId_idx" ON "Category"("organizationId");

CREATE TABLE "CategoryOrganization" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "CategoryOrganization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CategoryOrganization_categoryId_organizationId_key" ON "CategoryOrganization"("categoryId", "organizationId");
CREATE INDEX "CategoryOrganization_categoryId_idx" ON "CategoryOrganization"("categoryId");
CREATE INDEX "CategoryOrganization_organizationId_idx" ON "CategoryOrganization"("organizationId");

CREATE TABLE "OrganizationMemberCategory" (
    "id" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "OrganizationMemberCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationMemberCategory_memberId_categoryId_key" ON "OrganizationMemberCategory"("memberId", "categoryId");
CREATE INDEX "OrganizationMemberCategory_memberId_idx" ON "OrganizationMemberCategory"("memberId");
CREATE INDEX "OrganizationMemberCategory_categoryId_idx" ON "OrganizationMemberCategory"("categoryId");

-- ==================== GOALS ====================
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "workspaceType" "WorkspaceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "periodId" TEXT,
    "sprintId" TEXT,
    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Goal_userId_workspaceType_idx" ON "Goal"("userId", "workspaceType");
CREATE INDEX "Goal_periodId_idx" ON "Goal"("periodId");
CREATE INDEX "Goal_sprintId_idx" ON "Goal"("sprintId");

-- ==================== TASKS ====================
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'NEW',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "plannedMinutes" INTEGER,
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "scheduledDate" DATE,
    "scheduledTime" TEXT,
    "orderInDay" INTEGER NOT NULL DEFAULT 0,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "workspaceType" "WorkspaceType" NOT NULL,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "sprintId" TEXT,
    "goalId" TEXT,
    "parentTaskId" TEXT,
    "assignedToId" TEXT,
    "organizationId" TEXT,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Task_userId_workspaceType_idx" ON "Task"("userId", "workspaceType");
CREATE INDEX "Task_scheduledDate_idx" ON "Task"("scheduledDate");
CREATE INDEX "Task_sprintId_idx" ON "Task"("sprintId");
CREATE INDEX "Task_categoryId_idx" ON "Task"("categoryId");
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");
CREATE INDEX "Task_organizationId_idx" ON "Task"("organizationId");

CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");

CREATE TABLE "Subtask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT NOT NULL,
    CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Subtask_taskId_idx" ON "Subtask"("taskId");

CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");
CREATE INDEX "TaskComment_userId_idx" ON "TaskComment"("userId");

-- ==================== HABITS ====================
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "HabitFrequency" NOT NULL DEFAULT 'DAILY',
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "defaultMinutes" INTEGER,
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "icon" TEXT,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");

CREATE TABLE "HabitCompletion" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "minutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "habitId" TEXT NOT NULL,
    CONSTRAINT "HabitCompletion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HabitCompletion_habitId_date_key" ON "HabitCompletion"("habitId", "date");
CREATE INDEX "HabitCompletion_habitId_date_idx" ON "HabitCompletion"("habitId", "date");

-- ==================== CHALLENGES ====================
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "challengeType" "ChallengeType" NOT NULL DEFAULT 'NUMERIC',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "weeklyTarget" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#f59e0b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Challenge_userId_idx" ON "Challenge"("userId");

CREATE TABLE "ChallengeMilestone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "isReached" BOOLEAN NOT NULL DEFAULT false,
    "reachedAt" TIMESTAMP(3),
    "challengeId" TEXT NOT NULL,
    CONSTRAINT "ChallengeMilestone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChallengeMilestone_challengeId_idx" ON "ChallengeMilestone"("challengeId");

CREATE TABLE "ChallengeEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "challengeId" TEXT NOT NULL,
    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChallengeEntry_challengeId_date_idx" ON "ChallengeEntry"("challengeId", "date");

-- ==================== GROUP CHALLENGES ====================
CREATE TABLE "GroupChallenge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "challengeType" "ChallengeType" NOT NULL DEFAULT 'NUMERIC',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "weeklyTarget" INTEGER,
    "dailyTarget" DOUBLE PRECISION,
    "linkedType" "LinkedDataType" NOT NULL DEFAULT 'NONE',
    "linkedHabitId" TEXT,
    "color" TEXT NOT NULL DEFAULT '#8b5cf6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorId" TEXT NOT NULL,
    CONSTRAINT "GroupChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GroupChallenge_creatorId_idx" ON "GroupChallenge"("creatorId");

CREATE TABLE "GroupChallengeMember" (
    "id" TEXT NOT NULL,
    "role" "GroupChallengeMemberRole" NOT NULL DEFAULT 'MEMBER',
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "linkedType" "LinkedDataType" NOT NULL DEFAULT 'NONE',
    "linkedHabitId" TEXT,
    "minSteps" INTEGER,
    "sportActivityType" TEXT,
    "minDuration" INTEGER,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "GroupChallengeMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroupChallengeMember_challengeId_userId_key" ON "GroupChallengeMember"("challengeId", "userId");
CREATE INDEX "GroupChallengeMember_challengeId_idx" ON "GroupChallengeMember"("challengeId");
CREATE INDEX "GroupChallengeMember_userId_idx" ON "GroupChallengeMember"("userId");

CREATE TABLE "GroupChallengeInvitation" (
    "id" TEXT NOT NULL,
    "status" "GroupChallengeInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "GroupChallengeInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroupChallengeInvitation_challengeId_userId_key" ON "GroupChallengeInvitation"("challengeId", "userId");
CREATE INDEX "GroupChallengeInvitation_userId_status_idx" ON "GroupChallengeInvitation"("userId", "status");

CREATE TABLE "GroupChallengeEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stepsCount" INTEGER,
    "duration" INTEGER,
    "activityType" TEXT,
    "habitName" TEXT,
    "memberId" TEXT NOT NULL,
    CONSTRAINT "GroupChallengeEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroupChallengeEntry_memberId_date_key" ON "GroupChallengeEntry"("memberId", "date");
CREATE INDEX "GroupChallengeEntry_memberId_date_idx" ON "GroupChallengeEntry"("memberId", "date");

CREATE TABLE "GroupChallengeMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "GroupChallengeMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GroupChallengeMessage_challengeId_createdAt_idx" ON "GroupChallengeMessage"("challengeId", "createdAt");
CREATE INDEX "GroupChallengeMessage_userId_idx" ON "GroupChallengeMessage"("userId");

-- ==================== GAMIFICATION ====================
CREATE TABLE "Gamification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Gamification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Gamification_userId_key" ON "Gamification"("userId");

CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "condition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Achievement_name_key" ON "Achievement"("name");

CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gamificationId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserAchievement_gamificationId_achievementId_key" ON "UserAchievement"("gamificationId", "achievementId");

CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "xpCost" INTEGER NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserReward" (
    "id" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gamificationId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    CONSTRAINT "UserReward_pkey" PRIMARY KEY ("id")
);

-- ==================== BACKLOG ====================
CREATE TABLE "BacklogItem" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "workspaceType" "WorkspaceType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "BacklogItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BacklogItem_userId_workspaceType_isProcessed_idx" ON "BacklogItem"("userId", "workspaceType", "isProcessed");

-- ==================== AI ====================
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "type" "AIConversationType" NOT NULL,
    "workspaceType" "WorkspaceType" NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIConversation_userId_type_idx" ON "AIConversation"("userId", "type");
CREATE INDEX "AIConversation_expiresAt_idx" ON "AIConversation"("expiresAt");

CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contextSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIMessage_conversationId_idx" ON "AIMessage"("conversationId");

CREATE TABLE "AIKnowledgeBase" (
    "id" TEXT NOT NULL,
    "workspaceType" "WorkspaceType" NOT NULL,
    "personalInfo" TEXT,
    "companyInfo" TEXT,
    "chatInstructions" TEXT,
    "systemPrompts" TEXT,
    "metaPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "AIKnowledgeBase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIKnowledgeBase_userId_workspaceType_key" ON "AIKnowledgeBase"("userId", "workspaceType");
CREATE INDEX "AIKnowledgeBase_userId_idx" ON "AIKnowledgeBase"("userId");

-- ==================== KNOWLEDGE ====================
CREATE TABLE "KnowledgeCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "workspaceType" "WorkspaceType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedCategoryId" TEXT,
    "parentId" TEXT,
    CONSTRAINT "KnowledgeCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KnowledgeCategory_userId_name_workspaceType_key" ON "KnowledgeCategory"("userId", "name", "workspaceType");
CREATE INDEX "KnowledgeCategory_userId_workspaceType_idx" ON "KnowledgeCategory"("userId", "workspaceType");
CREATE INDEX "KnowledgeCategory_parentId_idx" ON "KnowledgeCategory"("parentId");

CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "workspaceType" "WorkspaceType" NOT NULL,
    "visibility" "KnowledgeVisibility" NOT NULL DEFAULT 'PRIVATE',
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KnowledgeEntry_userId_workspaceType_idx" ON "KnowledgeEntry"("userId", "workspaceType");
CREATE INDEX "KnowledgeEntry_categoryId_idx" ON "KnowledgeEntry"("categoryId");
CREATE INDEX "KnowledgeEntry_visibility_idx" ON "KnowledgeEntry"("visibility");

-- ==================== IDEAS ====================
CREATE TABLE "IdeaCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8b5cf6',
    "emoji" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "linkedCategoryId" TEXT,
    CONSTRAINT "IdeaCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IdeaCategory_organizationId_name_key" ON "IdeaCategory"("organizationId", "name");
CREATE UNIQUE INDEX "IdeaCategory_organizationId_linkedCategoryId_key" ON "IdeaCategory"("organizationId", "linkedCategoryId");
CREATE INDEX "IdeaCategory_organizationId_idx" ON "IdeaCategory"("organizationId");
CREATE INDEX "IdeaCategory_linkedCategoryId_idx" ON "IdeaCategory"("linkedCategoryId");

CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Idea_categoryId_idx" ON "Idea"("categoryId");
CREATE INDEX "Idea_userId_idx" ON "Idea"("userId");

CREATE TABLE "IdeaReply" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    CONSTRAINT "IdeaReply_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IdeaReply_ideaId_idx" ON "IdeaReply"("ideaId");
CREATE INDEX "IdeaReply_userId_idx" ON "IdeaReply"("userId");

-- ==================== SPORT ====================
CREATE TABLE "SportActivityType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "hasBodyParts" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "SportActivityType_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SportActivityType_userId_idx" ON "SportActivityType"("userId");

CREATE TABLE "SportActivity" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "duration" INTEGER,
    "notes" TEXT,
    "fromSteps" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    CONSTRAINT "SportActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SportActivity_userId_date_idx" ON "SportActivity"("userId", "date");

CREATE TABLE "SportBodyPart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    CONSTRAINT "SportBodyPart_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SportBodyPart_activityId_idx" ON "SportBodyPart"("activityId");

CREATE TABLE "StepsEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL,
    "notes" TEXT,
    "copiedToActivity" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "StepsEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StepsEntry_userId_date_key" ON "StepsEntry"("userId", "date");
CREATE INDEX "StepsEntry_userId_date_idx" ON "StepsEntry"("userId", "date");

CREATE TABLE "FitnessGoal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "goalType" "FitnessGoalType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "workspaceType" "WorkspaceType" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "periodId" TEXT,
    CONSTRAINT "FitnessGoal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FitnessGoal_userId_workspaceType_idx" ON "FitnessGoal"("userId", "workspaceType");
CREATE INDEX "FitnessGoal_userId_startDate_endDate_idx" ON "FitnessGoal"("userId", "startDate", "endDate");

-- ==================== ADMIN REPORTS ====================
CREATE TABLE "AdminReport" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "AdminReportType" NOT NULL,
    "status" "AdminReportStatus" NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "AdminReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminReport_userId_idx" ON "AdminReport"("userId");
CREATE INDEX "AdminReport_status_idx" ON "AdminReport"("status");
CREATE INDEX "AdminReport_type_idx" ON "AdminReport"("type");

-- ==================== NOTIFICATIONS ====================
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- ==================== SCHEDULE ====================
CREATE TABLE "WeeklyScheduleBlock" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "workspaceType" "WorkspaceType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "WeeklyScheduleBlock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WeeklyScheduleBlock_userId_workspaceType_dayOfWeek_idx" ON "WeeklyScheduleBlock"("userId", "workspaceType", "dayOfWeek");

CREATE TABLE "DailyScheduleOverride" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "workspaceType" "WorkspaceType" NOT NULL,
    "blocks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DailyScheduleOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyScheduleOverride_userId_date_workspaceType_key" ON "DailyScheduleOverride"("userId", "date", "workspaceType");
CREATE INDEX "DailyScheduleOverride_userId_workspaceType_date_idx" ON "DailyScheduleOverride"("userId", "workspaceType", "date");

-- ==================== FOREIGN KEYS ====================
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Period" ADD CONSTRAINT "Period_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Retrospective" ADD CONSTRAINT "Retrospective_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryOrganization" ADD CONSTRAINT "CategoryOrganization_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryOrganization" ADD CONSTRAINT "CategoryOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMemberCategory" ADD CONSTRAINT "OrganizationMemberCategory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMemberCategory" ADD CONSTRAINT "OrganizationMemberCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeMilestone" ADD CONSTRAINT "ChallengeMilestone_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupChallenge" ADD CONSTRAINT "GroupChallenge_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupChallengeMember" ADD CONSTRAINT "GroupChallengeMember_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "GroupChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupChallengeMember" ADD CONSTRAINT "GroupChallengeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupChallengeInvitation" ADD CONSTRAINT "GroupChallengeInvitation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "GroupChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupChallengeInvitation" ADD CONSTRAINT "GroupChallengeInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupChallengeEntry" ADD CONSTRAINT "GroupChallengeEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GroupChallengeMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupChallengeMessage" ADD CONSTRAINT "GroupChallengeMessage_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "GroupChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupChallengeMessage" ADD CONSTRAINT "GroupChallengeMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Gamification" ADD CONSTRAINT "Gamification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_gamificationId_fkey" FOREIGN KEY ("gamificationId") REFERENCES "Gamification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserReward" ADD CONSTRAINT "UserReward_gamificationId_fkey" FOREIGN KEY ("gamificationId") REFERENCES "Gamification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserReward" ADD CONSTRAINT "UserReward_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BacklogItem" ADD CONSTRAINT "BacklogItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIKnowledgeBase" ADD CONSTRAINT "AIKnowledgeBase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeCategory" ADD CONSTRAINT "KnowledgeCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeCategory" ADD CONSTRAINT "KnowledgeCategory_linkedCategoryId_fkey" FOREIGN KEY ("linkedCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeCategory" ADD CONSTRAINT "KnowledgeCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdeaCategory" ADD CONSTRAINT "IdeaCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdeaCategory" ADD CONSTRAINT "IdeaCategory_linkedCategoryId_fkey" FOREIGN KEY ("linkedCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IdeaCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdeaReply" ADD CONSTRAINT "IdeaReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdeaReply" ADD CONSTRAINT "IdeaReply_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportActivityType" ADD CONSTRAINT "SportActivityType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportActivity" ADD CONSTRAINT "SportActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportActivity" ADD CONSTRAINT "SportActivity_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "SportActivityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportBodyPart" ADD CONSTRAINT "SportBodyPart_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "SportActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StepsEntry" ADD CONSTRAINT "StepsEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FitnessGoal" ADD CONSTRAINT "FitnessGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FitnessGoal" ADD CONSTRAINT "FitnessGoal_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminReport" ADD CONSTRAINT "AdminReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyScheduleBlock" ADD CONSTRAINT "WeeklyScheduleBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyScheduleOverride" ADD CONSTRAINT "DailyScheduleOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
