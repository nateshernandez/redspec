// tsup loads `.css` imports with esbuild's `text` loader, so a stylesheet
// arrives as its own source. See src/styles.tsx.
declare module "*.css" {
  const css: string
  export default css
}
