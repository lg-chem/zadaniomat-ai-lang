import useSWR from 'swr'

interface GroupChallengeEntry {
  id: string
  date: string
  value: number
  notes?: string
}

interface GroupChallengeMember {
  id: string
  role: 'CREATOR' | 'MEMBER'
  currentValue: number
  isCompleted: boolean
  joinedAt: string
  user: {
    id: string
    name: string | null
    image: string | null
  }
  entries: GroupChallengeEntry[]
}

interface GroupChallengeInvitation {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  createdAt: string
  user: {
    id: string
    name: string | null
    image: string | null
  }
}

export type LinkedDataType = 'NONE' | 'STEPS' | 'SPORT' | 'HABIT'

export interface GroupChallenge {
  id: string
  name: string
  description?: string
  challengeType: 'NUMERIC' | 'WEEKLY_HABIT' | 'MONTHLY_GOAL' | 'DAILY_GOAL'
  startDate: string
  endDate: string
  targetValue: number
  unit: string
  weeklyTarget?: number
  dailyTarget?: number
  linkedType: LinkedDataType
  linkedHabitId?: string
  color: string
  isActive: boolean
  createdAt: string
  creator: {
    id: string
    name: string | null
    image: string | null
  }
  members: GroupChallengeMember[]
  invitations?: GroupChallengeInvitation[]
  _count: {
    members: number
    invitations: number
  }
  userMembership: {
    id: string
    role: 'CREATOR' | 'MEMBER'
    currentValue: number
    isCompleted: boolean
    entries: GroupChallengeEntry[]
  } | null
  isCreator: boolean
}

export interface PendingInvitation {
  id: string
  status: 'PENDING'
  createdAt: string
  challenge: {
    id: string
    name: string
    description?: string
    challengeType: 'NUMERIC' | 'WEEKLY_HABIT' | 'MONTHLY_GOAL' | 'DAILY_GOAL'
    startDate: string
    endDate: string
    targetValue: number
    unit: string
    weeklyTarget?: number
    dailyTarget?: number
    linkedType: LinkedDataType
    color: string
    creator: {
      id: string
      name: string | null
      image: string | null
    }
    _count: {
      members: number
    }
  }
}

export function useGroupChallenges() {
  const { data, error, isLoading, mutate } = useSWR<GroupChallenge[]>(
    '/api/group-challenges'
  )

  return {
    groupChallenges: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}

export function useGroupChallenge(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<GroupChallenge>(
    id ? `/api/group-challenges/${id}` : null
  )

  return {
    challenge: data,
    isLoading,
    isError: error,
    mutate,
  }
}

export function useGroupChallengeInvitations() {
  const { data, error, isLoading, mutate } = useSWR<PendingInvitation[]>(
    '/api/group-challenges/invitations'
  )

  return {
    invitations: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
