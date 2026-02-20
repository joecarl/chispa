import { component, signal, bindControlledInput } from 'chispa';
import tpl from './demo-misc.html';

/**
 * DemoMisc component showing reactive properties and event handling.
 * Detailed documentation of v0.9.0 changes can be found in the associated HTML template.
 */
export const DemoMisc = component((item) => {
	const value = signal('');

	return tpl.fragment({
		inp: {
			_ref: (el) => {
				bindControlledInput(el, value);
			},
		},
		btn: {
			onclick: () => {
				alert('Sigo activo');
			},
			disabled: () => value.get().toLowerCase() === 'deshabilitar',
		},
	});
});
