import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import DataView = powerbi.DataView;
import IColorPalette = powerbi.extensibility.IColorPalette;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataViewCategorical = powerbi.DataViewCategorical;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewValueColumns = powerbi.DataViewValueColumns;
import DataViewObjects = powerbi.DataViewObjects;
import DataViewObject = powerbi.DataViewObject;
import { SankeySettings, SankeySettingsHelper } from "./settings";

import * as d3 from "d3";
import { SankeyLayout, sankey, SankeyNode, SankeyLink, sankeyLinkHorizontal } from "d3-sankey";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";

type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;

type VisualSankeyNode = SankeyNode<SankeyNodeDatum, SankeyLinkDatum> & SankeyNodeDatum;
type VisualSankeyLink = SankeyLink<SankeyNodeDatum, SankeyLinkDatum> & SankeyLinkDatum;

interface SankeyNodeDatum {
    name: string;
    color: string;
    total: number;
    percentOfTotal: number;
}

interface SankeyLinkDatum {
    source: number | SankeyNodeDatum;
    target: number | SankeyNodeDatum;
    value: number;
    formattedValue: string;
    percent: number;
    key: string;
    color: string;
}

interface SankeyInternalData {
    nodes: SankeyNodeDatum[];
    links: SankeyLinkDatum[];
    formatString: string | undefined;
    maxValue: number;
    totalValue: number;
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private colorPalette: IColorPalette;
    private root: Selection<HTMLDivElement>;
    private svg: Selection<SVGSVGElement>;
    private linkGroup: Selection<SVGGElement>;
    private nodeGroup: Selection<SVGGElement>;
    private labelGroup: Selection<SVGGElement>;
    private tooltip: Selection<HTMLDivElement>;
    private iconImg: Selection<HTMLImageElement>;
    private settings: SankeySettings | undefined;
    private formatter: valueFormatter.IValueFormatter | undefined;
    private viewportWidth: number = 0;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.colorPalette = this.host.colorPalette;

        this.root = d3.select(options.element)
            .append("div")
            .classed("visual-sankey", true);

        this.iconImg = this.root
            .append("img")
            .classed("visual-sankey__icon", true)
            .style("display", "none");

        this.tooltip = this.root
            .append("div")
            .classed("visual-sankey__tooltip hidden", true);

        this.svg = this.root
            .append("svg")
            .attr("role", "img")
            .attr("aria-label", "Sankey chart");

