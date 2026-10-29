import type { ChispaReactive } from './builder';
import { ChispaDebugConfig } from './config';
import { globalContext } from './context';
import { computed, isSignal, signal, type Signal } from './signals';

/**
 * The messages of one language. A value is the translated string; a nested object
 * groups keys, whose names are joined with dots when the catalog is registered
 * (`{ home: { title: 'Home' } }` registers `home.title`). A key that itself contains
 * dots, typically a source text used as key (`'Buscar...'`), is kept literally.
 */
export type TranslationCatalog = { [key: string]: string | TranslationCatalog };

/** Values for the `{name}` placeholders of a message: plain values, signals or functions. */
export type TranslationParams = Record<string, ChispaReactive<string | number>>;

/**
 * The current language. Starts as the `lang` attribute of `<html>`, or `'en'` when it is
 * empty or there is no document. Write to it to switch language: every `t()` signal and
 * every translated template text or attribute is updated on the next tick.
 */
export const lang = /* @__PURE__ */ signal<string>(/* @__PURE__ */ initialLang());

// Reading `document` is a side effect for a bundler, so it goes behind a pure call of its own
function initialLang(): string {
	return typeof document !== 'undefined' && document.documentElement.lang ? document.documentElement.lang : 'en';
}

// (The @__PURE__ annotations let a bundle that never imports the translation API drop the module.)
// Flattened catalogs by language. They live outside the signal so that registering from
// a component factory (where signals cannot be read) works; `catalogsVersion` is what the
// reactivities subscribe to.
const catalogs = new Map<string, Map<string, string>>();
const catalogsVersion = /* @__PURE__ */ signal(0);
const warnedMissing = new Set<string>();

function flatten(messages: TranslationCatalog, prefix: string, into: Map<string, string>) {
	for (const key of Object.keys(messages)) {
		const value = messages[key];
		if (value !== null && typeof value === 'object') {
			flatten(value, prefix + key + '.', into);
		} else {
			into.set(prefix + key, String(value));
		}
	}
}

/**
 * Registers (or extends) the catalog of `locale`. Nested objects are flattened into
 * dotted keys; keys already registered are overwritten. Can be called at any time, e.g.
 * after a dynamic `import()` of the JSON of a language: everything translated is
 * refreshed on the next tick.
 */
export function registerTranslations(locale: string, messages: TranslationCatalog): void {
	let flat = catalogs.get(locale);
	if (!flat) {
		flat = new Map();
		catalogs.set(locale, flat);
	}
	flatten(messages, '', flat);
	catalogsVersion.update((v) => v + 1);
}

/** Drops every registered catalog. Meant for test isolation. */
export function resetTranslations(): void {
	catalogs.clear();
	warnedMissing.clear();
	catalogsVersion.update((v) => v + 1);
}

// Looks `key` up in the catalog of the current language; `fallback` (the source text) when
// the language has no catalog or the catalog has no non-empty value for the key.
function lookup(key: string, fallback: string): string {
	catalogsVersion.get();
	const locale = lang.get();
	const messages = catalogs.get(locale);
	const value = messages?.get(key);
	if (value) return value;

	if (messages && ChispaDebugConfig.enableMissingTranslationWarnings) {
		const id = locale + '\0' + key;
		if (!warnedMissing.has(id)) {
			warnedMissing.add(id);
			console.warn(`[chispa] No translation for '${key}' in language '${locale}', so the source text is shown instead.`);
		}
	}
	return fallback;
}

function interpolate(message: string, params: TranslationParams | undefined): string {
	if (!params) return message;
	return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
		if (!(name in params)) return placeholder;
		const value = params[name];
		const resolved = isSignal(value) ? value.get() : typeof value === 'function' ? value() : value;
		return String(resolved);
	});
}

/**
 * The message `key` in the current language, with its `{name}` placeholders replaced by
 * `params`, as a plain string. Falls back to the key itself (the source text, when the
 * text is the key) if the language has no translation for it.
 *
 * It reads the `lang` signal, so inside a `computed`, an `effect` or a binding it is
 * tracked like any other signal read; in a component factory, where signals cannot be
 * read, use `t()` instead.
 */
export function translate(key: string, params?: TranslationParams): string {
	return interpolate(lookup(key, key), params);
}

/**
 * Reactive `translate`: a signal with the message in the current language, re-evaluated
 * when the language changes, when a catalog is registered and when a signal passed in
 * `params` changes. Create it wherever a `computed` can be created, component factories
 * included, and bind it like any signal: `title: { inner: t('Save') }`.
 */
export function t(key: string, params?: TranslationParams): Signal<string> {
	return computed(() => translate(key, params));
}

/**
 * @internal Used by compiler-generated template code (`data-i18n`). Not part of the
 * stable public API: ships in lockstep with the HTML compiler and may change in minor
 * versions. Creates a text node that shows `text` translated, keeping the whitespace that
 * surrounded it in the template.
 */
export function i18nText(key: string, text: string = key, before = '', after = ''): Text {
	const node = document.createTextNode('');
	globalContext.addReactivity(() => {
		node.data = before + lookup(key, text) + after;
	});
	return node;
}

/**
 * @internal Used by compiler-generated template code (`data-i18n-<attribute>`). Not part
 * of the stable public API: ships in lockstep with the HTML compiler and may change in
 * minor versions. Keeps the attribute `name` of `node` set to `text` translated.
 */
export function i18nAttr(node: Element, name: string, key: string, text: string = key): void {
	globalContext.addReactivity(() => {
		node.setAttribute(name, lookup(key, text));
	});
}
