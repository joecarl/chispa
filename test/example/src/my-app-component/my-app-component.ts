import { component, Link, Router, pathMatches, signal } from 'chispa';
import { DemoTable } from '../demo-table-component/demo-table-component';
import { DemoForm } from '../demo-form-component/demo-form-component';
import { DemoNested } from '../demo-nested-component/demo-nested-component';
import { Home } from '../home-component/home-component';
import tpl from './my-app-component.html';

export const MyApp = component(() => {
	const linksData = [
		{ to: '/', inner: 'Inicio' },
		{ to: '/table', inner: 'Tabla Demo' },
		{ to: '/form', inner: 'Formulario Demos' },
		{ to: '/nested', inner: 'Componente Anidado' },
	];

	// Al usar datos estaticos, podemos crear una lista de componentes Link sin necesidad de
	// usar componentList, ya que no hay reactividad en la lista.
	const links = linksData.map((link) =>
		Link({
			to: link.to,
			inner: link.inner,
			classes: { 'active-link': pathMatches(link.to) },
		})
	);

	return tpl.fragment({
		links: { inner: links },
		routerAnchor: Router({
			routes: [
				{ path: '/', component: Home },
				{ path: '/table', component: DemoTable },
				{ path: '/form', component: DemoForm },
				{ path: '/nested', component: DemoNested },
			],
		}),
	});
});
