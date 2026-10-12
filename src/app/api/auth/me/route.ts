import { route } from '@/lib/api';
import { getSession } from '@/lib/auth';

export const GET = route(async () => {
  return { user: await getSession() };
});
