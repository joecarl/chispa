import { MyApp } from './my-app-component/my-app-component';
import { appendChild } from 'chispa';

const root = document.getElementById('app');
if (root) {
	appendChild(root, MyApp());
}