        const container = this.svg.append("g");
        this.linkGroup = container.append("g").classed("links", true);
        this.nodeGroup = container.append("g").classed("nodes", true);
        this.labelGroup = container.append("g").classed("labels", true);
    }

    public update(options: VisualUpdateOptions): void {
        const dataView: DataView | undefined = options.dataViews && options.dataViews[0];
        if (!dataView) {
            this.clear();
            return;
        }

        this.settings = SankeySettingsHelper.parse(dataView);
        this.configureIcon();

        const width = Math.max(0, options.viewport.width);
        const height = Math.max(0, options.viewport.height);
        this.viewportWidth = width;

        this.svg.attr("width", width).attr("height", height);

        const data: SankeyInternalData | undefined = this.transform(dataView);
        if (!data || data.nodes.length === 0 || data.links.length === 0) {
            this.clear();
            return;
        }

        this.formatter = valueFormatter.create({
            format: data.formatString,
            value: data.maxValue
        });

        const iconHeightOffset = this.settings?.icon.imageUrl ? this.settings.icon.size + 16 : 16;
        const padding = { top: iconHeightOffset, left: 20, right: 20, bottom: 20 };

        const sankeyLayout: SankeyLayout<SankeyNodeDatum, SankeyLinkDatum> = sankey<SankeyNodeDatum, SankeyLinkDatum>()
            .nodeId((d: SankeyNodeDatum) => d.name)
            .nodeWidth(20)
            .nodePadding(16)
            .extent([
                [padding.left, padding.top],
                [Math.max(padding.left + 1, width - padding.right), Math.max(padding.top + 1, height - padding.bottom)]
            ]);

        const layout = sankeyLayout({
            nodes: data.nodes.map(n => ({ ...n })),
            links: data.links.map(l => ({ ...l }))
        });

        this.renderLinks(layout.links as unknown as VisualSankeyLink[]);
        this.renderNodes(layout.nodes as unknown as VisualSankeyNode[]);
    }

    private renderLinks(links: VisualSankeyLink[]): void {
        const linkSelection = this.linkGroup
            .selectAll<SVGPathElement, VisualSankeyLink>("path")
            .data(links, (d: VisualSankeyLink) => d.key);

        linkSelection.exit().remove();

        const opacity = this.settings?.links.opacity ?? 0.7;

        const linkEnter = linkSelection.enter()
            .append("path")
            .style("fill", "none")
            .style("cursor", "pointer");

        const merged = linkEnter.merge(linkSelection as any);

        merged
            .attr("d", sankeyLinkHorizontal<SankeyNodeDatum, SankeyLinkDatum>())
            .attr("stroke", (d: VisualSankeyLink) => d.color)
            .attr("stroke-width", (d: VisualSankeyLink) => Math.max(1, d.width || 1))
            .attr("stroke-opacity", opacity)
            .on("mousemove", (event: MouseEvent, d: VisualSankeyLink) => {
                this.showTooltip(`${(d.source as SankeyNodeDatum).name} → ${(d.target as SankeyNodeDatum).name}<br>${d.formattedValue} (${d.percent.toFixed(1)}%)`, event);
            })
            .on("mouseout", () => this.hideTooltip());
    }

    private renderNodes(nodes: VisualSankeyNode[]): void {
        const nodeSelection = this.nodeGroup
            .selectAll<SVGGElement, VisualSankeyNode>("g.node")
            .data(nodes, (d: VisualSankeyNode) => d.name);

        nodeSelection.exit().remove();

        const nodeEnter = nodeSelection.enter()
            .append("g")
            .classed("node", true);

        nodeEnter.append("rect");

        const merged = nodeEnter.merge(nodeSelection as any);

        merged
            .select("rect")
            .attr("x", (d: VisualSankeyNode) => d.x0 ?? 0)
            .attr("y", (d: VisualSankeyNode) => d.y0 ?? 0)
            .attr("height", (d: VisualSankeyNode) => Math.max(1, (d.y1 ?? 0) - (d.y0 ?? 0)))
            .attr("width", (d: VisualSankeyNode) => Math.max(1, (d.x1 ?? 0) - (d.x0 ?? 0)))
            .attr("fill", (d: VisualSankeyNode) => d.color)
            .attr("stroke", "#333333")
            .attr("stroke-width", 1)
            .on("mousemove", (event: MouseEvent, d: VisualSankeyNode) => {
                const valueLabel = this.formatValue(d.total);
                this.showTooltip(`${d.name}<br>${valueLabel} (${d.percentOfTotal.toFixed(1)}%)`, event);
            })
            .on("mouseout", () => this.hideTooltip());

        const showValues = this.settings?.node.showValues ?? true;
        const fontSize = this.settings?.node.labelFontSize ?? 12;

        const labels = this.labelGroup
            .selectAll<SVGTextElement, VisualSankeyNode>("text.visual-sankey__label")
            .data(nodes, (d: VisualSankeyNode) => d.name);

        labels.exit().remove();

        const labelsEnter = labels.enter()
            .append("text")
            .classed("visual-sankey__label", true);

        const labelMerged = labelsEnter.merge(labels as any);

        labelMerged
            .attr("x", (d: VisualSankeyNode) => {
                const isLeft = (d.x0 ?? 0) < this.viewportWidth / 2;
                return isLeft ? (d.x0 ?? 0) - 6 : (d.x1 ?? 0) + 6;
            })
            .attr("y", (d: VisualSankeyNode) => ((d.y0 ?? 0) + ((d.y1 ?? 0) - (d.y0 ?? 0)) / 2))
            .attr("dy", "0.35em")
            .attr("text-anchor", (d: VisualSankeyNode) => ((d.x0 ?? 0) < this.viewportWidth / 2) ? "end" : "start")
            .style("font-size", `${fontSize}px`)
            .text((d: VisualSankeyNode) => {
                if (!showValues) {
                    return d.name;
                }
                return `${d.name} – ${this.formatValue(d.total)} (${d.percentOfTotal.toFixed(1)}%)`;
            });
    }

    private formatValue(value: number): string {
        if (!this.formatter) {
            return d3.format(",.2f")(value);
        }

        return this.formatter.format(value);
    }

    private configureIcon(): void {
        if (!this.settings || !this.settings.icon.imageUrl) {
            this.iconImg.style("display", "none");
            return;
        }

        this.iconImg
            .style("display", "block")
            .attr("src", this.settings.icon.imageUrl)
            .attr("width", this.settings.icon.size)
            .attr("height", this.settings.icon.size);
    }

    private transform(dataView: DataView): SankeyInternalData | undefined {
        const categorical: DataViewCategorical | undefined = dataView.categorical;
        if (!categorical || !categorical.categories || categorical.categories.length < 2 || !categorical.values || categorical.values.length === 0) {
            return undefined;
        }

        const sourceCategory: DataViewCategoryColumn = categorical.categories[0];
        const destinationCategory: DataViewCategoryColumn = categorical.categories[1];
        const values: DataViewValueColumns = categorical.values;
        const valueColumn = values[0];
        const formatString = valueColumn?.source?.format;

        const nodes: SankeyNodeDatum[] = [];
        const links: SankeyLinkDatum[] = [];
        const nodeIndex = new Map<string, number>();
        const outgoingTotals = new Map<string, number>();
        const incomingTotals = new Map<string, number>();
        const sourceTotals = new Map<string, number>();
        const colorMap = new Map<string, string>();

        const defaultColor = this.settings?.dataPoint.defaultColor;

        const rows = valueColumn.values.length;
        let maxValue = 0;
        let totalValue = 0;

        for (let i = 0; i < rows; i++) {
            const rawValue = valueColumn.values[i];
            if (rawValue === null || rawValue === undefined) {
                continue;
            }

            const value = Number(rawValue);
            if (!isFinite(value)) {
                continue;
            }

            const sourceName = this.valueToString(sourceCategory.values[i]);
            const targetName = this.valueToString(destinationCategory.values[i]);

            if (!sourceName || !targetName) {
                continue;
            }

            const sourceColor = this.resolveColor(sourceCategory, i, sourceName, colorMap, defaultColor);
            const targetColor = this.resolveColor(destinationCategory, i, targetName, colorMap, defaultColor);

            const sourceIdx = this.ensureNode(sourceName, sourceColor, nodes, nodeIndex);
            const targetIdx = this.ensureNode(targetName, targetColor, nodes, nodeIndex);

            outgoingTotals.set(sourceName, (outgoingTotals.get(sourceName) ?? 0) + value);
            incomingTotals.set(targetName, (incomingTotals.get(targetName) ?? 0) + value);
            sourceTotals.set(sourceName, (sourceTotals.get(sourceName) ?? 0) + value);

            links.push({
                source: sourceIdx,
                target: targetIdx,
                value,
                percent: 0,
                formattedValue: "",
                key: `${sourceName}|${targetName}|${i}`,
                color: sourceColor
            });

            maxValue = Math.max(maxValue, value);
            totalValue += value;
        }

        if (links.length === 0) {
            return undefined;
        }

        const formatter = valueFormatter.create({ format: formatString, value: maxValue });

        links.forEach(link => {
            const sourceName = nodes[link.source as number].name;
            const total = sourceTotals.get(sourceName) ?? 0;
            link.percent = total > 0 ? (link.value / total) * 100 : 0;
            link.formattedValue = formatter.format(link.value);
        });

        nodes.forEach(node => {
            const outgoing = outgoingTotals.get(node.name) ?? 0;
            const incoming = incomingTotals.get(node.name) ?? 0;
            node.total = Math.max(outgoing, incoming);
            node.percentOfTotal = totalValue > 0 ? (node.total / totalValue) * 100 : 0;
            if (!node.color) {
                node.color = this.colorPalette.getColor(node.name).value;
            }
        });

        return { nodes, links, formatString, maxValue, totalValue };
    }

    private ensureNode(name: string, color: string, nodes: SankeyNodeDatum[], index: Map<string, number>): number {
        if (index.has(name)) {
            const idx = index.get(name)!;
            const node = nodes[idx];
            if (!node.color && color) {
                node.color = color;
            }
            return idx;
        }

        const nodeIdx = nodes.length;
        nodes.push({ name, color, total: 0, percentOfTotal: 0 });
        index.set(name, nodeIdx);
        return nodeIdx;
    }

    private resolveColor(category: DataViewCategoryColumn, rowIndex: number, categoryValue: string, colorMap: Map<string, string>, defaultColor?: string): string {
        if (colorMap.has(categoryValue)) {
            return colorMap.get(categoryValue)!;
        }

        const objects: DataViewObjects[] | undefined = category.objects;
        const object = objects && objects[rowIndex];
        let color: string | undefined;

        if (object) {
            const dataPointObject = object["dataPoint"] as DataViewObject;
            if (dataPointObject) {
                const fill = dataPointObject["fill"] as powerbi.Fill;
                if (fill && fill.solid && fill.solid.color) {
                    color = fill.solid.color;
                }
            }
        }

        if (!color) {
            color = defaultColor || this.colorPalette.getColor(categoryValue).value;
        }

        colorMap.set(categoryValue, color);
        return color;
    }

    private valueToString(value: any): string {
        if (value === null || value === undefined) {
            return "";
        }

        return value.toString();
    }

    private clear(): void {
        this.linkGroup.selectAll("path").remove();
        this.nodeGroup.selectAll("g").remove();
        this.labelGroup.selectAll("text").remove();
        this.hideTooltip();
    }

    private showTooltip(content: string, event: MouseEvent): void {
        const { pageX, pageY } = event;
        this.tooltip
            .html(content)
            .style("left", `${pageX + 12}px`)
            .style("top", `${pageY + 12}px`)
            .classed("hidden", false);
    }

    private hideTooltip(): void {
        this.tooltip.classed("hidden", true);
    }
}
