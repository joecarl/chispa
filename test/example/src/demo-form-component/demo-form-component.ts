import { component, globalContext, signal } from 'chispa';
import { InputInterceptor } from './input-interceptor';
import tpl from './demo-form-component.html';

export const DemoForm = component((item) => {
	const value = signal('Hola');
	let inputInterceptor: InputInterceptor | null = null;

	// Handler para eventos sintéticos del interceptor
	const handleChangeRequested = (event: CustomEvent) => {
		const { oldValue, proposedValue, inputType, data } = event.detail;
		console.log('Cambio solicitado:', { oldValue, proposedValue, inputType, data });

		// Aplicar reglas de validación
		let finalValue = proposedValue;

		// Límite de longitud
		if (finalValue.length > 10) {
			console.log('Valor rechazado: excede longitud máxima');
			return; // No aplicar el cambio
		}

		// Si el valor contiene números, rechazarlo
		if (/\d/.test(finalValue)) {
			console.log('Valor rechazado: contiene números');
			return; // No aplicar el cambio
		}

		// Poner la primera letra de cada palabra en mayúscula
		finalValue = finalValue.replace(/\b\w/g, (l) => l.toUpperCase());

		// Actualizar el estado
		value.set(finalValue);
	};

	return tpl.fragment({
		nameInp: {
			//value: value,
			//oninput: handleNameInput,
			_ref: (el) => {
				// Crear interceptor para el input
				inputInterceptor = new InputInterceptor(el);

				// Escuchar eventos sintéticos del interceptor
				el.addEventListener('change-requested', handleChangeRequested);

				// Establecer valor inicial
				inputInterceptor.applyValue(value.initialValue);
				el.value = value.initialValue;

				globalContext.addReactivity(() => {
					const newValue = value.get();
					// Sincronizar valor cuando cambie externamente
					inputInterceptor.applyValue(newValue);
				});

				// Nota: En un entorno real, necesitarías manejar la limpieza del interceptor
				// cuando el componente se desmonte
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
