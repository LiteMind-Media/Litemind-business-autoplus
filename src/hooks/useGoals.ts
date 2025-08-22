import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function useGoals() {
  const goals = useQuery(api.goals.getGoals, {});
  const setGoals = useMutation(api.goals.setGoals);
  return { goals, setGoals } as const;
}
