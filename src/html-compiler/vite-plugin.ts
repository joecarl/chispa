import { HtmlCompiler } from './html-compiler';
import { generateTypes, findAndCompileHtmlFiles, isExcluded } from './generator';
import { type Plugin, transformWithOxc } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Convierte una ruta real de archivo en el ID de módulo virtual que usa Vite/Rollup.
 * Añade el prefijo `\0` para marcar el módulo como virtual y el sufijo
 * `.chispa.ts` para que sea tratado como módulo TypeScript.
 *
 * El ID se construye con la ruta relativa al root (con `/` como separador): Rollup
 * convierte los IDs de los módulos virtuales en nombres de fichero cuando se compila
 * una librería con `preserveModules`, y una ruta absoluta acabaría metiendo la ruta
 * de la máquina dentro de `dist`.
 */
export const toVirtualId = (file: string, rootDir: string) => '\0' + path.relative(rootDir, file).split(path.sep).join('/') + '.chispa.ts';

/**
 * Convierte un ID de módulo virtual de vuelta a la ruta real (absoluta) del archivo.
 * Elimina el prefijo `\0` (si existe) y el sufijo `.chispa.ts`.
 */
export const fromVirtualId = (id: string, rootDir: string) => path.resolve(rootDir, id.replace(/^\0/, '').replace(/\.chispa\.ts$/, ''));

const CHISPA_VIRTUAL_MODULE_SUFFIX = '.html.chispa.ts';

export interface ChispaHtmlPluginOptions {
	/**
	 * Paths, relative to the Vite root, whose `.html` files are not compiled into
	 * `.chispa/types` when the project is scanned (directories or single files, e.g.
	 * `['public', 'docs/legacy.html']`). `node_modules`, `.git`, `dist` and `.chispa`
	 * are always skipped. An excluded file can still be imported from TypeScript: it is
	 * then compiled on demand like any other.
	 */
	exclude?: string[];
}

export function chispaHtmlPlugin(options: ChispaHtmlPluginOptions = {}): Plugin {
	let rootDir = process.cwd();
	const exclude = options.exclude ?? [];

	return {
		name: 'chispa-html',
		enforce: 'pre',
		configResolved(config) {
			rootDir = config.root;
		},
		async buildStart() {
			await findAndCompileHtmlFiles(rootDir, rootDir, exclude);
		},
		async handleHotUpdate(ctx) {
			if (ctx.file.endsWith('.html')) {
				if (!isExcluded(ctx.file, rootDir, exclude)) {
					const content = await ctx.read();
					await generateTypes(ctx.file, content, rootDir);
				}

				// Buscamos el módulo virtual asociado al archivo HTML modificado.
				const module = ctx.server.moduleGraph.getModuleById(toVirtualId(ctx.file, rootDir));
				if (module) {
					return [module];
				}
			}
		},
		async resolveId(source, importer, options) {
			if (source.endsWith(CHISPA_VIRTUAL_MODULE_SUFFIX)) {
				return source;
			}
			if (source.endsWith('.html') && importer) {
				const resolution = await this.resolve(source, importer, { skipSelf: true, ...options });
				if (resolution && !resolution.external) {
					return toVirtualId(resolution.id, rootDir);
				}
			}
			return null;
		},
		async load(id) {
			if (!id.endsWith(CHISPA_VIRTUAL_MODULE_SUFFIX)) return null;

			const realId = fromVirtualId(id, rootDir);
			this.addWatchFile(realId); // To ensure changes in the HTML file trigger a rebuild in watch mode.
			try {
				const content = fs.readFileSync(realId, 'utf-8');
				if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
					return 'export default {};';
				}

				const compiler = new HtmlCompiler(content);
				const { ts } = await compiler.compile();
				await generateTypes(realId, content, rootDir);

				const result = await transformWithOxc(ts, realId + '.ts');
				return result.code;
			} catch (e) {
				console.error(`[chispa] Error loading ${id}:`, e);
				throw e;
			}
		},
	};
}
