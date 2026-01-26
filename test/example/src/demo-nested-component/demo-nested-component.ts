import { component, signal, bindControlledInput } from 'chispa';
import tpl from './demo-nested-component.html';

export const DemoNested = component((item) => {
	const color = signal('#3b82f6');

	const changeColor = () => {
		const randomColor =
			'#' +
			Math.floor(Math.random() * 16777215)
				.toString(16)
				.padStart(6, '0');
		color.set(randomColor);
	};

	return tpl.fragment({
		box: {
			style: { borderColor: color },
		},
		colorText: { inner: color },
		btn: { onclick: changeColor },
	});
});
