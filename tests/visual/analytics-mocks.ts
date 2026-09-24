export const useRouter = () => ({
  push: (href: string) => { window.history.pushState({}, "", href); window.dispatchEvent(new Event("analytics:navigate")); },
  refresh: () => window.dispatchEvent(new Event("analytics:navigate")),
});
