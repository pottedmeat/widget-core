import global from '@dojo/core/global';
import Map from '@dojo/shim/Map';
import Set from '@dojo/shim/Set';
import { WidgetMetaProperties } from '../interfaces';

export class Base {
	private _invalidate: (force?: boolean) => void;
	private _invalidating: number;
	private _requiredNodes: Set<string>;
	protected nodes: Map<string, HTMLElement>;

	constructor(properties: WidgetMetaProperties) {
		this._invalidate = properties.invalidate;
		this._requiredNodes = properties.requiredNodes;

		this.nodes = properties.nodes;
	}

	public has(key: string): boolean {
		return this.nodes.has(key);
	}

	protected invalidate(): void {
		global.cancelAnimationFrame(this._invalidating);
		this._invalidating = global.requestAnimationFrame(this._invalidate);
	}

	protected requireNode(key: string): void {
		if (!this.nodes.has(key)) {
			this._requiredNodes.add(key);
			this._invalidate();
		}
	}
}

export default Base;
