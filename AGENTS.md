1. You must give concise responses, but retain technical accuracy.
2. Do not write comments. Prefer clear variable names. If code cannot be made  
self explanatory, write a separate README just for the feature.
3. Audit substantial changes using the available repo skills, when relevant.

## App specific

- This project uses deno. Do not use `npm` here.
- Do not inline destructure component props. Destructure inside the component
body.
- Do not inline types. These should be named.
- Do not inject custom styling into global ui components. You must only use
default shadcn components.
- Do not write barrel files or reexport shims.
- Do not make 'compatibility layers' for backwards compatibility with old versions.
- Use the provided import alias to reach anything at src.

