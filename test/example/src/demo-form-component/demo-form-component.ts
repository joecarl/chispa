import { component, signal, bindControlledInput, bindControlledSelect, SelectOption } from 'chispa';
import tpl from './demo-form-component.html';

export const DemoForm = component((item) => {
	const value = signal('Hola');
	const selectValue = signal('');
	const selectOptions = signal<SelectOption[]>([
		{ value: 'opt1', label: 'Opción 1' },
		{ value: 'opt2', label: 'Opción 2' },
	]);

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
		selectInp: {
			_ref: (el) => {
				bindControlledSelect(el, selectValue, selectOptions);
			},
		},
		selectValue: { inner: selectValue },
		randomizeOptionsBtn: {
			onclick: () => {
				const newOptions: SelectOption[] = [];
				const optionCount = Math.floor(Math.random() * 5) + 1;
				for (let i = 1; i <= optionCount; i++) {
					newOptions.push({ value: `opt${i}`, label: `Opción ${i}` });
				}

				selectOptions.set(newOptions);
			},
		},
		selectOptionsCount: {
			inner: () => selectOptions.get().length,
		},
	});
});
