import { component, Link, Router } from 'chispa';
import { DemoTable } from '../demo-table-component/demo-table-component';
import { DemoForm } from '../demo-form-component/demo-form-component';
import { Home } from '../home-component/home-component';
import tpl from './my-app-component.html';

export const MyApp = component(() => {
	return tpl.fragment({
		linkHome: Link({ to: '/', inner: 'Inicio' }),
		linkTable: Link({ to: '/table', inner: 'Tabla Demo' }),
		linkForm: Link({ to: '/form', inner: 'Formulario Demo' }),
		routerAnchor: Router({
			routes: [
				{ path: '/', component: Home },
				{ path: '/table', component: DemoTable },
				{ path: '/form', component: DemoForm },
			],
		}),
	});
});
