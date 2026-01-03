import { component, computed, signal } from 'chispa';
import { DemoTable } from '../demo-table-component/demo-table-component';
import { DemoForm } from '../demo-form-component/demo-form-component';
import tpl from './my-app-component.html';

interface IDivSimpaticoProps {
	length: number;
}
const DivSimpatico = component<IDivSimpaticoProps>((props) => {
	const text = computed(() => {
		const length = props.length.get();
		if (length < 2) return '?';
		if (length < 5) return 'Sigue';
		if (length < 9) return 'Sigue, sigue';
		if (length < 15) return 'Nada mal, continúa';
		if (length < 20) return 'Suficiente';
		return '¡Ya vale! como sigas así, esto va a acabar mal';
	});

	return tpl.eldiv({
		inner: text,
		style: { width: computed(() => 2 * props.length.get() + 'em') },
	});
});

export const MyApp = component(() => {
	const length = signal(1);

	return tpl.fragment({
		elspan: { inner: length },
		eldiv: DivSimpatico({ length }),
		incBtn: {
			onclick: () => {
				length.update((v) => v + 1);
			},
		},
		demoTableAnchor: DemoTable(),
		demoFormAnchor: DemoForm(),
	});
});
