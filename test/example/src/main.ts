import { MyApp } from './my-app-component/my-app-component';
import { appendChild, enableDevDebugging } from 'chispa';

// Development warnings only; production builds drop this call
if (import.meta.env.DEV) enableDevDebugging();

const root = document.getElementById('app');
if (root) {
	appendChild(root, MyApp());
}
