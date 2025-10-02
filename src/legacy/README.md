# Legacy Prototype Assets

This directory preserves the early prototype components and reference charts that
informed the presentation refactor. The code here is intentionally excluded from the
production TypeScript build (`tsconfig.app.json`) so it can be consulted without
impacting CI or bundling.

- `prototype/timeline/` – Original SVG timeline experiments and scratch files.
- `prototype/charts/` – Miscellaneous exploratory charts and visualizations.
- `prototype/docs/` – Notes captured during workflow design discussions.
- `prototype/workflow/` – Reserved for additional workflow sketches that may be
  archived later.

Feel free to move or delete entries once they are no longer useful. Anything promoted to
production code should live under `src/features/` with tests and story/docs.
