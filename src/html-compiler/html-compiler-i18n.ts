/**
 * Translation markers of the HTML compiler. `data-i18n` (an alias of `data-i18n-0`) and
 * `data-i18n-<n>` mark the n-th non-blank text node of an element; `data-i18n-<attribute>`
 * marks an attribute. A marker without value uses the text (or the attribute value) as
 * key; a marker with a value uses it as explicit key, the text being the default shown
 * until a translation exists.
 *
 * This module reads and validates the markers and generates the calls to the `i18nText`
 * and `i18nAttr` runtime helpers; `HtmlCompiler` decides where those calls go.
 */

import { camelize } from './naming';

const I18N_ATTR = 'data-i18n';

/** The translation marks of one element. A `null` key means "the text (or attribute value) is the key". */
export interface I18nMarks {
	texts: Map<number, { attrName: string; key: string | null }>;
	attrs: Map<string, string | null>;
}

/** A text node with something other than whitespace: the ones `data-i18n-<n>` counts. */
export function isContentText(node: Node): boolean {
	return node.nodeType === 3 && (node.textContent || '').trim() !== '';
}

/**
 * Reads and removes the `data-i18n*` marks of an element, checking that each one points
 * at something that exists. Once an element has a translated text node, every other text
 * node of it with letters must be marked too, so that no text is left untranslated by
 * accident; punctuation around a child element (`is <b>x</b>.`) is fine. `where` describes
 * the element in compile errors (`<p> inside data-cb "card"`).
 */
export function collectI18nMarks(element: Element, where: string): I18nMarks {
	const marks: I18nMarks = { texts: new Map(), attrs: new Map() };

	for (const attr of Array.from(element.attributes)) {
		if (attr.name !== I18N_ATTR && !attr.name.startsWith(I18N_ATTR + '-')) continue;
		element.removeAttribute(attr.name);

		const key = attr.value.trim() === '' ? null : attr.value.trim();
		const target = attr.name === I18N_ATTR ? '0' : attr.name.slice(I18N_ATTR.length + 1);

		if (/^\d+$/.test(target)) {
			const index = Number(target);
			const previous = marks.texts.get(index);
			if (previous) {
				throw new Error(`${attr.name} and ${previous.attrName} on ${where} mark the same text node: data-i18n is the same as data-i18n-0.`);
			}
			marks.texts.set(index, { attrName: attr.name, key });
		} else {
			if (!element.hasAttribute(target)) {
				throw new Error(`${attr.name} on ${where}: the element has no "${target}" attribute to translate.`);
			}
			marks.attrs.set(target, key);
		}
	}

	if (marks.texts.size === 0) return marks;

	const texts = Array.from(element.childNodes).filter(isContentText);
	for (const [index, mark] of marks.texts) {
		if (index < texts.length) continue;
		if (texts.length === 0) {
			throw new Error(
				`${mark.attrName} on ${where}: the element has no text to translate. To translate an attribute use data-i18n-<attribute>, e.g. data-i18n-placeholder.`
			);
		}
		throw new Error(`${mark.attrName} on ${where}: the element has only ${texts.length} text node(s), so the last index is ${texts.length - 1}.`);
	}
	texts.forEach((text, index) => {
		if (marks.texts.has(index) || !/\p{L}/u.test(text.textContent || '')) return;
		const snippet = (text.textContent || '').replace(/\s+/g, ' ').trim();
		throw new Error(
			`The text "${snippet}" in ${where} is not translated while other text of the element is: mark it with data-i18n-${index} or wrap it in its own element.`
		);
	});

	return marks;
}

/**
 * Generates the translation calls of one template, keeping track of the runtime helpers
 * the generated code has to import.
 */
export class I18nCodegen {
	/** The runtime helpers (`i18nText`, `i18nAttr`) the generated code imports from 'chispa'. */
	readonly helpers = new Set<string>();

	/**
	 * The expression of a translated text node. The message is the text with its
	 * whitespace normalized; the whitespace around it in the template is kept (as a single
	 * space) so that it does not get glued to its siblings when the translation is trimmed.
	 */
	textNode(textNode: Node, explicitKey: string | null): string {
		const raw = textNode.textContent || '';
		const text = raw.replace(/\s+/g, ' ').trim();
		const before = /^\s/.test(raw) ? ' ' : '';
		const after = /\s$/.test(raw) ? ' ' : '';
		const key = explicitKey ?? text;

		this.helpers.add('i18nText');

		const args = [JSON.stringify(key)];
		if (text !== key || before || after) args.push(JSON.stringify(text));
		if (before || after) args.push(JSON.stringify(before), JSON.stringify(after));
		return `i18nText(${args.join(', ')})`;
	}

	/**
	 * The statements that translate the marked attributes of `node`. On a data-cb item
	 * (`isComponent`) a binding of the same DOM property from TypeScript wins over the
	 * translation, as `inner` does for the content: `aria-label` is guarded by `props['ariaLabel']`.
	 */
	attributes(element: Element, attrs: I18nMarks['attrs'], isComponent: boolean): string {
		let code = '';
		for (const [name, explicitKey] of attrs) {
			const text = element.getAttribute(name) || '';
			const key = explicitKey ?? text;

			this.helpers.add('i18nAttr');

			const args = ['node', JSON.stringify(name), JSON.stringify(key)];
			if (text !== key) args.push(JSON.stringify(text));
			const call = `i18nAttr(${args.join(', ')});`;

			code += isComponent ? `if (props[${JSON.stringify(camelize(name))}] === undefined) ${call}\n` : `${call}\n`;
		}
		return code;
	}
}
