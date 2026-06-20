import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// `findBy*` / `waitFor` default to a 1000ms timeout, which is too tight when the
// full suite runs many component files in parallel under load (async UI can
// render just after the deadline). Give async assertions generous headroom — a
// passing assertion still resolves as soon as the element appears, so this only
// affects genuinely-slow/failing cases.
configure({ asyncUtilTimeout: 5000 });
