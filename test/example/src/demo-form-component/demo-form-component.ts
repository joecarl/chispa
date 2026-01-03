import { component, globalContext, signal } from 'chispa';
import { bindControlledInput } from './controlled-input';
import tpl from './demo-form-component.html';

export const DemoForm = component((item) => {
	const value = signal('Hola');

	return tpl.fragment({
		nameInp: {
			_ref: (el) => {
				bindControlledInput(el, value, {
					transform: (val) => {
						// Poner la primera letra de cada palabra en mayúscula
						return val.replace(/\b\w/g, (l) => l.toUpperCase());
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
				const names = ['Ana', 'Luis', 'María', 'Juan', 'Lucía', 'Pedro', 'Sofía', 'Carlos'];
				const randomName = names[Math.floor(Math.random() * names.length)];
				value.set(randomName);
			},
		},
	});
});
