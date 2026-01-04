import { HtmlCompiler } from './html-compiler';
import { generateTypes, findAndCompileHtmlFiles } from './generator';
import { type Plugin, transformWithEsbuild } from 'vite';
import * as fs from 'fs';

/**
 * Convierte una ruta real de archivo en el ID de módulo virtual que usa Vite/Rollup.
 * Añade el prefijo `\0` para marcar el módulo como virtual y el sufijo
 * `.chispa.ts` para que sea tratado como módulo TypeScript.
 */
const toVirtualId = (id: string) => '\0' + id + '.chispa.ts';

/**
 * Convierte un ID de módulo virtual de vuelta a la ruta real del archivo.
 * Elimina el prefijo `\0` (si existe) y el sufijo `.chispa.ts`.
 */
const fromVirtualId = (id: string) => id.replace(/^\0/, '').replace('.chispa.ts', '');

export function chispaHtmlPlugin(): Plugin {
	let rootDir = process.cwd();

	return {
		name: 'chispa-html',
		enforce: 'pre',
		configResolved(config) {
			rootDir = config.root;
		},
		buildStart() {
			findAndCompileHtmlFiles(rootDir, rootDir);
		},
		async handleHotUpdate(ctx) {
			if (ctx.file.endsWith('.html')) {
				const content = await ctx.read();
				generateTypes(ctx.file, content, rootDir);

				// Buscamos el módulo virtual asociado al archivo HTML modificado.
				const module = ctx.server.moduleGraph.getModuleById(toVirtualId(ctx.file));
				if (module) {
					return [module];
				}
			}
		},
		async resolveId(source, importer, options) {
			if (source.endsWith('.html.chispa.ts')) {
				return source;
			}
			if (source.endsWith('.html') && importer) {
				const resolution = await this.resolve(source, importer, { skipSelf: true, ...options });
				if (resolution && !resolution.external) {
					return toVirtualId(resolution.id);
				}
			}
			return null;
		},
		async load(id) {
			if (id.endsWith('.html.chispa.ts')) {
				const realId = fromVirtualId(id);
				try {
					const content = fs.readFileSync(realId, 'utf-8');
					if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
						return 'export default {};';
					}

					const compiler = new HtmlCompiler(content);
					const { js } = compiler.compile();
					generateTypes(realId, content, rootDir);

					const result = await transformWithEsbuild(js, realId, {
						loader: 'ts',
					});
					return result.code;
				} catch (e) {
					console.error(`[chispa] Error loading ${id}:`, e);
					throw e;
				}
			}
		},
	};
}
