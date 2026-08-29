# Chispa [![npm version](https://img.shields.io/npm/v/chispa.svg?style=flat)](https://www.npmjs.com/package/chispa)

Un motor UI reactivo, extremadamente minimalista y sorprendentemente potente.

Chispa nació de la frustración tras años utilizando los frameworks más populares (como React o Angular) y no encontrar ninguno que me convenciese plenamente en todos los aspectos. Se ha construido destilando lo mejor de cada uno, sumando ideas propias y eliminando sistemáticamente todo lo que sobra.

El resultado es un motor que pone el foco en la **simpleza absoluta y la limpieza del código**. No es solo un motor para pequeños módulos; tras migrar proyectos complejos a Chispa, la experiencia ha demostrado que el código resultante es mucho más legible, mantenible y libre de la "magia" impredecible de otros frameworks.

**Principio fundamental**: la función del componente se ejecuta una sola vez; el resto es flujo puro de datos (**signals → DOM**).

## ¿Por qué elegir Chispa?

- **Baja complejidad mental**: Olvídate de ciclos de vida opacos, re-renders infinitos o hooks con reglas complejas.
- **Control total**: Tienes acceso directo al DOM real y a las plantillas HTML, sin las abstracciones pesadas de un Virtual DOM.
- **Código limpio**: Al separar la estructura HTML de la lógica TS y usar señales precisas, el código se vuelve declarativo y extremadamente fácil de seguir.
- **Rendimiento nativo**: Solo se actualiza el nodo exacto que cambia. Eficiencia máxima por diseño.
- **HTML real**: Plantillas HTML puras importadas, sin JSX ni transformaciones mágicas.
- **TS/JS de un solo paso**: Las funciones de componente se ejecutan una vez (setup), eliminando problemas de estado efímero en cada render.
- **Bindings precisos signal → DOM**: Actualizaciones atómicas sin heurísticas de comparación de árboles.
- **Motor embebible**: Sin arquitectura impuesta; perfecto tanto para aplicaciones completas como para ser incrustado en sistemas existentes.
- **Ligero**: Sin dependencias en tiempo de ejecución.
- **Integración con Vite**: Incluye un plugin de Vite para una experiencia de desarrollo fluida.

## Crear un nuevo proyecto

Puedes crear rápidamente un nuevo proyecto de chispa lanzando el comando:

```bash
npx create-chispa my-app
```

## Setup manual

### Instalación

Instala `chispa` en tu proyecto:

```bash
npm install chispa
```

### Configuración (Vite)

Para usar las plantillas HTML, necesitas configurar el plugin de Chispa en tu `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { chispaHtmlPlugin } from 'chispa/vite-plugin';

export default defineConfig({
	plugins: [chispaHtmlPlugin()],
});
```

Para que el tipado funcione correctamente también es necesario agregar esto en `tsconfig.json`:

```json
{
	"compilerOptions": {
		"rootDirs": [".chispa/types"]
	}
}
```

## Uso Básico

### 1. Crear un Componente

Chispa permite definir la estructura de tu componente en un archivo HTML y la lógica en TypeScript.

**my-component.html**
Usa el atributo `data-cb` para marcar elementos que serán controlados por tu código.

```html
<div class="my-app">
	<h1>Contador: <span data-cb="countDisplay">0</span></h1>
	<button data-cb="incrementBtn">Incrementar</button>
</div>
```

**my-component.ts**

```typescript
import { component, signal } from 'chispa';
import tpl from './my-component.html'; // Importa el HTML procesado

export const MyComponent = component(() => {
	// Estado reactivo
	const count = signal(0);

	// Retorna el fragmento enlazando los elementos del HTML
	return tpl.fragment({
		// Enlaza el contenido directamente con la señal
		countDisplay: { inner: count },

		incrementBtn: {
			// Enlaza el evento click del botón
			onclick: () => count.update((v) => v + 1),
			// Enlaza una propiedad con una función reactiva
			disabled: () => count.get() >= 10,
		},
	});
});
```

A diferencia de otros frameworks de UI, la función del componente se ejecuta una sola vez al montarse. Las actualizaciones de estado no provocan que la función del componente se vuelva a ejecutar. En su lugar, el sistema actualiza de manera atómica únicamente los nodos o atributos vinculados a la señal modificada. Por este motivo no está permitido leer el valor de las señales directamente en el cuerpo de la función factory del componente; su lectura debe realizarse dentro de callbacks o efectos.

### 2. Montar la Aplicación

**main.ts**

```typescript
import { appendChild } from 'chispa';
import { MyComponent } from './my-component';

appendChild(document.body, MyComponent());
```

## Licencia

MIT
