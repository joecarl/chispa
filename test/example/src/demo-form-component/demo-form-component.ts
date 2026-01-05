import { component, signal, bindControlledInput } from 'chispa';
import tpl from './demo-form-component.html';

export const DemoForm = component((item) => {
	const value = signal('Hola');

	return tpl.fragment({
		nameInp: {
			_ref: (el) => {
				bindControlledInput(el, value, {
					transform: (val) => {
						// Poner la primera letra de cada palabra en mayúscula
						return val.replace(/\b\w/g, (l) => l.toUpperCase()).replace(/\d/g, '');
					},
					validate: (val) => {
						// Límite de longitud
						if (val.length > 10) return false;
						// Si el valor contiene números, rechazarlo
						if (/\d/.test(val)) return false;
						return true;
					},
				});
			},
		},
		randomNameBtn: {
			onclick: () => {
				const names = ['Ana', 'Luis', 'Juan', 'Andrea', 'Pedro', 'Laura', 'Carlos'];
				const randomName = names[Math.floor(Math.random() * names.length)];
				value.set(randomName);
			},
		},
	});
});
