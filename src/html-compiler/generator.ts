import * as fs from 'fs';
import * as path from 'path';
import { HtmlCompiler } from './html-compiler';

export function generateTypes(filePath: string, content: string, rootDir: string) {
	try {
		const compiler = new HtmlCompiler(content);
		const { dts } = compiler.compile();

		const outDir = path.join(rootDir, '.chispa/types');
		const relativePath = path.relative(rootDir, filePath);
		const targetPath = path.join(outDir, relativePath + '.d.ts');
		const targetDir = path.dirname(targetPath);

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}
		fs.writeFileSync(targetPath, dts);
	} catch (e) {
		console.error(`[chispa] Error generating types for ${filePath}`, e);
	}
}

export function findAndCompileHtmlFiles(dir: string, rootDir: string) {
	if (!fs.existsSync(dir)) return;
	const files = fs.readdirSync(dir);
	files.forEach((file) => {
		const fullPath = path.join(dir, file);
		if (fullPath === path.join(rootDir, 'index.html')) return;
		if (fs.statSync(fullPath).isDirectory()) {
			if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== '.chispa') {
				findAndCompileHtmlFiles(fullPath, rootDir);
			}
		} else if (file.endsWith('.html')) {
			console.log('Generating types for', fullPath);
			const content = fs.readFileSync(fullPath, 'utf-8');
			generateTypes(fullPath, content, rootDir);
		}
	});
}
