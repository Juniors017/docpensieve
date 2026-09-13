/**
 * docpensieve — implementations of the commands.
 *
 * The binary (`bin/docpensieve.js`) only parses arguments: the logic lives
 * here, to stay testable without spawning a subprocess.
 *
 * @module docpensieve
 */

export { build } from './commands/build.js';
export { check, verifyLinks, verifyMarkup } from './commands/check.js';
export { dev } from './commands/dev.js';
export { init } from './commands/init.js';
export { serve } from './commands/serve.js';
export { createStaticServer, listen, resolveRequestPath } from './server.js';
