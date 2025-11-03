import powerbi from "powerbi-visuals-api";

import DataView = powerbi.DataView;
import DataViewObject = powerbi.DataViewObject;
import DataViewObjects = powerbi.DataViewObjects;
import DataViewValueColor = powerbi.DataViewValueColor;

export interface SankeySettings {
    dataPoint: DataPointSettings;
    node: NodeSettings;
    links: LinkSettings;
    icon: IconSettings;
}

export interface DataPointSettings {
    defaultColor?: string;
    showAllDataPoints: boolean;
}

export interface NodeSettings {
    labelFontSize: number;
    showValues: boolean;
}

export interface LinkSettings {
    opacity: number;
}

export interface IconSettings {
    imageUrl: string;
    size: number;
}

export class SankeySettingsHelper {
    public static parse(dataView: DataView): SankeySettings {
        const objects: DataViewObjects | undefined = dataView?.metadata?.objects;

        return {
            dataPoint: {
                defaultColor: getColorValue(objects, "dataPoint", "defaultColor"),
                showAllDataPoints: getValue<boolean>(objects, "dataPoint", "showAllDataPoints", true)
            },
            node: {
                labelFontSize: getValue<number>(objects, "nodeSettings", "labelFontSize", 12),
                showValues: getValue<boolean>(objects, "nodeSettings", "showValues", true)
            },
            links: {
                opacity: getClampedValue<number>(objects, "linkSettings", "opacity", 0.7, 0.05, 1)
            },
            icon: {
                imageUrl: getValue<string>(objects, "iconSettings", "imageUrl", ""),
                size: getClampedValue<number>(objects, "iconSettings", "size", 48, 12, 96)
            }
        };
    }
}

function getValue<T>(objects: DataViewObjects | undefined, objectName: string, propertyName: string, defaultValue: T): T {
    if (objects) {
        const object: DataViewObject | undefined = objects[objectName];
        const property: DataViewValueColor | powerbi.PrimitiveValue | undefined = object && object[propertyName];

        if (property !== undefined && property !== null) {
            return property as unknown as T;
        }
    }

    return defaultValue;
}

function getColorValue(objects: DataViewObjects | undefined, objectName: string, propertyName: string): string | undefined {
    if (objects) {
        const object: DataViewObject | undefined = objects[objectName];
        const property: powerbi.Fill | undefined = object && object[propertyName] as powerbi.Fill;

        if (property && property.solid && property.solid.color) {
            return property.solid.color;
        }
    }

    return undefined;
}

function getClampedValue<T extends number>(objects: DataViewObjects | undefined, objectName: string, propertyName: string, defaultValue: T, min: number, max: number): T {
    const value: number = getValue<number>(objects, objectName, propertyName, defaultValue);
    const clamped: number = Math.max(min, Math.min(max, value));
    return clamped as T;
}
