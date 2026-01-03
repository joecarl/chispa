import { HtmlCompiler } from './html-compiler';
import { generateTypes, findAndCompileHtmlFiles } from './generator';
import * as fs from 'fs';

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
		handleHotUpdate(ctx: { file: string; read: () => string | Promise<string> }) {
			if (ctx.file.endsWith('.html')) {
				Promise.resolve(ctx.read()).then((content) => generateTypes(ctx.file, content, rootDir));
			}
		},
		async resolveId(source: string, importer: string, options: any) {
			if (source.endsWith('.html') && importer) {
				const resolution = await this.resolve(source, importer, { skipSelf: true, ...options });
				if (resolution && !resolution.external) {
					return resolution.id + '.chispa.ts';
				}
			}
			return null;
		},
		load(id: string) {
			if (id.endsWith('.html.chispa.ts')) {
				const realId = id.replace('.chispa.ts', '');
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
