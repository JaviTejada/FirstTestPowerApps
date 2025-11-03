# Sankey Personalizado para Power BI

Este repositorio contiene un visual personalizado de Power BI que representa un diagrama de Sankey con opciones de formato enriquecidas para controlar los colores de cada categoría, mostrar un icono descriptivo y resaltar el peso relativo de cada flujo.

## Características principales

- **Selección de colores por categoría:** usa la tarjeta de formato *Colores de categorías* para definir tonos específicos por cada nodo del diagrama.
- **Icono descriptivo configurable:** agrega la URL de un recurso gráfico e indica su tamaño desde la tarjeta *Icono* para reforzar el contexto del visual.
- **Valores absolutos y porcentajes:** los nodos muestran su valor agregado y el porcentaje que representan sobre el total del flujo, mientras que los enlaces indican el peso relativo de cada conexión respecto a su categoría de origen.
- **Tooltips enriquecidos:** al pasar el cursor, se despliegan los valores absolutos y relativos de cada elemento.

## Estructura del proyecto

- `pbiviz.json`: metadatos del visual y dependencias externas.
- `capabilities.json`: definición de roles de datos, mapeos y opciones de formato.
- `src/visual.ts`: lógica principal del visual, renderizado con D3 y d3-sankey.
- `src/settings.ts`: utilidades para leer las opciones de formato desde el `DataView`.
- `style/visual.less`: estilos base para el contenedor, etiquetas y tooltips.
- `assets/icon.svg`: icono predeterminado del paquete.
- `package.json` y `tsconfig.json`: configuración de compilación y dependencias.

## Uso

1. Instala las dependencias del proyecto y las herramientas de Power BI Custom Visuals:
   ```bash
   npm install
   npm install -g powerbi-visuals-tools
   ```
2. Ejecuta el servidor de desarrollo o crea el paquete:
   ```bash
   pbiviz start
   # o
   pbiviz package
   ```
3. Importa el `.pbiviz` generado en Power BI Desktop y vincula los campos a los roles **Origen**, **Destino** y **Valor**.
4. Personaliza colores, icono y etiquetas desde el panel de formato.

## Requisitos de datos

- **Origen (agrupación):** categoría inicial de cada flujo.
- **Destino (agrupación):** categoría final del flujo.
- **Valor (medida):** magnitud del flujo entre origen y destino.

Asegúrate de que las columnas de origen y destino tengan la misma granularidad y número de filas que la medida asociada.

## Licencia

Este proyecto se entrega como ejemplo y puede adaptarse según las necesidades de tu organización.
