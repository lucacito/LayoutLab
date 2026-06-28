// tests/jsdom-setup.ts
// Make window.location configurable so vi.spyOn(window.location, 'assign') works in jsdom.
// jsdom sets location as non-configurable by default; we replace it with a plain object
// that mirrors the real interface but allows property redefinition for spy/mock use.
// Guard: only runs in jsdom environments where `window` is defined.
if (typeof window !== 'undefined') {
  const { href } = window.location;
  delete (window as any).location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      assign: (url: string) => { (window as any).location.href = url; },
      replace: (url: string) => { (window as any).location.href = url; },
      reload: () => {},
      href,
      origin: 'http://localhost',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      port: '',
      pathname: '/',
      search: '',
      hash: '',
    },
  });
}
