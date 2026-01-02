import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RecentFriend {
  id: string
  name: string
  image: string | null
}

interface RecentFriendsState {
  recentFriends: RecentFriend[]
  addRecentFriend: (friend: RecentFriend) => void
}

export const useRecentFriendsStore = create<RecentFriendsState>()(
  persist(
    (set) => ({
      recentFriends: [],
      addRecentFriend: (friend) =>
        set((state) => {
          // Remove if already exists, add to front, keep max 3
          const filtered = state.recentFriends.filter((f) => f.id !== friend.id)
          return {
            recentFriends: [friend, ...filtered].slice(0, 3),
          }
        }),
    }),
    {
      name: 'zadaniomat-recent-friends',
    }
  )
)
