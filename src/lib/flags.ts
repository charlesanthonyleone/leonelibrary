// Feature flags, set at build time. Accounts stay off until the API server is decided (see DECISIONS-NEEDED.md).
export const FLAGS = {
  accounts: import.meta.env.VITE_ACCOUNTS === '1',
  credits: import.meta.env.VITE_CREDITS === '1',
};
export const API = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://api.leoneuniversity.org';
