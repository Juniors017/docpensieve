/**
 * DocPensieve error hierarchy.
 *
 * Every domain error extends `DocPensieveError`: that is how the CLI tells an
 * expected error (a clear message for the user) from a bug (full stack trace).
 *
 * @module @docpensieve/shared/errors
 */

/** Expected domain error — the CLI prints it without a stack trace. */
export class DocPensieveError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown, hint?: string }} [options] `hint` is printed
   *   by the CLI as a suggested fix.
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.hint = options.hint;
  }
}

/** Configuration missing, unreadable or invalid. */
export class ConfigError extends DocPensieveError {}

/** A source file could not be read or parsed. */
export class LoaderError extends DocPensieveError {}

/** MDX/Markdown compilation failed. */
export class CompileError extends DocPensieveError {}

/** Invalid `jsonld` frontmatter or inconsistent structured data. */
export class StructuredDataError extends DocPensieveError {}

/** Theme provider missing, invalid, or whose compilation failed. */
export class ThemeError extends DocPensieveError {}

/** The site could not be generated or written. */
export class GeneratorError extends DocPensieveError {}

/** Milestone not implemented yet — points to the roadmap section. */
export class NotImplementedError extends DocPensieveError {
  /**
   * @param {string} what What is not implemented.
   * @param {string} roadmapSection E.g. `'1.1 DocLoader'`.
   */
  constructor(what, roadmapSection) {
    super(`${what} is not available yet.`, {
      hint: `Planned in section ${roadmapSection} of the roadmap.`,
    });
    this.roadmapSection = roadmapSection;
  }
}
