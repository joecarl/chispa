import { HtmlCompiler } from './html-compiler';
import { generateTypes, findAndCompileHtmlFiles } from './generator';
import * as fs from 'fs';

// Convención de Rollup/Vite: Los módulos virtuales deben prefijarse con '\0'.
// Esto evita que otros plugins o el sistema de archivos intenten resolverlo como un archivo real.
// Añadimos .chispa.ts para que sea tratado como un módulo TypeScript.
const toVirtualId = (id: string) => /*'\0' +*/ id + '.chispa.ts';

// Eliminamos el prefijo '\0' y la extensión virtual para obtener la ruta real del archivo HTML.
const fromVirtualId = (id: string) => id.replace(/^\0/, '').replace('.chispa.ts', '');

export function chispaHtmlPlugin() {
	let rootDir = process.cwd();

	return {
		name: 'chispa-html',
		enforce: 'pre' as 'pre',
		configResolved(config: any) {
			rootDir = config.root;
		},
		buildStart() {
			findAndCompileHtmlFiles(rootDir, rootDir);
		},
		async handleHotUpdate(ctx: { file: string; server: any; read: () => string | Promise<string>; modules: any[] }) {
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
		async resolveId(source: string, importer: string, options: any) {
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
		load(id: string) {
			if (id.endsWith('.html.chispa.ts')) {
				const realId = fromVirtualId(id);
				try {
					const content = fs.readFileSync(realId, 'utf-8');
					if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
						return null;
					}

					const compiler = new HtmlCompiler(content);
					const { js } = compiler.compile();
					generateTypes(realId, content, rootDir);
					return js;
				} catch (e) {
					return null;
				}
			}
		},
	};
}
