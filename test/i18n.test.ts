/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { transformWithOxc } from 'vite';
import * as chispa from '../src';
import { component, computed, lang, mountRoot, registerTranslations, resetTranslations, signal, t, translate, i18nText, i18nAttr } from '../src';
import { ChispaDebugConfig } from '../src/config';
import { HtmlCompiler } from '../src/html-compiler/html-compiler';

const tick = () => vi.runOnlyPendingTimersAsync();

/** Compiles a template and evaluates the generated module against the local runtime. */
async function loadTemplate(html: string): Promise<any> {
	const { ts } = await new HtmlCompiler(html).compile();
	const { code } = await transformWithOxc(ts, 'template.ts');
	const body = code
		.replace(/import\s*\{([^}]*)\}\s*from\s*['"]chispa['"];?/g, (_, names) => `const {${names}} = chispa;`)
		.replace(/export\s+default\s+template;?/, 'return template;');
	return new Function('chispa', body)(chispa);
}

function mountPoint() {
	const el = document.createElement('div');
	document.body.appendChild(el);
	return el;
}

describe('i18n', () => {
	const defaults = { ...ChispaDebugConfig };

	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
		resetTranslations();
		lang.set('es');
	});

	afterEach(() => {
		Object.assign(ChispaDebugConfig, defaults);
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe('lang', () => {
		it('starts as the lang of <html>, or "en" when it is empty (as in jsdom)', () => {
			expect(lang.initialValue).toBe('en');
		});
	});

	describe('registerTranslations() / translate()', () => {
		it('falls back to the key when the language has no catalog', () => {
			expect(translate('Guardar')).toBe('Guardar');
		});

		it('translates with the catalog of the current language', () => {
			registerTranslations('en', { Guardar: 'Save' });
			registerTranslations('fr', { Guardar: 'Enregistrer' });

			lang.set('en');
			expect(translate('Guardar')).toBe('Save');
			lang.set('fr');
			expect(translate('Guardar')).toBe('Enregistrer');
			lang.set('es');
			expect(translate('Guardar')).toBe('Guardar');
		});

		it('flattens nested objects into dotted keys and keeps literal keys with dots', () => {
			registerTranslations('en', { home: { title: 'Home', actions: { save: 'Save' } }, 'Buscar...': 'Search...' });
			lang.set('en');

			expect(translate('home.title')).toBe('Home');
			expect(translate('home.actions.save')).toBe('Save');
			expect(translate('Buscar...')).toBe('Search...');
		});

		it('extends the catalog on a second registration, overwriting repeated keys', () => {
			registerTranslations('en', { a: 'A', b: 'B' });
			registerTranslations('en', { b: 'B2', c: 'C' });
			lang.set('en');

			expect(translate('a')).toBe('A');
			expect(translate('b')).toBe('B2');
			expect(translate('c')).toBe('C');
		});

		it('treats an empty translation as missing', () => {
			registerTranslations('en', { Guardar: '' });
			lang.set('en');
			expect(translate('Guardar')).toBe('Guardar');
		});

		it('fills {name} placeholders from values, signals and functions, leaving unknown ones as they are', () => {
			registerTranslations('en', { greeting: 'Hello, {name}! You have {count} {what}.' });
			lang.set('en');
			const count = signal(3);

			expect(translate('greeting', { name: 'Ana', count, what: () => (count.get() === 1 ? 'item' : 'items') })).toBe('Hello, Ana! You have 3 items.');
			expect(translate('greeting', { name: 'Ana' })).toBe('Hello, Ana! You have {count} {what}.');
		});

		it('is tracked like any signal read inside a computed', async () => {
			registerTranslations('en', { Guardar: 'Save' });
			const label = computed(() => translate('Guardar').toUpperCase());
			expect(label.get()).toBe('GUARDAR');

			lang.set('en');
			await tick();
			expect(label.get()).toBe('SAVE');
		});
	});

	describe('t()', () => {
		it('returns a signal that follows the language', async () => {
			registerTranslations('en', { Guardar: 'Save' });
			const label = t('Guardar');
			expect(label.get()).toBe('Guardar');

			lang.set('en');
			await tick();
			expect(label.get()).toBe('Save');
		});

		it('refreshes when a catalog is registered later (e.g. after a dynamic import)', async () => {
			lang.set('en');
			const label = t('Guardar');
			expect(label.get()).toBe('Guardar');

			registerTranslations('en', { Guardar: 'Save' });
			await tick();
			expect(label.get()).toBe('Save');
		});

		it('refreshes when a signal passed as param changes', async () => {
			registerTranslations('en', { items: '{count} items' });
			lang.set('en');
			const count = signal(1);
			const label = t('items', { count });
			expect(label.get()).toBe('1 items');

			count.set(5);
			await tick();
			expect(label.get()).toBe('5 items');
		});

		it('can be created in a component factory and bound like any signal', async () => {
			registerTranslations('en', { Guardar: 'Save' });
			const Btn = component(() => {
				const button = document.createElement('button');
				chispa.appendChild(button, t('Guardar'));
				return button;
			});
			const root = mountPoint();
			mountRoot(Btn(), root);
			expect(root.textContent).toBe('Guardar');

			lang.set('en');
			await tick();
			expect(root.textContent).toBe('Save');
		});
	});

	describe('missing translation warnings', () => {
		it('warns once per key and language when the catalog of the language lacks it, if enabled', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			registerTranslations('en', { Guardar: 'Save', Cancelar: '' });
			lang.set('en');

			translate('Borrar');
			expect(warn).not.toHaveBeenCalled(); // off by default

			ChispaDebugConfig.enableMissingTranslationWarnings = true;
			translate('Guardar');
			expect(warn).not.toHaveBeenCalled();

			translate('Borrar');
			translate('Borrar');
			translate('Cancelar');
			expect(warn).toHaveBeenCalledTimes(2);
			expect(warn.mock.calls[0][0]).toContain("'Borrar'");
			expect(warn.mock.calls[0][0]).toContain("'en'");
			expect(warn.mock.calls[1][0]).toContain("'Cancelar'");
		});

		it('does not warn for a language without catalog (the source language)', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			ChispaDebugConfig.enableMissingTranslationWarnings = true;

			translate('Guardar');
			expect(warn).not.toHaveBeenCalled();
		});
	});

	describe('template helpers', () => {
		it('i18nText keeps the surrounding whitespace around the translated text', async () => {
			registerTranslations('en', { Hola: 'Hello' });
			const node = i18nText('Hola', 'Hola', '', ' ');
			expect(node.data).toBe('Hola ');

			lang.set('en');
			await tick();
			expect(node.data).toBe('Hello ');
		});

		it('i18nText shows the source text of an explicit key until a translation is registered', async () => {
			const node = i18nText('home.title', 'Inicio');
			expect(node.data).toBe('Inicio');

			registerTranslations('es', { home: { title: 'Portada' } });
			await tick();
			expect(node.data).toBe('Portada');
		});

		it('i18nAttr keeps the attribute translated', async () => {
			registerTranslations('en', { 'Buscar...': 'Search...' });
			const input = document.createElement('input');
			i18nAttr(input, 'placeholder', 'Buscar...');
			expect(input.placeholder).toBe('Buscar...');

			lang.set('en');
			await tick();
			expect(input.placeholder).toBe('Search...');
		});
	});

	describe('compiled templates (end to end)', () => {
		it('translates marked text and attributes reactively, and a TS binding wins over the translation', async () => {
			const tpl = await loadTemplate(`
				<h1 data-i18n="home.title">Inicio</h1>
				<p data-i18n>El valor es <span data-cb="value">0</span>.</p>
				<p data-i18n-0 data-i18n-1>Hola <b>mundo</b> adiós</p>
				<input data-cb="search" placeholder="Buscar..." data-i18n-placeholder />
				<input data-cb="other" title="Ayuda" data-i18n-title />
				<button data-cb="btn" data-i18n>Guardar</button>
				<button data-cb="fixed" data-i18n>Guardar</button>
			`);
			registerTranslations('en', {
				home: { title: 'Home' },
				'El valor es': 'The value is',
				Hola: 'Hello',
				adiós: 'goodbye',
				'Buscar...': 'Search...',
				Ayuda: 'Help',
				Guardar: 'Save',
			});
			const App = component(() => tpl.fragment({ value: { inner: 1 }, search: {}, other: { title: 'Fixed' }, btn: {}, fixed: { inner: 'Fixed' } }));
			const root = mountPoint();
			mountRoot(App(), root);
			const h1 = root.querySelector('h1')!;
			const [p1, p2] = Array.from(root.querySelectorAll('p'));
			const [search, other] = Array.from(root.querySelectorAll('input'));
			const [btn, fixed] = Array.from(root.querySelectorAll('button'));

			expect(h1.textContent).toBe('Inicio');
			expect(p1.textContent).toBe('El valor es 1.');
			expect(p2.textContent).toBe('Hola mundo adiós');
			expect(search.placeholder).toBe('Buscar...');
			expect(other.title).toBe('Fixed');
			expect(btn.textContent).toBe('Guardar');
			expect(fixed.textContent).toBe('Fixed');
			expect(root.innerHTML).not.toContain('data-i18n');

			lang.set('en');
			await tick();

			expect(h1.textContent).toBe('Home');
			expect(p1.textContent).toBe('The value is 1.');
			expect(p2.innerHTML).toBe('Hello <b>mundo</b> goodbye');
			expect(search.placeholder).toBe('Search...');
			expect(other.title).toBe('Fixed'); // bound from TS: the language switch does not overwrite it
			expect(btn.textContent).toBe('Save');
			expect(fixed.textContent).toBe('Fixed');
		});

		it('disposes the translation reactivities with the component', async () => {
			const tpl = await loadTemplate(`<h1 data-i18n>Inicio</h1>`);
			registerTranslations('en', { Inicio: 'Home' });
			const App = component(() => tpl.fragment({}));
			const root = mountPoint();
			const app = mountRoot(App(), root);
			const h1 = root.querySelector('h1')!;

			app.unmount();
			lang.set('en');
			await tick();
			expect(h1.textContent).toBe('Inicio');
		});
	});
});
